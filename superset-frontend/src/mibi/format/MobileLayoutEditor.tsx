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
import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { updateLayout } from './actions';
import {
  mobileLayoutOf,
  moveMobileBox,
  removeMobileBox,
  resizeMobileBox,
  withMobileLayout,
  type MobileBox,
} from './mobileLayout';
import { objectName } from './objectName';
import { CELL } from './types';

/** The phone page of the editor, where the mobile pane drops its visuals. */
export const MOBILE_EDITOR_TEST_ID = 'mibi-mobile-editor';

type Layout = Record<string, LayoutItem>;
type Dispatch = (action: unknown) => unknown;

/**
 * Writes the mobile layout of a page in one undo step. Moves and resizes of
 * a box group by gesture, so one undo takes back one gesture.
 */
export const setMobileBoxes =
  (
    pageId: string,
    change: (layout: Layout, boxes: MobileBox[]) => MobileBox[],
  ) =>
  (dispatch: Dispatch, getState: () => RootState) => {
    const layout = getState().dashboardLayout.present as Layout;
    const page = layout[pageId];
    if (!page) return;
    const boxes = mobileLayoutOf(layout, pageId) ?? [];
    const next = change(layout, boxes);
    if (JSON.stringify(next) === JSON.stringify(boxes)) return;
    dispatch(
      updateLayout(
        { [pageId]: withMobileLayout(page, next) },
        `mobile:${pageId}:${Date.now()}`,
      ),
    );
  };

const Layer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 50;
`;

const Box = styled.div<{ $selected: boolean; $moving: boolean }>`
  ${({ theme, $selected, $moving }) => css`
    position: absolute;
    box-sizing: border-box;
    border: 2px ${$selected ? 'solid' : 'dashed'} ${theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    background: ${$moving ? `${theme.colorPrimaryBg}99` : 'transparent'};
    cursor: move;
    touch-action: none;
    .mibi-mobile-label {
      position: absolute;
      top: 0;
      left: 0;
      max-width: calc(100% - 28px);
      padding: 0 ${theme.sizeUnit * 1.5}px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: ${theme.fontSizeSM}px;
      line-height: 20px;
      color: ${theme.colorTextLightSolid};
      background: ${theme.colorPrimary};
      border-bottom-right-radius: ${theme.borderRadius}px;
    }
    .mibi-mobile-remove {
      position: absolute;
      top: 0;
      right: 0;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: none;
      color: ${theme.colorTextLightSolid};
      background: ${theme.colorPrimary};
      border-bottom-left-radius: ${theme.borderRadius}px;
      cursor: pointer;
    }
    .mibi-mobile-resize {
      position: absolute;
      right: -6px;
      bottom: -6px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: ${theme.colorPrimary};
      border: 2px solid ${theme.colorBgContainer};
      cursor: nwse-resize;
    }
  `}
`;

interface Gesture {
  id: string;
  kind: 'move' | 'resize';
  startX: number;
  startY: number;
  box: MobileBox;
}

/**
 * Arranges the mobile layout over the phone page: each object placed there
 * moves by dragging it, resizes from its corner and leaves the phone with its
 * cross. Objects of the page are dropped on it from the mobile layout pane
 * (MobileLayoutPane).
 */
export function MobileLayoutEditor({
  pageId,
  boxes,
  zoom,
}: {
  pageId: string;
  boxes: MobileBox[];
  zoom: number;
}) {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const filters = useSelector(
    (state: RootState) =>
      state.nativeFilters?.filters as Record<string, { name?: string }>,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [preview, setPreview] = useState<MobileBox | null>(null);

  const change = (
    edit: (current: Layout, currentBoxes: MobileBox[]) => MobileBox[],
  ) => dispatch(setMobileBoxes(pageId, edit) as never);

  const remove = (id: string) => {
    change((_, current) => removeMobileBox(current, id));
    setSelected(null);
  };

  // Delete or Backspace takes the chosen object off the phone
  useEffect(() => {
    if (!selected) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, [contenteditable="true"]')) {
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        remove(selected);
      } else if (event.key === 'Escape') {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, pageId]);

  const start = (
    event: ReactPointerEvent<HTMLElement>,
    box: MobileBox,
    kind: Gesture['kind'],
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    setSelected(box.id);
    setGesture({
      id: box.id,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      box,
    });
    setPreview(box);
  };

  const shifted = (event: ReactPointerEvent<HTMLElement>, current: Gesture) => {
    const unit = CELL * (zoom || 1);
    const dx = Math.round((event.clientX - current.startX) / unit);
    const dy = Math.round((event.clientY - current.startY) / unit);
    const all = store.getState().dashboardLayout.present as Layout;
    const only = [current.box];
    const next =
      current.kind === 'move'
        ? moveMobileBox(all, only, current.id, {
            x: current.box.x + dx,
            y: current.box.y + dy,
          })
        : resizeMobileBox(all, only, current.id, {
            width: current.box.width + dx,
            height: current.box.height + dy,
          });
    return next[0];
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (gesture) setPreview(shifted(event, gesture));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gesture) return;
    const next = shifted(event, gesture);
    setGesture(null);
    setPreview(null);
    change((current, currentBoxes) =>
      gesture.kind === 'move'
        ? moveMobileBox(current, currentBoxes, gesture.id, next)
        : resizeMobileBox(current, currentBoxes, gesture.id, next),
    );
  };

  return (
    <Layer
      data-test={MOBILE_EDITOR_TEST_ID}
      onPointerDown={() => setSelected(null)}
    >
      {boxes.map(stored => {
        const box = preview?.id === stored.id ? preview : stored;
        const name = objectName(layout[box.id], filters);
        return (
          <Box
            key={box.id}
            role="group"
            aria-label={name}
            data-test="mibi-mobile-box"
            data-id={box.id}
            $selected={selected === box.id}
            $moving={gesture?.id === box.id}
            style={{
              left: box.x * CELL,
              top: box.y * CELL,
              width: box.width * CELL,
              height: box.height * CELL,
            }}
            onPointerDown={event => start(event, stored, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="mibi-mobile-label" title={name}>
              {name}
            </span>
            <button
              type="button"
              className="mibi-mobile-remove"
              aria-label={t('Remove from the mobile layout')}
              title={t('Remove from the mobile layout')}
              data-test="mibi-mobile-remove"
              onPointerDown={event => event.stopPropagation()}
              onClick={() => remove(box.id)}
            >
              <Icons.CloseOutlined iconSize="s" />
            </button>
            <span
              className="mibi-mobile-resize"
              aria-hidden
              onPointerDown={event => start(event, stored, 'resize')}
            />
          </Box>
        );
      })}
    </Layer>
  );
}
