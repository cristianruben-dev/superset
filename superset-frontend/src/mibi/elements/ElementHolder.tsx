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
import { maxWidthCells } from 'src/mibi/format/positions';
import { CELL } from 'src/mibi/format/types';
import { minObjectColumns } from 'src/mibi/format/columns';
import { memo, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import cx from 'classnames';
import type { ResizeCallback, ResizeStartCallback } from 're-resizable';
import type { ConnectDragSource } from 'react-dnd';
import { useTheme } from '@apache-superset/core/theme';
import { ObjectActions } from 'src/mibi/format/ObjectActions';
import { MovableDraggable } from 'src/mibi/format/MovableDraggable';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import { GRID_MIN_COLUMN_COUNT } from 'src/dashboard/util/constants';
import {
  openFormat,
  selectVisual,
  useIsVisualSelected,
} from 'src/mibi/format/selection';
import { visualStyle } from 'src/mibi/format/styles';
import { useMaxHeightMultiple } from 'src/mibi/format/CanvasFrame';
import { setElementConfig } from './actions';
import {
  ELEMENT_DEFAULTS,
  ELEMENT_KEY,
  elementKind,
  type ElementConfig,
  type TextElement,
} from './types';
import {
  ButtonView,
  ImageView,
  NavigatorView,
  ShapeView,
  TextView,
} from './views';
import { FilterView } from './FilterView';
import { useHiddenOverride } from 'src/mibi/report/visibility';
import { useObjectLocked } from 'src/mibi/format/lock';
import { ObjectBadges } from 'src/mibi/format/ObjectBadges';

/** Design elements (text, shapes, buttons) can be as low as one cell. */
const ELEMENT_MIN_ROW_UNITS = 1;

export interface ElementHolderProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;
  columnWidth: number;
  availableColumnCount: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;
  handleComponentDrop: (dropResult: unknown) => void;
  deleteComponent: (id: string, parentId: string) => void;
}

/**
 * A design element on the canvas (image, shape, button or rich text): it
 * drags and resizes like a chart, takes the same box format and is set up in
 * the Format pane.
 */
function ElementHolder({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  editMode,
  columnWidth,
  availableColumnCount,
  onResizeStart,
  onResize,
  onResizeStop,
  handleComponentDrop,
  deleteComponent,
}: ElementHolderProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const kind = elementKind(component.meta.componentKey) ?? 'shape';
  const config = (component.meta[ELEMENT_KEY] ??
    ELEMENT_DEFAULTS[kind].element) as ElementConfig;
  const selected = useIsVisualSelected(component.id) && editMode;
  const maxHeightMultiple = useMaxHeightMultiple(
    component.meta.height ?? ELEMENT_DEFAULTS[kind].height,
    parentComponent,
    component.meta,
  );
  // A bookmark may show or hide the element for this visit
  const hiddenOverride = useHiddenOverride(component.id);
  const hidden = hiddenOverride ?? !!component.meta.mibiHidden;
  const locked = useObjectLocked(component.meta);
  const box = useMemo(
    () => visualStyle(component.meta.mibiFormat, theme),
    [component.meta.mibiFormat, theme],
  );
  // Re-render when the page changes, for buttons that open a page
  useSelector((state: RootState) => state.dashboardState.activeTabs);

  const widthMultiple =
    parentComponent.type === COLUMN_TYPE
      ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
      : component.meta.width || GRID_MIN_COLUMN_COUNT;

  const onTextChange = useCallback(
    (html: string) =>
      dispatch(
        setElementConfig(
          component.id,
          { ...(config as TextElement), html },
          `element:${component.id}:text`,
        ),
      ),
    [component.id, config, dispatch],
  );

  const content = () => {
    switch (config.kind) {
      case 'image':
        return <ImageView config={config} editMode={editMode} />;
      case 'button':
        return <ButtonView config={config} editMode={editMode} />;
      case 'filter':
        return <FilterView config={config} editMode={editMode} />;
      case 'navigator':
        return <NavigatorView config={config} editMode={editMode} />;
      case 'text':
        return (
          <TextView
            config={config}
            editing={selected}
            editMode={editMode}
            onChange={onTextChange}
          />
        );
      default:
        return (
          <ShapeView config={config} id={component.id} editMode={editMode} />
        );
    }
  };

  // Hidden objects are only shown, faded, to editors
  if (hidden && !editMode) return null;

  return (
    <MovableDraggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {({ dragSourceRef }: { dragSourceRef: ConnectDragSource }) => (
        <ResizableContainer
          id={component.id}
          editMode={editMode}
          adjustableWidth={parentComponent.type === ROW_TYPE}
          adjustableHeight
          widthStep={columnWidth}
          widthMultiple={widthMultiple}
          heightStep={CELL}
          heightMultiple={
            component.meta.height ?? ELEMENT_DEFAULTS[kind].height
          }
          minWidthMultiple={minObjectColumns()}
          minHeightMultiple={ELEMENT_MIN_ROW_UNITS}
          maxHeightMultiple={maxHeightMultiple}
          maxWidthMultiple={
            maxWidthCells(component.meta) ??
            availableColumnCount + widthMultiple
          }
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeStop={onResizeStop}
        >
          <div
            ref={dragSourceRef}
            data-test={`mibi-element-${kind}`}
            className={cx(
              'dashboard-component',
              'mibi-element',
              `mibi-element-${kind}`,
              box.className,
              selected && 'mibi-selected',
              editMode && 'mibi-element--editing',
              editMode && hidden && 'mibi-hidden',
            )}
            style={box.style}
            onClickCapture={
              editMode
                ? event =>
                    selectVisual(
                      component.id,
                      event.shiftKey || event.metaKey || event.ctrlKey,
                    )
                : undefined
            }
          >
            {editMode && <ObjectBadges meta={component.meta} hidden={hidden} />}
            {editMode && (
              <ObjectActions
                id={component.id}
                onDelete={
                  locked ? undefined : () => deleteComponent(id, parentId)
                }
                onFormat={() => openFormat(component.id)}
                formatTestId="mibi-format-element-button"
              />
            )}
            {content()}
          </div>
        </ResizableContainer>
      )}
    </MovableDraggable>
  );
}

export default memo(ElementHolder);
