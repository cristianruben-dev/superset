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
import { getChartMetadataRegistry } from '@superset-ui/core';
import { EmptyState } from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { openChartEditor } from 'src/mibi/chartEditor';

/**
 * Chart types AuraData BI stopped registering (`feat/trim-chart-plugins`),
 * by name, so the notice names them as they were known.
 */
const REMOVED_CHART_TYPES: Record<string, string> = {
  bubble: 'Bubble Chart (legacy)',
  compare: 'Time-series Percent Change',
  horizon: 'Horizon Chart',
  paired_ttest: 'Paired t-test Table',
  para: 'Parallel Coordinates',
  partition: 'Partition Chart',
  rose: 'Nightingale Rose Chart',
  time_pivot: 'Time-series Period Pivot',
  time_table: 'Time-series Table',
};

/**
 * True when no chart plugin draws charts of this type. False before the
 * plugins are registered, when no type is known yet.
 */
export function isUnavailableChartType(vizType?: string): boolean {
  const registry = getChartMetadataRegistry();
  return !!vizType && registry.keys().length > 0 && !registry.has(vizType);
}

/** Name of a chart type that is no longer available. */
export function unavailableChartTypeName(vizType: string): string {
  return REMOVED_CHART_TYPES[vizType] ?? vizType;
}

interface UnavailableChartProps {
  chartId: number;
  vizType: string;
  height: number;
  /** The user may edit the chart, so it may change its type */
  canChangeType: boolean;
}

/**
 * Drawn in place of a chart whose type no longer exists, instead of the
 * "not registered" error: says so and lets editors pick another type.
 */
export default function UnavailableChart({
  chartId,
  vizType,
  height,
  canChangeType,
}: UnavailableChartProps) {
  return (
    <div
      data-test="unavailable-chart"
      style={{ height, display: 'flex', alignItems: 'center' }}
    >
      <EmptyState
        size="small"
        image="chart.svg"
        title={t('This chart type is no longer available')}
        description={
          canChangeType
            ? t(
                '%s charts were removed. Change its type to show it again.',
                unavailableChartTypeName(vizType),
              )
            : t(
                '%s charts were removed. Ask an editor of the report to change its type.',
                unavailableChartTypeName(vizType),
              )
        }
        buttonText={canChangeType ? t('Change chart type') : undefined}
        buttonAction={
          canChangeType
            ? () =>
                openChartEditor({
                  url: `/explore/?slice_id=${chartId}`,
                  chartId,
                })
            : undefined
        }
      />
    </div>
  );
}
