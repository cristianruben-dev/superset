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
import { memo, useCallback, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Input, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { activePageId } from 'src/auradata/present/dashboardTabs';
import { clearVisibilityOverride } from 'src/auradata/report/visibility';
import { GROUP_KEY, arrangeLayer, pageObjects } from './arrange';
import { objectName } from './objectName';
import { setComponentMeta } from './actions';
import { selectVisual, useSelectedVisuals } from './selection';

const Pane = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 3}px 0;

    .tools {
      display: flex;
      justify-content: space-between;
      gap: ${theme.sizeUnit}px;
    }

    .list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-bottom: ${theme.sizeUnit * 16}px;
    }

    .empty {
      padding: ${theme.sizeUnit * 4}px;
      text-align: center;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const Row = styled.div<{ $selected: boolean; $hidden: boolean }>`
  ${({ theme, $selected, $hidden }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    min-height: ${theme.sizeUnit * 8}px;
    padding: 0 ${theme.sizeUnit}px 0 ${theme.sizeUnit * 2}px;
    border-radius: ${theme.borderRadius}px;
    background: ${$selected ? theme.colorPrimaryBg : 'transparent'};
    cursor: pointer;

    &:hover {
      background: ${$selected ? theme.colorPrimaryBg : theme.colorFillTertiary};
    }

    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: ${theme.fontSizeSM}px;
      color: ${$hidden ? theme.colorTextTertiary : theme.colorText};
    }

    .ant-btn {
      flex: none;
      min-width: ${theme.sizeUnit * 6}px;
      padding: 0;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

function RowButton({
  title,
  active,
  onClick,
  icon,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  icon: JSX.Element;
}) {
  return (
    <Tooltip title={title}>
      <Button
        buttonStyle="link"
        buttonSize="xsmall"
        aria-label={title}
        aria-pressed={active}
        onClick={event => {
          event.stopPropagation();
          onClick();
        }}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}

const SelectionRow = memo(function SelectionRow({
  id,
  pageId,
  selected,
  filters,
  onSetHidden,
}: {
  id: string;
  pageId: string;
  selected: boolean;
  filters?: Record<string, { name?: string }>;
  onSetHidden: (id: string, hidden: boolean) => void;
}) {
  const dispatch = useDispatch();
  const row = useSelector((state: RootState) => {
    const item = state.dashboardLayout.present[id];
    if (!item) return null;
    const { meta } = item;
    return {
      hidden: !!meta?.auradataHidden,
      locked: !!meta?.auradataLocked,
      grouped: !!meta?.[GROUP_KEY],
      label: objectName(item, filters),
    };
  }, shallowEqual);
  if (!row) return null;
  const { hidden, locked, grouped, label } = row;

  return (
    <Row
      data-test="auradata-selection-row"
      $selected={selected}
      $hidden={hidden}
      onClick={event =>
        selectVisual(id, event.shiftKey || event.metaKey || event.ctrlKey)
      }
    >
      <span className="name" title={label}>
        {grouped ? '▣ ' : ''}
        {label}
      </span>
      <RowButton
        title={t('Bring forward')}
        icon={<Icons.ArrowUpOutlined iconSize="s" />}
        onClick={() => dispatch(arrangeLayer(pageId, id, 'forward') as never)}
      />
      <RowButton
        title={t('Send backward')}
        icon={<Icons.ArrowDownOutlined iconSize="s" />}
        onClick={() => dispatch(arrangeLayer(pageId, id, 'backward') as never)}
      />
      <RowButton
        title={locked ? t('Unlock') : t('Lock')}
        active={locked}
        icon={
          locked ? (
            <Icons.LockOutlined iconSize="s" />
          ) : (
            <Icons.UnlockOutlined iconSize="s" />
          )
        }
        onClick={() =>
          dispatch(
            setComponentMeta(
              id,
              'auradataLocked',
              locked ? undefined : true,
              `lock:${id}:${Date.now()}`,
            ),
          )
        }
      />
      <RowButton
        title={hidden ? t('Show') : t('Hide')}
        active={hidden}
        icon={
          hidden ? (
            <Icons.EyeInvisibleOutlined iconSize="s" />
          ) : (
            <Icons.EyeOutlined iconSize="s" />
          )
        }
        onClick={() => onSetHidden(id, !hidden)}
      />
    </Row>
  );
});

/**
 * The Selection pane: every object of the open page, front to back, to pick
 * it, hide it from viewers, lock it or change its stacking order.
 */
export function SelectionPane() {
  const dispatch = useDispatch();
  const pageId = useSelector((state: RootState) =>
    activePageId(
      state.dashboardLayout.present,
      state.dashboardState.activeTabs,
    ),
  );
  const filters = useSelector(
    (state: RootState) =>
      state.nativeFilters?.filters as
        | Record<string, { name?: string }>
        | undefined,
  );
  const picked = useSelectedVisuals();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const order = useSelector(
    (state: RootState) =>
      pageObjects(state.dashboardLayout.present, pageId).reverse(),
    shallowEqual,
  );
  const shown = useSelector((state: RootState) => {
    if (!normalizedQuery) return order;
    const layout = state.dashboardLayout.present;
    return order.filter(id =>
      objectName(layout[id], filters).toLowerCase().includes(normalizedQuery),
    );
  }, shallowEqual);

  const setHidden = useCallback(
    (id: string, hidden: boolean, group = `hide:${id}:${Date.now()}`) => {
      clearVisibilityOverride(id);
      dispatch(
        setComponentMeta(id, 'auradataHidden', hidden || undefined, group),
      );
    },
    [dispatch],
  );
  // One undo step for the whole page
  const setAllHidden = (hidden: boolean) => {
    const group = `hide-all:${Date.now()}`;
    order.forEach(id => setHidden(id, hidden, group));
  };

  return (
    <Pane data-test="auradata-selection-pane">
      <Input
        allowClear
        size="small"
        value={query}
        placeholder={t('Search')}
        prefix={<Icons.SearchOutlined iconSize="s" />}
        aria-label={t('Search objects')}
        onChange={event => setQuery(event.target.value)}
      />
      <div className="tools">
        <Button
          buttonStyle="link"
          buttonSize="xsmall"
          data-test="auradata-selection-show-all"
          onClick={() => setAllHidden(false)}
        >
          {t('Show all')}
        </Button>
        <Button
          buttonStyle="link"
          buttonSize="xsmall"
          data-test="auradata-selection-hide-all"
          onClick={() => setAllHidden(true)}
        >
          {t('Hide all')}
        </Button>
      </div>
      <div className="list">
        {!shown.length && (
          <div className="empty">{t('No objects on this page')}</div>
        )}
        {shown.map(id => (
          <SelectionRow
            key={id}
            id={id}
            pageId={pageId}
            selected={picked.includes(id)}
            filters={filters}
            onSetHidden={setHidden}
          />
        ))}
      </div>
    </Pane>
  );
}
