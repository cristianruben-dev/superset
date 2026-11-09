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
import { maxWidthCells } from 'src/auradata/format/positions';
import { CELL } from 'src/auradata/format/types';
import { minObjectColumns } from 'src/auradata/format/columns';
import { memo, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import cx from 'classnames';
import type { ResizeCallback, ResizeStartCallback } from 're-resizable';
import type { ConnectDragSource } from 'react-dnd';
import { useTheme } from '@apache-superset/core/theme';
import { ObjectActions } from 'src/auradata/format/ObjectActions';
import { MovableDraggable } from 'src/auradata/format/MovableDraggable';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import type { LayoutItem } from 'src/dashboard/types';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import { GRID_MIN_COLUMN_COUNT } from 'src/dashboard/util/constants';
import {
  openFormat,
  selectVisual,
  useIsVisualSelected,
} from 'src/auradata/format/selection';
import { visualStyle } from 'src/auradata/format/styles';
import { useMaxHeightMultiple } from 'src/auradata/format/CanvasFrame';
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
import { useHiddenOverride } from 'src/auradata/report/visibility';
import { useObjectLocked } from 'src/auradata/format/lock';
import { ObjectBadges } from 'src/auradata/format/ObjectBadges';

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
  const hidden = hiddenOverride ?? !!component.meta.auradataHidden;
  const locked = useObjectLocked(component.meta);
  const altText = component.meta.auradataAltText as string | undefined;
  const box = useMemo(
    () => visualStyle(component.meta.auradataFormat, theme),
    [component.meta.auradataFormat, theme],
  );
  const handleDelete = useCallback(
    () => deleteComponent(id, parentId),
    [deleteComponent, id, parentId],
  );
  const handleOpenFormat = useCallback(
    () => openFormat(component.id),
    [component.id],
  );

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
        return (
          <FilterView
            config={config}
            editMode={editMode}
            format={component.meta.auradataFormat}
          />
        );
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
            data-test={`auradata-element-${kind}`}
            className={cx(
              'dashboard-component',
              'auradata-element',
              `auradata-element-${kind}`,
              box.className,
              selected && 'auradata-selected',
              editMode && 'auradata-element--editing',
              editMode && hidden && 'auradata-hidden',
            )}
            style={box.style}
            role={altText ? 'group' : undefined}
            aria-label={altText}
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
                onDelete={locked ? undefined : handleDelete}
                onFormat={handleOpenFormat}
                formatTestId="auradata-format-element-button"
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
