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
import { SankeyTransformedProps } from './types';
import { EventHandlers } from '../types';
import Echart from '../components/Echart';

export default function Sankey(props: SankeyTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    refs,
    formData,
    onContextMenu,
    sourceNodes,
    targetNodes,
  } = props;

  const eventHandlers: EventHandlers = {
    contextmenu: (eventParams: {
      dataType?: string;
      name?: string;
      data?: { source?: string; target?: string };
      event?: { stop: () => void; event: PointerEvent };
    }) => {
      if (!onContextMenu) return;
      const pointerEvent = eventParams.event?.event;
      if (!pointerEvent) return;
      const sourceCol = formData.source
        ? getColumnLabel(formData.source)
        : undefined;
      const targetCol = formData.target
        ? getColumnLabel(formData.target)
        : undefined;
      const drillToDetail: BinaryQueryObjectFilterClause[] = [];
      if (
        eventParams.dataType === 'edge' ||
        (eventParams.data?.source && eventParams.data?.target)
      ) {
        if (sourceCol && eventParams.data?.source) {
          drillToDetail.push({
            col: sourceCol,
            op: '==',
            val: eventParams.data.source,
            formattedVal: eventParams.data.source,
          });
        }
        if (targetCol && eventParams.data?.target) {
          drillToDetail.push({
            col: targetCol,
            op: '==',
            val: eventParams.data.target,
            formattedVal: eventParams.data.target,
          });
        }
      } else if (eventParams.name) {
        if (sourceCol && sourceNodes.includes(eventParams.name)) {
          drillToDetail.push({
            col: sourceCol,
            op: '==',
            val: eventParams.name,
            formattedVal: eventParams.name,
          });
        } else if (targetCol && targetNodes.includes(eventParams.name)) {
          drillToDetail.push({
            col: targetCol,
            op: '==',
            val: eventParams.name,
            formattedVal: eventParams.name,
          });
        }
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
