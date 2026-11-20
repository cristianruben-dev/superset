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
import { BinaryQueryObjectFilterClause } from '@superset-ui/core';
import { HeatmapTransformedProps } from './types';
import { EventHandlers } from '../types';
import Echart from '../components/Echart';

export default function Heatmap(props: HeatmapTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    refs,
    formData,
    onContextMenu,
    xAxisColumnName,
    yAxisColumnName,
    sortedXAxisValues,
    sortedYAxisValues,
  } = props;

  const eventHandlers: EventHandlers = {
    contextmenu: (eventParams: {
      value?: (string | number)[];
      event?: { stop: () => void; event: PointerEvent };
    }) => {
      if (!onContextMenu || !Array.isArray(eventParams.value)) return;
      const pointerEvent = eventParams.event?.event;
      if (!pointerEvent) return;
      const [xIndex, yIndex] = eventParams.value as [number, number];
      const xVal = sortedXAxisValues[xIndex];
      const yVal = sortedYAxisValues[yIndex];
      const drillToDetail: BinaryQueryObjectFilterClause[] = [];
      if (xAxisColumnName && xVal !== null && xVal !== undefined) {
        drillToDetail.push({
          col: xAxisColumnName,
          op: '==',
          val: xVal as string | number | boolean,
          formattedVal: String(xVal),
        });
      }
      if (yAxisColumnName && yVal !== null && yVal !== undefined) {
        drillToDetail.push({
          col: yAxisColumnName,
          op: '==',
          val: yVal as string | number | boolean,
          formattedVal: String(yVal),
        });
      }
      if (!drillToDetail.length) return;
      eventParams.event?.stop();
      onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
        drillToDetail,
      });
    },
  };

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      vizType={formData.vizType}
    />
  );
}
