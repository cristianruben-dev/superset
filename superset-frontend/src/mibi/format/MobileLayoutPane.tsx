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
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled, type SupersetTheme } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { BUILDER_SIDEPANEL_WIDTH } from 'src/dashboard/constants';
import type { RootState } from 'src/dashboard/types';
import { activePageId } from 'src/mibi/present/dashboardTabs';
import { setMobileEditing } from './mobile';
import {
  addMobileBox,
  mobileCellAt,
  mobileCandidates,
  mobileLayoutOf,
  removeMobileBox,
} from './mobileLayout';
import { MOBILE_EDITOR_TEST_ID, setMobileBoxes } from './MobileLayoutEditor';
import { CELL } from './types';
import { objectName } from './objectName';

const Pane = styled.div`
  ${({ theme }) => css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px;
    overflow: auto;
    background-color: ${theme.colorBgBase};
    box-shadow: -${theme.sizeUnit}px 0 ${theme.sizeUnit}px 0
      ${theme.colorBorderSecondary};
    h4 {
      margin: 0;
      font-size: ${theme.fontSizeLG}px;
    }
    p {
      margin: 0;
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit}px;
    }
    li {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorBgContainer};
    }
    li.draggable {
      cursor: grab;
      touch-action: none;
    }
    li.placed {
      border-color: ${theme.colorPrimaryBorder};
      background: ${theme.colorPrimaryBg};
    }
    li .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `}
`;

/**
 * The pane of the mobile layout: the visuals of the page, which are dragged
 * onto the phone page (or added with a click) and taken off it again.
 */
export function MobileLayoutPane({ topOffset = 0, pageTop = 0 }) {
  const dispatch = useDispatch();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const filters = useSelector(
    (state: RootState) =>
      state.nativeFilters?.filters as Record<string, { name?: string }>,
  );
  const pageId = activePageId(layout, activeTabs);
  const boxes = useMemo(
    () => mobileLayoutOf(layout, pageId) ?? [],
    [layout, pageId],
  );
  const candidates = useMemo(
    () => mobileCandidates(layout, pageId),
    [layout, pageId],
  );
  const placed = new Set(boxes.map(box => box.id));
  // The visual being dragged onto the phone, drawn under the pointer
  const [ghost, setGhost] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);

  const add = (id: string, cell?: { x: number; y: number }) =>
    dispatch(
      setMobileBoxes(pageId, (current, currentBoxes) =>
        addMobileBox(current, currentBoxes, id, cell),
      ) as never,
    );

  // Dragged with the pointer, not with the drag and drop of the browser:
  // the canvas already takes those, and this works with a finger too
  const startDrag = (
    event: ReactPointerEvent<HTMLElement>,
    id: string,
    name: string,
  ) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    const onMove = (move: PointerEvent) => {
      moved ||= Math.hypot(move.clientX - startX, move.clientY - startY) > 4;
      if (moved) setGhost({ name, x: move.clientX, y: move.clientY });
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setGhost(null);
      if (!moved) return;
      const phone = document
        .elementsFromPoint(up.clientX, up.clientY)
        .find(element =>
          element.matches(`[data-test="${MOBILE_EDITOR_TEST_ID}"]`),
        );
      if (!phone) return;
      const frame = phone.getBoundingClientRect();
      const scale =
        frame.width / ((phone as HTMLElement).offsetWidth || frame.width) || 1;
      add(
        id,
        mobileCellAt(
          (up.clientX - frame.left) / scale,
          (up.clientY - frame.top) / scale,
        ),
      );
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const remove = (id: string) =>
    dispatch(
      setMobileBoxes(pageId, (_, currentBoxes) =>
        removeMobileBox(currentBoxes, id),
      ) as never,
    );
  const clear = () => dispatch(setMobileBoxes(pageId, () => []) as never);

  return (
    <div
      data-test="mibi-mobile-pane"
      css={css`
        position: sticky;
        right: 0;
        top: ${topOffset}px;
        height: calc(100vh - ${topOffset + pageTop}px);
        width: ${BUILDER_SIDEPANEL_WIDTH}px;
        flex: none;
      `}
    >
      <Pane>
        <h4>{t('Mobile layout')}</h4>
        <p>
          {t(
            'Drag the visuals of this page onto the phone, then move and resize them. Phones show this layout; a page without one shows its canvas.',
          )}
        </p>
        {candidates.length ? (
          <ul aria-label={t('Visuals of the page')}>
            {candidates.map(id => {
              const isPlaced = placed.has(id);
              const name = objectName(layout[id], filters);
              return (
                <li
                  key={id}
                  className={isPlaced ? 'placed' : 'draggable'}
                  data-test="mibi-mobile-candidate"
                  data-id={id}
                  onPointerDown={
                    isPlaced ? undefined : event => startDrag(event, id, name)
                  }
                >
                  <span className="name" title={name}>
                    {name}
                  </span>
                  {isPlaced ? (
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      aria-label={t('Remove %s from the mobile layout', name)}
                      data-test="mibi-mobile-candidate-remove"
                      onClick={() => remove(id)}
                    >
                      {t('Remove from phone')}
                    </Button>
                  ) : (
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      aria-label={t('Add %s to the mobile layout', name)}
                      data-test="mibi-mobile-candidate-add"
                      onClick={() => add(id)}
                    >
                      {t('Add')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{t('This page has no visuals yet.')}</p>
        )}
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          disabled={!boxes.length}
          data-test="mibi-mobile-clear"
          onClick={clear}
        >
          <Icons.ClearOutlined iconSize="m" />
          {t('Clear the mobile layout')}
        </Button>
        <Button
          buttonStyle="primary"
          buttonSize="small"
          data-test="mibi-mobile-close"
          onClick={() => setMobileEditing(false)}
        >
          {t('Back to the canvas')}
        </Button>
      </Pane>
      {ghost && (
        <div
          data-test="mibi-mobile-ghost"
          css={(theme: SupersetTheme) => css`
            position: fixed;
            z-index: 2000;
            pointer-events: none;
            width: ${CELL * 6}px;
            padding: ${theme.sizeUnit * 2}px;
            border: 2px dashed ${theme.colorPrimary};
            border-radius: ${theme.borderRadius}px;
            background: ${theme.colorPrimaryBg};
            font-size: ${theme.fontSizeSM}px;
            transform: translate(-50%, -50%);
          `}
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.name}
        </div>
      )}
    </div>
  );
}
