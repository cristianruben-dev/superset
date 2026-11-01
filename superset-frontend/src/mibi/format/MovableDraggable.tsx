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
import { useState, type ComponentProps, type ReactNode } from 'react';
import cx from 'classnames';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import type { JsonObject } from '@superset-ui/core';
import type { LayoutItem } from 'src/dashboard/types';
import { ObjectShiftContext } from './ObjectShift';
import { posOf, posStyle, type Pos } from './positions';
import { CELL } from './types';
import { useCellMove } from './useCellMove';

type DraggableProps = ComponentProps<typeof Draggable>;

/**
 * The draggable wrapper of a chart, element or text box. One that sits on a
 * cell of the page is moved by dragging it over the grid (see useCellMove);
 * the rest still move by drag and drop between slots.
 */
export function MovableDraggable({
  component,
  moveable = true,
  className,
  children,
  ...props
}: Omit<DraggableProps, 'children' | 'style'> & {
  component: LayoutItem | JsonObject;
  /** False while the object is being edited in place */
  moveable?: boolean;
  className?: string | null;
  children: DraggableProps['children'] | ((child: never) => ReactNode);
}) {
  const positioned = !!posOf((component as LayoutItem).meta);
  const move = useCellMove(
    component as LayoutItem,
    moveable && !!props.editMode,
  );
  // While the object is resized from its left or top edge it follows the edge
  const [edge, setEdge] = useState<Pos | null>(null);
  return (
    <ObjectShiftContext.Provider value={setEdge}>
      <Draggable
        {...props}
        component={component}
        className={cx(className, move.moving && 'mibi-moving')}
        style={{
          ...posStyle((component as LayoutItem).meta),
          ...(edge && {
            transform: `translate(${edge.x * CELL}px, ${edge.y * CELL}px)`,
          }),
          ...move.style,
        }}
        disableDragDrop={props.disableDragDrop || positioned}
        onPointerDown={move.handlers.onPointerDown}
        onDragStart={move.handlers.onDragStart}
      >
        {children}
      </Draggable>
    </ObjectShiftContext.Provider>
  );
}
