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

import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { elementName } from 'src/mibi/elements/ElementFormat';
import { elementKind } from 'src/mibi/elements/types';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';
import {
  alignObjects,
  arrangeLayer,
  distributeObjects,
  GROUP_KEY,
  groupObjects,
  matchSize,
  pageObjects,
  type AlignMode,
} from './arrange';
import { Section } from './controls';
import {
  selectVisual,
  useSelectedVisual,
  useSelectedVisuals,
} from './selection';

const Row = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 1.5}px;
  `}
`;

const Layer = styled.div<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid
      ${$selected ? theme.colorPrimary : theme.colorBorderSecondary};
    cursor: pointer;
    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

const ALIGNS: [AlignMode, string][] = [
  ['left', t('Align left')],
  ['center', t('Align center')],
  ['right', t('Align right')],
  ['top', t('Align top')],
  ['middle', t('Align middle')],
  ['bottom', t('Align bottom')],
];

const nameOf = (item: LayoutItem | undefined) => {
  if (!item) return '';
  if (item.type === CHART_TYPE) {
    return String(
      item.meta?.sliceNameOverride || item.meta?.sliceName || t('Chart'),
    );
  }
  const kind = elementKind(item.meta?.componentKey);
  return kind ? elementName(kind) : t('Text box');
};

/** Several objects picked: align, distribute, match size and group them. */
export function MultiSection() {
  const dispatch = useDispatch();
  const ids = useSelectedVisuals();
  const primary = useSelectedVisual();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const grouped = ids.some(id => layout[id]?.meta?.[GROUP_KEY]);
  return (
    <Section data-test="mibi-format-multi">
      <h4>{t('%s objects selected', ids.length)}</h4>
      <Row>
        {ALIGNS.map(([mode, label]) => (
          <Button
            key={mode}
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(alignObjects(ids, mode))}
          >
            {label}
          </Button>
        ))}
      </Row>
      <Row>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          disabled={ids.length < 3}
          onClick={() => dispatch(distributeObjects(ids, 'horizontal'))}
        >
          {t('Distribute horizontally')}
        </Button>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          disabled={ids.length < 3}
          onClick={() => dispatch(distributeObjects(ids, 'vertical'))}
        >
          {t('Distribute vertically')}
        </Button>
      </Row>
      {primary && (
        <Row>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(matchSize(ids, primary, 'width'))}
          >
            {t('Same width')}
          </Button>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(matchSize(ids, primary, 'height'))}
          >
            {t('Same height')}
          </Button>
        </Row>
      )}
      <Row>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          onClick={() => dispatch(groupObjects(ids, true))}
        >
          {t('Group')}
        </Button>
        {grouped && (
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(groupObjects(ids, false))}
          >
            {t('Ungroup')}
          </Button>
        )}
      </Row>
    </Section>
  );
}

/** The objects of the open page, front to back, with their stacking order. */
export function LayersSection() {
  const dispatch = useDispatch();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const picked = useSelectedVisuals();
  const page = topLevelTabs(layout).find(tab => activeTabs?.includes(tab.id));
  const pageId = page?.id;
  const order = pageObjects(layout, pageId).reverse();
  if (!order.length) return null;
  return (
    <Section data-test="mibi-format-layers">
      <h4>{t('Layers')}</h4>
      {order.map(id => (
        <Layer
          key={id}
          $selected={picked.includes(id)}
          onClick={event =>
            selectVisual(id, event.shiftKey || event.metaKey || event.ctrlKey)
          }
        >
          <span className="name">
            {layout[id]?.meta?.[GROUP_KEY] ? '▣ ' : ''}
            {nameOf(layout[id])}
          </span>
          <Button
            buttonStyle="link"
            buttonSize="xsmall"
            aria-label={t('Bring forward')}
            onClick={event => {
              event.stopPropagation();
              dispatch(arrangeLayer(pageId, id, 'forward'));
            }}
          >
            <Icons.ArrowUpOutlined iconSize="s" />
          </Button>
          <Button
            buttonStyle="link"
            buttonSize="xsmall"
            aria-label={t('Send backward')}
            onClick={event => {
              event.stopPropagation();
              dispatch(arrangeLayer(pageId, id, 'backward'));
            }}
          >
            <Icons.ArrowDownOutlined iconSize="s" />
          </Button>
        </Layer>
      ))}
    </Section>
  );
}
