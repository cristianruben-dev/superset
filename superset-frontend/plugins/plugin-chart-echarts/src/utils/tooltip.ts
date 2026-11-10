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

import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  QueryFormColumn,
  QueryFormMetric,
  getColumnLabel,
  getMetricLabel,
} from '@superset-ui/core';
import { TOOLTIP_OVERFLOW_MARGIN } from '../constants';
import { Refs } from '../types';

export function getDefaultTooltip(refs: Refs) {
  return {
    appendToBody:
      typeof document !== 'undefined' ? !document.fullscreenElement : true,
    borderColor: 'transparent',
    // CSS hack applied on this class to resolve https://github.com/apache/superset/issues/30058
    className: 'echarts-tooltip',
    // The tooltip is a readout: it is never entered with the pointer
    enterable: false,
    // keep within viewport and above header
    confine: true,
    position: (
      canvasMousePos: [number, number],
      params: CallbackDataParams,
      tooltipDom: HTMLDivElement | null,
      rect: any,
      sizes: { contentSize: [number, number]; viewSize: [number, number] },
    ) => {
      const divRect = refs.divRef?.current?.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const chartWidth = divRect?.width || viewportWidth;
      const chartHeight = divRect?.height || viewportHeight;
      const [tooltipWidth, tooltipHeight] = sizes.contentSize;

      // A long tooltip scrolls inside its own cap instead of covering the screen
      const maxAllowedHeight = Math.min(800, Math.floor(viewportHeight * 0.8));

      if (tooltipDom) {
        tooltipDom.style.maxHeight = `${maxAllowedHeight}px`;
        tooltipDom.style.overflow = 'auto';
        // Never receives the pointer, so it cannot be touched by accident and
        // clicks and hovers reach the chart underneath
        tooltipDom.style.pointerEvents = 'none';
      }

      const effectiveTooltipHeight = Math.min(tooltipHeight, maxAllowedHeight);
      const margin = TOOLTIP_OVERFLOW_MARGIN;

      // The corner opposite to the cursor, so the tooltip never sits under the
      // hand and never blocks what the pointer moves towards
      const [cursorX, cursorY] = canvasMousePos;
      const x =
        cursorX > chartWidth / 2 ? margin : chartWidth - tooltipWidth - margin;
      const y =
        cursorY > chartHeight / 2
          ? margin
          : chartHeight - effectiveTooltipHeight - margin;

      // Returned relative to the chart, which is the frame ECharts expects
      return [Math.max(margin, x), Math.max(margin, y)];
    },
  };
}

export function getTooltipLabels({
  tooltipMetrics,
  tooltipColumns,
}: {
  tooltipMetrics?: QueryFormMetric[];
  tooltipColumns?: QueryFormColumn[];
}) {
  return [
    ...(tooltipMetrics ?? []).map(v => getMetricLabel(v)),
    ...(tooltipColumns ?? []).map(v => getColumnLabel(v)),
  ];
}
