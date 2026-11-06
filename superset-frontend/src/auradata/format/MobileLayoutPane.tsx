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
import { Button, Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { BUILDER_SIDEPANEL_WIDTH } from 'src/dashboard/constants';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { elementKind } from 'src/auradata/elements/types';
import { VizTypeTile } from 'src/auradata/vizIcons/VizTypeIcon';
import { activePageId } from 'src/auradata/present/dashboardTabs';
import {
  selectMobileBox,
  setMobileEditing,
  useSelectedMobileBox,
} from './mobile';
import { useMobileViewSettings } from './mobileDevices';
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
    background-color: ${theme.colorBgContainer};
    box-shadow: -${theme.sizeUnit}px 0 ${theme.sizeUnit}px 0
      ${theme.colorBorderSecondary};
    header,
    footer {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 4}px;
    }
    header {
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }
    footer {
      border-top: 1px solid ${theme.colorBorderSecondary};
    }
    .body {
      flex: 1;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    }
    h4 {
      margin: 0;
      font-size: ${theme.fontSizeLG}px;
    }
    h5 {
      margin: 0;
      font-size: 11px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: ${theme.colorTextTertiary};
      font-family: 'Geist Mono', ${theme.fontFamilyCode};
    }
    p {
      margin: 0;
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
    }
    .progress {
      height: 4px;
      border-radius: 2px;
      background: ${theme.colorFillSecondary};
      overflow: hidden;
    }
    .progress > span {
      display: block;
      height: 100%;
      background: ${theme.colorPrimary};
      transition: width 0.2s;
    }
    .actions {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
    }
    .actions > * {
      flex: 1;
    }
    .notice {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorInfoBg};
      color: ${theme.colorText};
      font-size: ${theme.fontSizeSM}px;
    }
    .notice .anticon {
      color: ${theme.colorInfo};
      margin-top: 2px;
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
      transition:
        border-color 0.15s,
        background 0.15s;
    }
    li.draggable {
      cursor: grab;
      touch-action: none;
    }
    li.draggable:hover {
      border-color: ${theme.colorPrimaryBorder};
    }
    li.placed {
      cursor: pointer;
    }
    li.placed.selected {
      border-color: ${theme.colorPrimary};
      background: ${theme.colorPrimaryBg};
    }
    li .grip {
      color: ${theme.colorTextQuaternary};
    }
    li .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    li .meta {
      font-size: 11px;
      color: ${theme.colorTextTertiary};
      font-family: 'Geist Mono', ${theme.fontFamilyCode};
    }
    .keys {
      font-size: 11px;
      color: ${theme.colorTextTertiary};
    }
    kbd {
      padding: 0 4px;
      border-radius: 3px;
      border: 1px solid ${theme.colorBorder};
      font-family: 'Geist Mono', ${theme.fontFamilyCode};
      font-size: 10px;
    }
  `}
`;

/** The icon of an object of the page: its chart type, or its kind of element. */
function ObjectIcon({ item }: { item: LayoutItem | undefined }) {
  const vizType = useSelector((state: RootState) =>
    item?.type === CHART_TYPE
      ? state.sliceEntities?.slices?.[item.meta?.chartId ?? -1]?.viz_type
      : undefined,
  );
  if (item?.type === CHART_TYPE) {
    return <VizTypeTile vizType={vizType} size="s" />;
  }
  const kind = elementKind(item?.meta?.componentKey);
  const icons = {
    text: Icons.FontSizeOutlined,
    image: Icons.FileImageOutlined,
    shape: Icons.BorderOutlined,
    button: Icons.LinkOutlined,
    filter: Icons.FilterOutlined,
    navigator: Icons.MenuOutlined,
  } as const;
  const Icon = kind ? icons[kind] : Icons.FontSizeOutlined;
  return (
    <span
      css={(theme: SupersetTheme) => css`
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        color: ${theme.colorTextSecondary};
        background: ${theme.colorFillTertiary};
      `}
    >
      <Icon iconSize="m" />
    </span>
  );
}

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
  const selected = useSelectedMobileBox();
  const { mode } = useMobileViewSettings();
  const [search, setSearch] = useState('');
  const names = useMemo(
    () =>
      Object.fromEntries(
        candidates.map(id => [id, objectName(layout[id], filters)]),
      ),
    [candidates, layout, filters],
  );
  const matches = (id: string) =>
    !search.trim() ||
    names[id].toLowerCase().includes(search.trim().toLowerCase());
  // Placed objects in the order they read on the phone, from the top
  const onPhone = [...boxes]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .filter(box => matches(box.id));
  const offPhone = candidates.filter(id => !placed.has(id) && matches(id));
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
  const addAll = () =>
    dispatch(
      setMobileBoxes(pageId, (current, currentBoxes) =>
        candidates.reduce(
          (next, id) => addMobileBox(current, next, id),
          currentBoxes,
        ),
      ) as never,
    );

  return (
    <div
      data-test="auradata-mobile-pane"
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
        <header>
          <h4>{t('Mobile layout')}</h4>
          <p>
            {t(
              'Drag the visuals of this page onto the phone, then move and resize them. Phones show this layout; a page without one shows its canvas.',
            )}
          </p>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={candidates.length}
            aria-valuenow={boxes.length}
            aria-label={t('Visuals on the phone')}
          >
            <span
              style={{
                width: `${
                  candidates.length
                    ? (boxes.length / candidates.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <p data-test="auradata-mobile-count">
            {t(
              '%s of %s visuals on the phone',
              boxes.length,
              candidates.length,
            )}
          </p>
          <div className="actions">
            <Button
              buttonStyle="secondary"
              buttonSize="small"
              disabled={boxes.length === candidates.length}
              data-test="auradata-mobile-add-all"
              onClick={addAll}
            >
              <Icons.PlusOutlined iconSize="m" />
              {t('Add all')}
            </Button>
            <Button
              buttonStyle="secondary"
              buttonSize="small"
              disabled={!boxes.length}
              data-test="auradata-mobile-clear"
              onClick={clear}
            >
              <Icons.ClearOutlined iconSize="m" />
              {t('Empty the phone')}
            </Button>
          </div>
        </header>
        <div className="body">
          {mode === 'preview' && (
            <div className="notice" data-test="auradata-mobile-preview-notice">
              <Icons.EyeOutlined iconSize="m" />
              <span>
                {boxes.length
                  ? t('Preview: the phone shows the page as a viewer sees it.')
                  : t(
                      'This page has no mobile layout yet: phones show its canvas, scaled to their width.',
                    )}
              </span>
            </div>
          )}
          {candidates.length > 6 && (
            <Input
              allowClear
              placeholder={t('Search visuals')}
              prefix={<Icons.SearchOutlined iconSize="m" />}
              value={search}
              onChange={event => setSearch(event.target.value)}
              data-test="auradata-mobile-search"
            />
          )}
          {!candidates.length && <p>{t('This page has no visuals yet.')}</p>}
          {!!boxes.length && (
            <section>
              <h5>{t('On the phone')}</h5>
              <ul aria-label={t('On the phone')}>
                {onPhone.map(box => (
                  // The row is a pointer shortcut; the Place tab has the keyboard path
                  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                  <li
                    key={box.id}
                    className={
                      selected === box.id ? 'placed selected' : 'placed'
                    }
                    data-test="auradata-mobile-candidate"
                    data-id={box.id}
                    onClick={() => {
                      selectMobileBox(box.id);
                      // Keep the chosen object in sight on the phone
                      document
                        .querySelector(
                          `[data-test="auradata-mobile-box"][data-id="${box.id}"]`,
                        )
                        ?.scrollIntoView?.({
                          block: 'nearest',
                          behavior: 'smooth',
                        });
                    }}
                  >
                    <ObjectIcon item={layout[box.id]} />
                    <span className="name" title={names[box.id]}>
                      {names[box.id]}
                    </span>
                    <span className="meta">
                      {box.width}×{box.height}
                    </span>
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      aria-label={t(
                        'Remove %s from the mobile layout',
                        names[box.id],
                      )}
                      data-test="auradata-mobile-candidate-remove"
                      onClick={event => {
                        event.stopPropagation();
                        remove(box.id);
                      }}
                    >
                      {t('Remove from phone')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {candidates.length > boxes.length && (
            <section>
              <h5>{t('Not on the phone')}</h5>
              <ul aria-label={t('Visuals of the page')}>
                {offPhone.map(id => (
                  <li
                    key={id}
                    className="draggable"
                    data-test="auradata-mobile-candidate"
                    data-id={id}
                    title={t('Drag onto the phone')}
                    onPointerDown={event => startDrag(event, id, names[id])}
                  >
                    <Icons.MoreOutlined className="grip" iconSize="m" />
                    <ObjectIcon item={layout[id]} />
                    <span className="name">{names[id]}</span>
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      aria-label={t('Add %s to the mobile layout', names[id])}
                      data-test="auradata-mobile-candidate-add"
                      onClick={() => add(id)}
                    >
                      {t('Add')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {search && !onPhone.length && !offPhone.length && (
            <p>{t('No visual matches the search.')}</p>
          )}
        </div>
        <footer>
          <div className="keys">
            <kbd>←↑→↓</kbd> {t('move')} · <kbd>⇧</kbd>+<kbd>←↑→↓</kbd>{' '}
            {t('resize')} · <kbd>{t('Del')}</kbd> {t('remove')}
          </div>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            data-test="auradata-mobile-close"
            onClick={() => setMobileEditing(false)}
          >
            <Icons.DesktopOutlined iconSize="m" />
            {t('Back to the canvas')}
          </Button>
        </footer>
      </Pane>
      {ghost && (
        <div
          data-test="auradata-mobile-ghost"
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
