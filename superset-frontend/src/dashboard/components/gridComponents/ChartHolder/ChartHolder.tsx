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
import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';

import { ResizeCallback, ResizeStartCallback } from 're-resizable';
import cx from 'classnames';
import { useSelector } from 'react-redux';
import { css, useTheme } from '@apache-superset/core/theme';
import { LayoutItem, RootState } from 'src/dashboard/types';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import IconButton from 'src/dashboard/components/IconButton';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import getChartAndLabelComponentIdFromPath from 'src/dashboard/util/getChartAndLabelComponentIdFromPath';
import useFilterFocusHighlightStyles from 'src/dashboard/util/useFilterFocusHighlightStyles';
import { AntdThemeProvider } from '@superset-ui/core/components';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { gapInset, visualStyle } from 'src/mibi/format/styles';
import { ObjectBadges } from 'src/mibi/format/ObjectFlags';
import { useMergedVisualFormat } from 'src/mibi/format/useVisualFormat';
import {
  useCanvasMobile,
  useMaxHeightMultiple,
} from 'src/mibi/format/CanvasFrame';
import { gridColumnCount, minObjectColumns } from 'src/mibi/format/columns';
import {
  openFormat,
  selectVisual,
  useSelectedVisual,
} from 'src/mibi/format/selection';
import {
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
} from 'src/dashboard/util/constants';

export const CHART_MARGIN = 32;

interface ChartHolderProps {
  id: string;
  parentId: string;
  dashboardId: number;
  component: LayoutItem;
  parentComponent: LayoutItem;
  getComponentById?: (id?: string) => LayoutItem | undefined;
  index: number;
  depth: number;
  editMode: boolean;
  directPathLastUpdated?: number;
  fullSizeChartId: number | null;
  isComponentVisible: boolean;

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  // dnd
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: Function;
  handleComponentDrop: (...args: unknown[]) => unknown;
  setFullSizeChartId: (chartId: number | null) => void;
  isInView: boolean;
}

const ChartHolder = ({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
  editMode,
  isComponentVisible,
  dashboardId,
  fullSizeChartId,
  getComponentById = () => undefined,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
  setFullSizeChartId,
  isInView,
}: ChartHolderProps) => {
  const theme = useTheme();
  const fullSizeStyle = css`
    && {
      position: fixed !important;
      z-index: 3000;
      left: 0;
      top: 0;
      padding: ${theme.sizeUnit * 2}px;
    }
  `;
  const { chartId } = component.meta;
  const isFullSize = fullSizeChartId === chartId;
  const chartHolderRef = useRef<HTMLDivElement | null>(null);

  const focusHighlightStyles = useFilterFocusHighlightStyles(chartId ?? 0);
  const canvasFormat = useSelector(
    (state: RootState) =>
      state.dashboardLayout?.present?.[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas,
  );
  const visualFormat = useMergedVisualFormat(component.meta.mibiFormat);
  const formatted = useMemo(
    () => visualStyle(visualFormat, theme),
    [visualFormat, theme],
  );
  const inset = gapInset(canvasFormat);
  const isSelected = useSelectedVisual() === component.id && editMode;
  const mobile = useCanvasMobile();
  // The page is a limit: an object grows only into the room left on it
  const maxHeightMultiple = useMaxHeightMultiple(
    component.meta.height ?? GRID_MIN_ROW_UNITS,
    parentComponent,
  );
  const hiddenOnMobile = mobile && !!component.meta.mibiHideMobile;
  const hidden = !!component.meta.mibiHidden || hiddenOnMobile;
  const locked = !!component.meta.mibiLocked;
  const holderStyle = useMemo(
    () =>
      isFullSize
        ? focusHighlightStyles
        : { ...formatted.style, ...focusHighlightStyles },
    [focusHighlightStyles, formatted.style, isFullSize],
  );
  const directPathToChild = useSelector(
    (state: RootState) => state.dashboardState.directPathToChild,
  );
  const directPathLastUpdated = useSelector(
    (state: RootState) => state.dashboardState.directPathLastUpdated ?? 0,
  );

  const [extraControls, setExtraControls] = useState<Record<string, unknown>>(
    {},
  );
  const [outlinedComponentId, setOutlinedComponentId] = useState<string>();
  const [outlinedColumnName, setOutlinedColumnName] = useState<string>();
  const [currentDirectPathLastUpdated, setCurrentDirectPathLastUpdated] =
    useState(0);

  const infoFromPath = useMemo(
    () => getChartAndLabelComponentIdFromPath(directPathToChild ?? []) as any,
    [directPathToChild],
  );

  // Calculate if the chart should be outlined
  useEffect(() => {
    const { label: columnName, chart: chartComponentId } = infoFromPath;

    if (
      directPathLastUpdated !== currentDirectPathLastUpdated &&
      component.id === chartComponentId
    ) {
      setCurrentDirectPathLastUpdated(directPathLastUpdated);
      setOutlinedComponentId(component.id);
      setOutlinedColumnName(columnName);
    }
  }, [
    component,
    currentDirectPathLastUpdated,
    directPathLastUpdated,
    infoFromPath,
  ]);

  // Remove the chart outline after a defined time
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (outlinedComponentId) {
      timerId = setTimeout(() => {
        setOutlinedComponentId(undefined);
        setOutlinedColumnName(undefined);
      }, 2000);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [outlinedComponentId]);

  const widthMultiple = useMemo(() => {
    const columnParentWidth = getComponentById(
      parentComponent.parents?.find(parent => parent.startsWith(COLUMN_TYPE)),
    )?.meta?.width;

    let widthMultiple = component.meta.width || GRID_MIN_COLUMN_COUNT;
    if (parentComponent.type === COLUMN_TYPE) {
      widthMultiple = parentComponent.meta.width || GRID_MIN_COLUMN_COUNT;
    } else if (columnParentWidth && widthMultiple > columnParentWidth) {
      widthMultiple = columnParentWidth;
    }

    // The mobile layout gives every object the full width
    return mobile ? gridColumnCount() : widthMultiple;
  }, [
    mobile,
    component,
    getComponentById,
    parentComponent.meta.width,
    parentComponent.parents,
    parentComponent.type,
  ]);

  const { chartWidth, chartHeight } = useMemo(() => {
    let width = 0;
    let height = 0;

    if (isFullSize) {
      width = window.innerWidth - CHART_MARGIN;
      height = window.innerHeight - CHART_MARGIN;
    } else {
      // Formatting padding, border and spacing take room from the chart
      const shrink = formatted.shrink + inset * 2;
      width = Math.floor(
        widthMultiple * columnWidth +
          (widthMultiple - 1) * GRID_GUTTER_SIZE -
          CHART_MARGIN -
          shrink,
      );
      height = Math.floor(
        (component.meta.height ?? 0) * GRID_BASE_UNIT - CHART_MARGIN - shrink,
      );
    }

    return {
      chartWidth: width,
      chartHeight: height,
    };
  }, [
    columnWidth,
    component,
    isFullSize,
    widthMultiple,
    formatted.shrink,
    inset,
  ]);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleUpdateSliceName = useCallback(
    (nextName: string) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            sliceNameOverride: nextName,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleToggleFullSize = useCallback(() => {
    setFullSizeChartId(isFullSize ? null : (chartId ?? null));
  }, [chartId, isFullSize, setFullSizeChartId]);

  const handleExtraControl = useCallback((name: string, value: unknown) => {
    setExtraControls(current => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const renderChild = useCallback(
    ({ dragSourceRef }) => (
      <ResizableContainer
        id={component.id}
        adjustableWidth={parentComponent.type === ROW_TYPE}
        adjustableHeight
        widthStep={columnWidth}
        widthMultiple={widthMultiple}
        heightStep={GRID_BASE_UNIT}
        heightMultiple={component.meta.height ?? GRID_MIN_ROW_UNITS}
        minWidthMultiple={minObjectColumns()}
        minHeightMultiple={GRID_MIN_ROW_UNITS}
        maxHeightMultiple={maxHeightMultiple}
        maxWidthMultiple={availableColumnCount + widthMultiple}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        editMode={editMode && !locked}
      >
        <div
          ref={el => {
            if (typeof dragSourceRef === 'function') {
              dragSourceRef(el);
            } else if (
              dragSourceRef &&
              Object.prototype.hasOwnProperty.call(dragSourceRef, 'current')
            ) {
              (
                dragSourceRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
            }
            chartHolderRef.current = el;
          }}
          data-test="dashboard-component-chart-holder"
          style={holderStyle}
          css={isFullSize ? fullSizeStyle : undefined}
          onClickCapture={
            editMode ? () => selectVisual(component.id) : undefined
          }
          className={cx(
            'dashboard-component',
            'dashboard-component-chart-holder',
            !isFullSize && formatted.className,
            isFullSize && 'mibi-full-size',
            isSelected && 'mibi-selected',
            editMode && hidden && 'mibi-hidden',
            editMode && locked && 'mibi-locked',
            // The following class is added to support custom dashboard styling via the CSS editor
            `dashboard-chart-id-${chartId}`,
            outlinedComponentId ? 'fade-in' : 'fade-out',
          )}
        >
          <AntdThemeProvider
            getPopupContainer={(triggerNode: HTMLElement) =>
              document.fullscreenElement
                ? (triggerNode?.closest?.(
                    '[data-test="dashboard-component-chart-holder"]',
                  ) as HTMLElement) || document.body
                : document.body
            }
          >
            {!editMode && (
              <AnchorLink
                id={component.id}
                scrollIntoView={outlinedComponentId === component.id}
              />
            )}
            {!!outlinedComponentId && (
              <style>
                {`label[for=${outlinedColumnName}] + .Select .Select__control {
                      border-color: ${theme.colorPrimary};
                      transition: border-color 1s ease-in-out;
                    }`}
              </style>
            )}
            <Chart
              componentId={component.id}
              id={component.meta.chartId ?? 0}
              dashboardId={dashboardId}
              width={chartWidth}
              height={chartHeight}
              sliceName={
                component.meta.sliceNameOverride ||
                component.meta.sliceName ||
                ''
              }
              updateSliceName={(_sliceId: number, name: string) =>
                handleUpdateSliceName(name)
              }
              isComponentVisible={isComponentVisible}
              handleToggleFullSize={handleToggleFullSize}
              isFullSize={isFullSize}
              setControlValue={handleExtraControl}
              extraControls={extraControls}
              isInView={isInView}
              chartHolderRef={chartHolderRef}
            />
            {editMode && <ObjectBadges item={component} />}
            {editMode && (
              <HoverMenu position="top">
                {!locked && (
                  <div data-test="dashboard-delete-component-button">
                    <DeleteComponentButton onDelete={handleDeleteComponent} />
                  </div>
                )}
                <Tooltip title={t('Format')} placement="top">
                  <div data-test="mibi-format-visual-button">
                    <IconButton
                      onClick={() => openFormat(component.id)}
                      icon={<Icons.BgColorsOutlined iconSize="l" />}
                    />
                  </div>
                </Tooltip>
              </HoverMenu>
            )}
          </AntdThemeProvider>
        </div>
      </ResizableContainer>
    ),
    [
      component.id,
      component.meta.height,
      component.meta.chartId,
      component.meta.sliceNameOverride,
      component.meta.sliceName,
      parentComponent.type,
      columnWidth,
      widthMultiple,
      availableColumnCount,
      onResizeStart,
      onResize,
      onResizeStop,
      editMode,
      holderStyle,
      formatted.className,
      isSelected,
      hidden,
      locked,
      component,
      isFullSize,
      fullSizeStyle,
      chartId,
      outlinedComponentId,
      outlinedColumnName,
      dashboardId,
      chartWidth,
      chartHeight,
      handleUpdateSliceName,
      isComponentVisible,
      handleToggleFullSize,
      handleExtraControl,
      extraControls,
      isInView,
      handleDeleteComponent,
    ],
  );

  // Hidden objects are only shown, faded, to editors
  if (hidden && !editMode) return null;

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      disableDragDrop={locked}
      editMode={editMode}
    >
      {renderChild}
    </Draggable>
  );
};

export default memo(ChartHolder);
