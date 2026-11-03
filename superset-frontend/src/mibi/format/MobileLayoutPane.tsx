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
import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { BUILDER_SIDEPANEL_WIDTH } from 'src/dashboard/constants';
import type { RootState } from 'src/dashboard/types';
import { activePageId } from 'src/mibi/present/dashboardTabs';
import { setMobileEditing } from './mobile';
import {
  addMobileBox,
  mobileCandidates,
  mobileLayoutOf,
  removeMobileBox,
} from './mobileLayout';
import { MOBILE_DRAG_TYPE, setMobileBoxes } from './MobileLayoutEditor';
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
    li[draggable='true'] {
      cursor: grab;
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

  const add = (id: string) =>
    dispatch(
      setMobileBoxes(pageId, (current, currentBoxes) =>
        addMobileBox(current, currentBoxes, id),
      ) as never,
    );
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
                  className={isPlaced ? 'placed' : undefined}
                  draggable={!isPlaced}
                  data-test="mibi-mobile-candidate"
                  data-id={id}
                  onDragStart={event => {
                    event.dataTransfer.setData(MOBILE_DRAG_TYPE, id);
                    // eslint-disable-next-line no-param-reassign
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
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
                      {t('Remove')}
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
    </div>
  );
}
