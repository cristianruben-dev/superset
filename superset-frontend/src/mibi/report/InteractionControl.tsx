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
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Behavior, getChartMetadataRegistry } from '@superset-ui/core';
import type { RootState } from 'src/dashboard/types';
import { useSelectedVisual } from 'src/mibi/format/selection';
import {
  INTERACTION_CONTROL,
  interactionMode,
  setEditingInteractions,
  setInteraction,
  useEditingInteractions,
  type InteractionMode,
} from './interactions';

const Bar = styled.div`
  ${({ theme }) => css`
    /* Centered on top: the chart's own header icons sit on the right */
    position: absolute;
    top: ${theme.sizeUnit * 2}px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid ${theme.colorBorder};
    background: ${theme.colorBgElevated};
    box-shadow: ${theme.boxShadowSecondary};
  `}
`;

const Choice = styled.button<{ $on: boolean }>`
  ${({ theme, $on }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: ${$on ? theme.colorPrimary : 'transparent'};
    color: ${$on ? theme.colorTextLightSolid : theme.colorTextSecondary};
    cursor: pointer;

    &:hover {
      color: ${$on ? theme.colorTextLightSolid : theme.colorPrimary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
    }
  `}
`;

/**
 * Shown on every other chart while "Edit interactions" is on: whether the
 * selected chart filters this one or leaves it alone.
 */
export function InteractionControl({
  chartId,
  layoutId,
}: {
  chartId: number;
  layoutId: string;
}) {
  const dispatch = useDispatch();
  const editing = useEditingInteractions();
  const selected = useSelectedVisual();
  const sourceId = useSelector<RootState, number | undefined>(state =>
    selected
      ? state.dashboardLayout.present[selected]?.meta?.chartId
      : undefined,
  );
  const metadata = useSelector<
    RootState,
    RootState['dashboardInfo']['metadata']
  >(state => state.dashboardInfo.metadata);
  if (!editing || sourceId === undefined || selected === layoutId) return null;

  const mode = interactionMode(metadata, sourceId, chartId);
  const choose = (next: InteractionMode) => () =>
    dispatch(setInteraction(sourceId, chartId, next) as never);
  const props = { [INTERACTION_CONTROL]: true };

  return (
    <Bar {...props} role="group" aria-label={t('Interaction')}>
      <Tooltip title={t('Filter')}>
        <Choice
          type="button"
          $on={mode === 'filter'}
          aria-pressed={mode === 'filter'}
          aria-label={t('Filter')}
          data-test="mibi-interaction-filter"
          onClick={choose('filter')}
        >
          <Icons.FilterOutlined iconSize="m" />
        </Choice>
      </Tooltip>
      <Tooltip title={t('None')}>
        <Choice
          type="button"
          $on={mode === 'none'}
          aria-pressed={mode === 'none'}
          aria-label={t('None')}
          data-test="mibi-interaction-none"
          onClick={choose('none')}
        >
          <Icons.StopOutlined iconSize="m" />
        </Choice>
      </Tooltip>
    </Bar>
  );
}

const ModeToggle = styled.button<{ $on: boolean }>`
  ${({ theme, $on }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: ${theme.borderRadius}px;
    background: ${$on ? theme.colorPrimaryBg : theme.colorFillTertiary};
    color: ${$on ? theme.colorPrimary : theme.colorTextSecondary};
    cursor: pointer;

    &:hover {
      color: ${theme.colorPrimary};
    }
  `}
`;

/**
 * Turns "Edit interactions" on and off, for the chart in the Format pane.
 * Only for chart types that can cross-filter.
 */
export function EditInteractionsToggle({ chartId }: { chartId?: number }) {
  const editing = useEditingInteractions();
  const interactive = useSelector<RootState, boolean>(state => {
    const vizType = chartId
      ? state.charts[chartId]?.form_data?.viz_type
      : undefined;
    return !!getChartMetadataRegistry()
      .get(vizType)
      ?.behaviors?.includes(Behavior.InteractiveChart);
  });
  if (!interactive) return null;
  return (
    <Tooltip
      title={
        editing
          ? t('Stop editing interactions')
          : t('Edit interactions: choose which charts this one filters')
      }
    >
      <ModeToggle
        type="button"
        $on={editing}
        aria-pressed={editing}
        aria-label={t('Edit interactions')}
        data-test="mibi-edit-interactions"
        onClick={() => setEditingInteractions(!editing)}
      >
        <Icons.ApartmentOutlined iconSize="m" />
      </ModeToggle>
    </Tooltip>
  );
}
