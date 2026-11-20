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
  BinaryQueryObjectFilterClause,
  getColumnLabel,
} from '@superset-ui/core';
import { BubbleChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';

export default function EchartsBubble(props: BubbleChartTransformedProps) {
  const { height, width, echartOptions, refs, formData, onContextMenu } = props;

  const eventHandlers: EventHandlers = {
    contextmenu: (eventParams: {
      data?: unknown[];
      event?: { stop: () => void; event: PointerEvent };
    }) => {
      if (!onContextMenu || !Array.isArray(eventParams.data)) {
        return;
      }
      const drillToDetail: BinaryQueryObjectFilterClause[] = [];
      const entityCol = formData.entity
        ? getColumnLabel(formData.entity)
        : undefined;
      const seriesCol = formData.series
        ? getColumnLabel(formData.series)
        : undefined;
      if (entityCol && eventParams.data[3] != null) {
        drillToDetail.push({
          col: entityCol,
          op: '==',
          val: eventParams.data[3] as string | number | boolean,
          formattedVal: String(eventParams.data[3]),
        });
      }
      if (seriesCol && eventParams.data[4] != null) {
        drillToDetail.push({
          col: seriesCol,
          op: '==',
          val: eventParams.data[4] as string | number | boolean,
          formattedVal: String(eventParams.data[4]),
        });
      }
      if (!drillToDetail.length) return;
      const pointerEvent = eventParams.event?.event;
      if (!pointerEvent) return;
      eventParams.event?.stop();
      onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
        drillToDetail,
      });
    },
  };

  return (
    <Echart
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      refs={refs}
      vizType={formData.vizType}
    />
  );
}
