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
import { useState, useCallback, useContext, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ResizeCallback, ResizeStartCallback, Resizable } from 're-resizable';
import { useCanvasMobile, useCanvasZoom } from 'src/mibi/format/CanvasFrame';
import cx from 'classnames';
import { css, styled } from '@apache-superset/core/theme';

import {
  RightResizeHandle,
  BottomResizeHandle,
  BottomRightResizeHandle,
  LeftResizeHandle,
  TopResizeHandle,
  TopLeftResizeHandle,
  TopRightResizeHandle,
  BottomLeftResizeHandle,
} from './ResizableHandle';
import type { RootState } from '../../types';
import { resizeObject } from 'src/mibi/format/actions';
import { ObjectShiftContext } from 'src/mibi/format/ObjectShift';
import { posOf } from 'src/mibi/format/positions';
import resizableConfig from '../../util/resizableConfig';
import { CELL } from 'src/mibi/format/types';

const proxyToInfinity = Number.MAX_VALUE;

export interface ResizableContainerProps {
  id: string;
  children?: object;
  adjustableWidth?: boolean;
  adjustableHeight?: boolean;
  gutterWidth?: number;
  widthStep?: number;
  heightStep?: number;
  widthMultiple: number;
  heightMultiple: number;
  minWidthMultiple?: number;
  maxWidthMultiple?: number;
  minHeightMultiple?: number;
  maxHeightMultiple?: number;
  staticHeight?: number;
  staticHeightMultiple?: number;
  staticWidth?: number;
  staticWidthMultiple?: number;
  onResizeStart?: ResizeStartCallback;
  onResize?: ResizeCallback;
  onResizeStop?: ResizeCallback;
  editMode: boolean;
}

// Objects are a whole number of cells wide and tall: they snap to the cell
const SNAP_TO_GRID: [number, number] = [CELL, CELL];
const HANDLE_CLASSES = {
  right: 'resizable-container-handle--right',
  bottom: 'resizable-container-handle--bottom',
  left: 'resizable-container-handle--left',
  top: 'resizable-container-handle--top',
  topLeft: 'resizable-container-handle--top-left',
  topRight: 'resizable-container-handle--top-right',
  bottomLeft: 'resizable-container-handle--bottom-left',
};
// @ts-expect-error
const StyledResizable = styled(Resizable)`
  ${({ theme }) => css`
    &.resizable-container {
      background-color: transparent;
      position: relative;

      /* re-resizable sets an empty div to 100% width and height, which doesn't
      play well with many 100% height containers we need */

      & ~ div {
        width: auto !important;
        height: auto !important;
      }
    }

    &.resizable-container--resizing {
      /* after ensures border visibility on top of any children */

      &:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-shadow: inset 0 0 0 2px ${theme.colorPrimary};
      }

      & > span .resize-handle {
        border-color: ${theme.colorPrimary};
      }
    }

    .resize-handle {
      opacity: 0;
      z-index: 10;

      &--bottom-right {
        position: absolute;
        border-right: 1px solid ${theme.colorSplit};
        border-bottom: 1px solid ${theme.colorSplit};
        right: ${theme.sizeUnit * 4}px;
        bottom: ${theme.sizeUnit * 4}px;
        width: ${theme.sizeUnit * 2}px;
        height: ${theme.sizeUnit * 2}px;
      }

      &--right {
        width: ${theme.sizeUnit / 2}px;
        height: ${theme.sizeUnit * 5}px;
        right: ${theme.sizeUnit}px;
        top: 50%;
        transform: translate(0, -50%);
        position: absolute;
        border-left: 1px solid ${theme.colorSplit};
        border-right: 1px solid ${theme.colorSplit};
      }

      &--bottom {
        height: ${theme.sizeUnit / 2}px;
        width: ${theme.sizeUnit * 5}px;
        bottom: ${theme.sizeUnit}px;
        left: 50%;
        transform: translate(-50%);
        position: absolute;
        border-top: 1px solid ${theme.colorSplit};
        border-bottom: 1px solid ${theme.colorSplit};
      }
    }
  `}

  &.resizable-container:hover .resize-handle,
  &.resizable-container--resizing .resize-handle {
    opacity: 1;
  }

  .dragdroppable-column & .resizable-container-handle--right {
    /* override the default because the inner column's handle's mouse target is very small */
    right: 0 !important;
  }

  & .resizable-container-handle--bottom {
    bottom: 0 !important;
  }
`;

export default function ResizableContainer({
  id,
  children,
  widthMultiple,
  heightMultiple,
  staticHeight,
  staticHeightMultiple,
  staticWidth,
  staticWidthMultiple,
  onResizeStop,
  onResize,
  onResizeStart,
  editMode,
  adjustableWidth = true,
  adjustableHeight = true,
  gutterWidth = 0,
  widthStep = CELL,
  heightStep = CELL,
  minWidthMultiple = 1,
  maxWidthMultiple = proxyToInfinity,
  minHeightMultiple = 1,
  maxHeightMultiple = proxyToInfinity,
}: ResizableContainerProps) {
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const canvasZoom = useCanvasZoom();
  // The mobile layout stacks every object at full width
  const mobile = useCanvasMobile();
  const widthAdjustable = adjustableWidth && !mobile;

  // Size in cells while resizing, shown next to the object
  const [liveSize, setLiveSize] = useState<[number, number] | null>(null);

  // An object on a cell of the page can also be resized from its left and top
  // edges: it follows the edge so the opposite one stays put
  const pos = useSelector((state: RootState) =>
    posOf(state.dashboardLayout?.present?.[id]?.meta),
  );
  const dispatch = useDispatch();
  const followEdge = useContext(ObjectShiftContext);
  const cellsOf = useCallback(
    (delta: { width: number; height: number }) => ({
      width: Math.round(delta.width / (widthStep + gutterWidth)),
      height: Math.round(delta.height / heightStep),
    }),
    [widthStep, gutterWidth, heightStep],
  );

  const handleResize = useCallback<ResizeCallback>(
    (event, direction, elementRef, delta) => {
      const grown = cellsOf(delta);
      setLiveSize([widthMultiple + grown.width, heightMultiple + grown.height]);
      if (pos) {
        followEdge?.({
          x: /left/i.test(direction) ? -grown.width : 0,
          y: /^top/i.test(direction) ? -grown.height : 0,
        });
      }
      if (onResize) onResize(event, direction, elementRef, delta);
    },
    [onResize, widthMultiple, heightMultiple, cellsOf, pos, followEdge],
  );

  const handleResizeStart = useCallback<ResizeStartCallback>(
    (e, dir, elementRef) => {
      if (onResizeStart) onResizeStart(e, dir, elementRef);
      setIsResizing(true);
    },
    [onResizeStart],
  );

  const handleResizeStop = useCallback<ResizeCallback>(
    (event, direction, elementRef, delta) => {
      followEdge?.(null);
      const leftward = /left/i.test(direction);
      const upward = /^top/i.test(direction);
      if (pos && (leftward || upward)) {
        const grown = cellsOf(delta);
        const x0 = pos.x - (leftward ? grown.width : 0);
        const y0 = pos.y - (upward ? grown.height : 0);
        const x = Math.max(0, x0);
        const y = Math.max(0, y0);
        dispatch(
          resizeObject(
            id,
            {
              width: Math.max(1, widthMultiple + grown.width - (x - x0)),
              height: Math.max(1, heightMultiple + grown.height - (y - y0)),
            },
            { x, y },
          ),
        );
        setIsResizing(false);
        setLiveSize(null);
        return;
      }
      if (onResizeStop) {
        const nextWidthMultiple =
          widthMultiple + Math.round(delta.width / (widthStep + gutterWidth));
        const nextHeightMultiple =
          heightMultiple + Math.round(delta.height / heightStep);

        onResizeStop(
          event,
          direction,
          elementRef,
          {
            width: widthAdjustable ? nextWidthMultiple : 0,
            height: adjustableHeight ? nextHeightMultiple : 0,
          },
          // @ts-expect-error
          id,
        );
      }
      setIsResizing(false);
      setLiveSize(null);
    },
    [
      followEdge,
      pos,
      cellsOf,
      dispatch,
      onResizeStop,
      widthMultiple,
      heightMultiple,
      widthStep,
      heightStep,
      gutterWidth,
      widthAdjustable,
      adjustableHeight,
      id,
    ],
  );

  const size = useMemo(
    () => ({
      width: mobile
        ? '100%'
        : widthAdjustable
          ? (widthStep + gutterWidth) * widthMultiple - gutterWidth
          : (staticWidthMultiple && staticWidthMultiple * widthStep) ||
            staticWidth ||
            undefined,
      height: adjustableHeight
        ? heightStep * heightMultiple
        : (staticHeightMultiple && staticHeightMultiple * heightStep) ||
          staticHeight ||
          undefined,
    }),
    [
      mobile,
      widthAdjustable,
      widthStep,
      gutterWidth,
      widthMultiple,
      staticWidthMultiple,
      staticWidth,
      adjustableHeight,
      heightStep,
      heightMultiple,
      staticHeightMultiple,
      staticHeight,
    ],
  );

  const handleComponent = useMemo(
    () => ({
      right: <RightResizeHandle />,
      bottom: <BottomResizeHandle />,
      bottomRight: <BottomRightResizeHandle />,
      left: <LeftResizeHandle />,
      top: <TopResizeHandle />,
      topLeft: <TopLeftResizeHandle />,
      topRight: <TopRightResizeHandle />,
      bottomLeft: <BottomLeftResizeHandle />,
    }),
    [],
  );

  const enableConfig = useMemo(() => {
    if (editMode && widthAdjustable && adjustableHeight) {
      return pos ? resizableConfig.allEdges : resizableConfig.widthAndHeight;
    }
    if (editMode && widthAdjustable) {
      return pos ? resizableConfig.leftAndRight : resizableConfig.widthOnly;
    }
    if (editMode && adjustableHeight) {
      return pos ? resizableConfig.topAndBottom : resizableConfig.heightOnly;
    }
    return resizableConfig.notAdjustable;
  }, [editMode, widthAdjustable, adjustableHeight, pos]);

  return (
    <StyledResizable
      scale={canvasZoom}
      enable={enableConfig}
      grid={SNAP_TO_GRID}
      gridGap={undefined}
      minWidth={
        widthAdjustable
          ? minWidthMultiple * (widthStep + gutterWidth) - gutterWidth
          : undefined
      }
      minHeight={adjustableHeight ? minHeightMultiple * heightStep : undefined}
      maxWidth={
        widthAdjustable && typeof size.width === 'number'
          ? Math.max(
              size.width,
              Math.min(
                proxyToInfinity,
                maxWidthMultiple * (widthStep + gutterWidth) - gutterWidth,
              ),
            )
          : undefined
      }
      maxHeight={
        adjustableHeight && size.height
          ? Math.max(
              size.height,
              Math.min(proxyToInfinity, maxHeightMultiple * heightStep),
            )
          : undefined
      }
      size={size}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      handleComponent={handleComponent}
      className={cx(
        'resizable-container',
        isResizing && 'resizable-container--resizing',
      )}
      handleClasses={HANDLE_CLASSES}
    >
      {children}
      {isResizing && liveSize && (
        <div className="mibi-size-badge" data-test="mibi-size-badge">
          {liveSize[0]} × {liveSize[1]}
        </div>
      )}
    </StyledResizable>
  );
}
