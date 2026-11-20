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
  DataRecordValue,
} from '@superset-ui/core';
import { TreeTransformedProps } from './types';
import { EventHandlers } from '../types';
import Echart from '../components/Echart';

export default function EchartsTree({
  echartOptions,
  height,
  refs,
  width,
  formData,
  onContextMenu,
}: TreeTransformedProps) {
  const eventHandlers: EventHandlers = {
    contextmenu: (eventParams: {
      data?: { nodeId?: DataRecordValue; name?: DataRecordValue };
      name?: string;
      event?: { stop: () => void; event: PointerEvent };
    }) => {
      if (!onContextMenu) return;
      const pointerEvent = eventParams.event?.event;
      if (!pointerEvent) return;
      const drillToDetail: BinaryQueryObjectFilterClause[] = [];
      const nodeId = eventParams.data?.nodeId;
      const nodeName = eventParams.data?.name ?? eventParams.name;
      if (formData.id && nodeId !== null && nodeId !== undefined) {
        drillToDetail.push({
          col: formData.id,
          op: '==',
          val: nodeId as string | number | boolean,
          formattedVal: String(nodeId),
        });
      }
      if (
        formData.name &&
        formData.name !== formData.id &&
        nodeName !== null &&
        nodeName !== undefined &&
        nodeName !== ''
      ) {
        drillToDetail.push({
          col: formData.name,
          op: '==',
          val: nodeName as string | number | boolean,
          formattedVal: String(nodeName),
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
