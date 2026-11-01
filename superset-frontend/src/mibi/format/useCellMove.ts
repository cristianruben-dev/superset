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
/**
 * Moving an object by dragging it: it follows the pointer in whole cells, so
 * the cell it will land on is always the one it shows, and it stays inside the
 * page. Nothing else on the page moves.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
} from 'react';
import { useDispatch } from 'react-redux';
import type { LayoutItem } from 'src/dashboard/types';
import { moveObject } from './actions';
import { useCanvasZoom } from './CanvasFrame';
import { gridColumnCount } from './columns';
import { posOf, type Pos } from './positions';
import { CELL } from './types';

/** What a press on does not start a move: controls, handles and text fields. */
const KEEPS_ITS_CLICK = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[contenteditable="true"]',
  '.hover-menu',
  '.resize-handle',
  '[class*="resizable-container-handle"]',
  '.ant-dropdown',
  '.ant-select',
].join(',');

// Pixels the pointer moves before a press becomes a move, so clicks still select
const DRAG_THRESHOLD = 4;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export interface CellMove {
  /** Props for the element the object is dragged by */
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
  };
  /** Style that shows the object where it will land */
  style: CSSProperties | undefined;
  moving: boolean;
}

export function useCellMove(component: LayoutItem, enabled: boolean): CellMove {
  const dispatch = useDispatch();
  const zoom = useCanvasZoom();
  const [shift, setShift] = useState<Pos | null>(null);
  const stop = useRef<(() => void) | null>(null);

  // A move is dropped when the object goes away
  useEffect(() => () => stop.current?.(), []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const start = posOf(component.meta);
      if (!enabled || !start || event.button !== 0 || event.isPrimary === false)
        return;
      if ((event.target as HTMLElement).closest(KEEPS_ITS_CLICK)) return;

      const page = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        '.mibi-canvas',
      );
      const width = Number(component.meta.width) || 1;
      const height = Number(component.meta.height) || 1;
      const columns = gridColumnCount();
      const rows = page ? Math.floor(page.offsetHeight / CELL) : Infinity;
      const unit = CELL * (zoom || 1);
      const { clientX, clientY } = event;
      let moved = false;
      let landing: Pos = start;

      const onMove = (move: globalThis.PointerEvent) => {
        const dx = move.clientX - clientX;
        const dy = move.clientY - clientY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!moved) {
          moved = true;
          document.body.classList.add('mibi-moving');
        }
        landing = {
          x: clamp(start.x + Math.round(dx / unit), 0, columns - width),
          y: clamp(start.y + Math.round(dy / unit), 0, rows - height),
        };
        setShift({ x: landing.x - start.x, y: landing.y - start.y });
      };
      const end = (commit: boolean) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        document.body.classList.remove('mibi-moving');
        stop.current = null;
        setShift(null);
        if (moved && commit && (landing.x !== start.x || landing.y !== start.y)) {
          dispatch(moveObject(component.id, landing));
        }
      };
      const onUp = () => end(true);
      const onCancel = () => end(false);
      const onKey = (key: KeyboardEvent) => {
        if (key.key === 'Escape') end(false);
      };
      stop.current = () => end(false);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
    },
    [component.id, component.meta, dispatch, enabled, zoom],
  );

  // The browser's own drag of the element would take the pointer from the move
  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (enabled && posOf(component.meta)) event.preventDefault();
    },
    [component.meta, enabled],
  );

  return {
    handlers: { onPointerDown, onDragStart },
    moving: !!shift,
    style: shift
      ? {
          transform: `translate(${shift.x * CELL}px, ${shift.y * CELL}px)`,
          transition: 'transform 70ms ease-out',
          zIndex: 30,
          cursor: 'grabbing',
        }
      : undefined,
  };
}
