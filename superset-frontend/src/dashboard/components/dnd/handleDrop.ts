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
import { DropTargetMonitor } from 'react-dnd';
import getDropPosition, {
  clearDropCache,
  DROP_FORBIDDEN,
} from '../../util/getDropPosition';
import { NEW_COMPONENTS_SOURCE_ID } from 'src/dashboard/util/constants';
import {
  clearDragTrack,
  dropCell,
  isPositioned,
  posOf,
} from 'src/mibi/format/positions';
import type {
  DragDroppableComponent,
  DragItem,
  DropResult,
} from './dragDroppableConfig';

export default function handleDrop(
  props: DragDroppableComponent['props'],
  monitor: DropTargetMonitor,
  Component: DragDroppableComponent,
): DropResult | undefined {
  // this may happen due to throttling
  if (!Component.mounted) return undefined;

  Component.setState(() => ({ dropIndicator: null }));

  // An object that has a cell on the page lands wherever it is dropped, over
  // another object or not: there is no slot to find
  const moving = monitor.getItem() as DragItem;
  if (
    moving &&
    isPositioned(moving.type) &&
    posOf(moving.meta) &&
    moving.parentId !== NEW_COMPONENTS_SOURCE_ID &&
    moving.parentId
  ) {
    const cell = dropCell(monitor, Component.ref);
    if (cell) {
      const slot = {
        id: moving.parentId,
        type: moving.parentType as DropResult['source']['type'],
        index: moving.index,
      };
      const placed: DropResult = {
        source: slot,
        dragging: { id: moving.id, type: moving.type, meta: moving.meta },
        destination: slot,
        cell,
      };
      Component.props.onDrop?.(placed);
      clearDropCache();
      clearDragTrack();
      return placed;
    }
  }

  const dropPosition = getDropPosition(monitor, Component);

  if (!dropPosition || dropPosition === DROP_FORBIDDEN) {
    return undefined;
  }

  const {
    parentComponent,
    component,
    index: componentIndex,
    onDrop,
    dropToChild,
  } = Component.props;

  const draggingItem = monitor.getItem() as DragItem;

  const dropResult: DropResult = {
    source: {
      id: draggingItem.parentId ?? component.id,
      type: draggingItem.parentType ?? component.type,
      index: draggingItem.index,
    },
    dragging: {
      id: draggingItem.id,
      type: draggingItem.type,
      meta: draggingItem.meta,
    },
    position: dropPosition,
    cell: dropCell(monitor, Component.ref),
  };

  const shouldAppendToChildren =
    typeof dropToChild === 'function' ? dropToChild(draggingItem) : dropToChild;

  // simplest case, append as child
  if (shouldAppendToChildren) {
    dropResult.destination = {
      id: component.id,
      type: component.type,
      index: component.children.length,
    };
  } else if (!parentComponent) {
    dropResult.destination = {
      id: component.id,
      type: component.type,
      index: componentIndex,
    };
  } else {
    // if the item is in the same list with a smaller index, you must account for the
    // "missing" index upon movement within the list
    const sameParent =
      parentComponent && draggingItem.parentId === parentComponent.id;
    const sameParentLowerIndex =
      sameParent &&
      draggingItem.index < componentIndex &&
      draggingItem.type !== component.type;

    const nextIndex = sameParentLowerIndex
      ? componentIndex - 1
      : componentIndex;

    dropResult.destination = {
      id: parentComponent.id,
      type: parentComponent.type,
      index: nextIndex,
    };
  }

  onDrop?.(dropResult);
  clearDropCache();
  clearDragTrack();

  return dropResult;
}
