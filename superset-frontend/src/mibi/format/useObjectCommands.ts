/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useCallback, useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { RootState } from 'src/dashboard/types';
import {
  copyObject,
  duplicateObject,
  isCopyable,
  pasteObject,
  readClipboard,
} from './clipboard';
import { DELETE_COMPONENT } from 'src/dashboard/actions/dashboardLayout';
import { setUnsavedChanges } from 'src/dashboard/actions/dashboardState';
import { nudgeObject } from './actions';
import { isObjectLocked } from './lock';
import { pageObjects } from './arrange';
import {
  selectAllVisuals,
  selectVisual,
  selectedVisual,
  selectedVisuals,
} from './selection';
import { activePageId } from 'src/mibi/present/dashboardTabs';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/** Copy, paste and duplicate for the selected object, with toasts. */
export function useObjectCommands() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const { addSuccessToast, addDangerToast } = useToasts();

  const copy = useCallback(
    (id: string) => {
      if (!isCopyable(store.getState().dashboardLayout.present[id])) return;
      dispatch(copyObject(id));
      addSuccessToast(t('Copied. Paste it here or in another dashboard.'));
    },
    [addSuccessToast, dispatch, store],
  );

  const run = useCallback(
    async (action: Promise<void>) => {
      try {
        await action;
      } catch (error) {
        logging.error(error);
        addDangerToast(t('The object could not be pasted'));
      }
    },
    [addDangerToast],
  );

  const paste = useCallback(
    (afterId: string | null) => {
      if (!readClipboard()) return;
      run(dispatch(pasteObject(afterId)));
    },
    [dispatch, run],
  );

  const duplicate = useCallback(
    (id: string) => {
      if (!isCopyable(store.getState().dashboardLayout.present[id])) return;
      run(dispatch(duplicateObject(id)));
    },
    [dispatch, run, store],
  );

  /** Removes objects from the page, except locked ones; undo brings them back. */
  const remove = useCallback(
    (ids: string[]) => {
      const layout = store.getState().dashboardLayout.present;
      // One undo step brings them all back
      const group = `remove:${Date.now()}`;
      const removed = ids.filter(id => {
        const item = layout[id];
        const parentId = item?.parents?.[item.parents.length - 1];
        if (!item || !parentId || isObjectLocked(item.meta)) return false;
        dispatch({
          type: DELETE_COMPONENT,
          payload: { id, parentId },
          formatGroup: group,
        });
        return true;
      });
      if (removed.length) {
        dispatch(setUnsavedChanges(true));
        selectVisual(null);
      }
    },
    [dispatch, store],
  );

  const cut = useCallback(
    (id: string) => {
      const { meta } = store.getState().dashboardLayout.present[id] ?? {};
      if (isObjectLocked(meta)) return;
      copy(id);
      remove([id]);
    },
    [copy, remove, store],
  );

  return { copy, cut, paste, duplicate, remove };
}

/** Cells an arrow key moves the selected object by. */
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Ctrl/Cmd + C, X, V and D on the selected object while editing, Ctrl/Cmd + A
 * for the whole page, Delete to remove and Esc to deselect, and the arrow keys
 * to move it a cell (five with Shift).
 */
export function useObjectShortcuts() {
  const { copy, cut, paste, duplicate, remove } = useObjectCommands();
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  useEffect(() => {
    const typingIn = (target: EventTarget | null) =>
      (target as HTMLElement | null)?.closest?.(
        'input, textarea, select, [contenteditable="true"], .ant-select, .ant-slider, .ant-modal',
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !typingIn(event.target) &&
        selectedVisual()
      ) {
        event.preventDefault();
        remove(selectedVisuals());
        return;
      }
      // Esc first closes a menu that is open
      if (
        event.key === 'Escape' &&
        !typingIn(event.target) &&
        !document.querySelector(
          '.ant-dropdown:not(.ant-dropdown-hidden), .ant-popover:not(.ant-popover-hidden)',
        )
      ) {
        selectVisual(null);
        return;
      }
      const arrow = ARROWS[event.key];
      if (arrow && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const picked = selectedVisual();
        const typing = (event.target as HTMLElement | null)?.closest?.(
          'input, textarea, select, [contenteditable="true"], .ant-select, .ant-slider',
        );
        if (picked && !typing) {
          // Shift moves five cells at a time
          const steps = event.shiftKey ? 5 : 1;
          event.preventDefault();
          selectedVisuals().forEach(id =>
            dispatch(nudgeObject(id, arrow[0] * steps, arrow[1] * steps)),
          );
        }
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest?.(
          'input, textarea, select, [contenteditable="true"], .ant-select',
        )
      )
        return;
      // Keep the browser's copy when the user selected some text
      if (window.getSelection()?.toString()) return;
      const selected = selectedVisual();
      const key = event.key.toLowerCase();
      if (key === 'a') {
        const { dashboardLayout, dashboardState } = store.getState();
        const layout = dashboardLayout.present;
        event.preventDefault();
        selectAllVisuals(
          pageObjects(layout, activePageId(layout, dashboardState.activeTabs)),
        );
      } else if (key === 'c' && selected) {
        copy(selected);
      } else if (key === 'x' && selected) {
        event.preventDefault();
        cut(selected);
      } else if (key === 'v' && readClipboard()) {
        event.preventDefault();
        paste(selected);
      } else if (key === 'd' && selected) {
        event.preventDefault();
        duplicate(selected);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copy, cut, dispatch, duplicate, paste, remove, store]);
}
