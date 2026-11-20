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
import Echart from '../components/Echart';
import { ASSIST_MARK } from './constants';
import { WaterfallChartTransformedProps } from './types';
import { EventHandlers } from '../types';

export default function EchartsWaterfall(
  props: WaterfallChartTransformedProps,
) {
  const {
    height,
    width,
    echartOptions,
    refs,
    onLegendStateChanged,
    onContextMenu,
    drillTargets,
    formData,
  } = props;

  const eventHandlers: EventHandlers = {
    legendselectchanged: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendselectall: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendinverseselect: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    contextmenu: (eventParams: {
      seriesName?: string;
      dataIndex?: number;
      event?: { stop: () => void; event: PointerEvent };
    }) => {
      if (
        !onContextMenu ||
        eventParams.seriesName === ASSIST_MARK ||
        eventParams.dataIndex == null
      ) {
        return;
      }
      const targets = drillTargets?.[eventParams.dataIndex] ?? [];
      if (!targets.length) return;
      const pointerEvent = eventParams.event?.event;
      if (!pointerEvent) return;
      eventParams.event?.stop();
      const drillToDetail: BinaryQueryObjectFilterClause[] = targets.map(
        target => ({
          col: target.col,
          op: '==',
          val: target.val as string | number | boolean,
          formattedVal: target.formattedVal,
          ...(target.grain ? { grain: target.grain } : {}),
        }),
      );
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
