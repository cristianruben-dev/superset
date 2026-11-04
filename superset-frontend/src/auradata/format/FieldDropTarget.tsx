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
import { useDroppable } from '@dnd-kit/core';
import { useSelector } from 'react-redux';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import type { ColumnMeta, Metric } from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/common';
import type { RootState } from 'src/dashboard/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import {
  useActiveDrag,
  useIsDragging,
} from 'src/explore/components/ExploreContainer/ExploreDndContext';
import type { DataField } from './chartFields';
import { useChartFieldToggle } from './ChartFieldsSections';
import { draggedField } from './DataPane';

const FIELD_TYPES = [DndItemType.Column, DndItemType.Metric];

type FieldItem = { type: DndItemType; value: ColumnMeta | Metric };

const Zone = styled.div<{ $over: boolean; $takes: boolean }>`
  ${({ theme, $over, $takes }) => css`
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed
      ${$takes ? theme.colorPrimary : theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
    background: ${$over && $takes ? theme.colorPrimaryBg : 'transparent'};
    color: ${theme.colorPrimary};
    font-weight: ${theme.fontWeightStrong};
    pointer-events: auto;
  `}
`;

const fieldOf = (item: FieldItem): DataField =>
  item.type === DndItemType.Metric
    ? { kind: 'metric', name: (item.value as Metric).metric_name }
    : {
        kind: 'column',
        name: (item.value as ColumnMeta).column_name,
        numeric:
          (item.value as ColumnMeta).type_generic === GenericDataType.Numeric,
        value: item.value,
      };

/** The zone over one chart while a field is dragged, built only then. */
function ChartFieldZone({ id, chartId }: { id: string; chartId: number }) {
  const { ready, toggle } = useChartFieldToggle(id, chartId);
  const dataset = useSelector(
    (state: RootState) =>
      (
        state.charts as unknown as Record<
          number,
          { form_data?: { datasource?: string } }
        >
      )[chartId]?.form_data?.datasource,
  );
  // A chart only takes fields of its own dataset
  const takes =
    ready && (!draggedField.dataset || draggedField.dataset === dataset);
  const { setNodeRef, isOver: over } = useDroppable({
    id: `mibi-field-drop-${id}`,
    data: {
      accept: FIELD_TYPES,
      canDrop: () => takes,
      onDrop: (item: FieldItem) => {
        toggle(fieldOf(item), true);
      },
    },
  });
  return (
    <Zone
      ref={setNodeRef}
      $over={over}
      $takes={takes}
      data-test="mibi-field-drop-zone"
    >
      {over &&
        (takes
          ? t('Drop to add it to this chart')
          : t('This chart uses another table'))}
    </Zone>
  );
}

/**
 * Lets a field of the Data pane be dropped on a chart of the canvas, as Power BI
 * does: it goes to the well the chart would choose for it.
 */
export function FieldDropTarget({
  id,
  chartId,
}: {
  id: string;
  chartId: number;
}) {
  const isDragging = useIsDragging();
  const active = useActiveDrag();
  const dragging =
    isDragging && FIELD_TYPES.includes(active?.type as DndItemType);
  return dragging ? <ChartFieldZone id={id} chartId={chartId} /> : null;
}
