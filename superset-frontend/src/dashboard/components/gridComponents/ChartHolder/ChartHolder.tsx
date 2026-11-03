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
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
  type MouseEvent,
} from 'react';

import { ResizeCallback, ResizeStartCallback } from 're-resizable';
import cx from 'classnames';
import { useSelector } from 'react-redux';
import { css, useTheme } from '@apache-superset/core/theme';
import { LayoutItem, RootState } from 'src/dashboard/types';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import { ObjectActions } from 'src/mibi/format/ObjectActions';
import { MovableDraggable } from 'src/mibi/format/MovableDraggable';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import getChartAndLabelComponentIdFromPath from 'src/dashboard/util/getChartAndLabelComponentIdFromPath';
import useFilterFocusHighlightStyles from 'src/dashboard/util/useFilterFocusHighlightStyles';
import { AntdThemeProvider } from '@superset-ui/core/components';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import { t } from '@apache-superset/core/translation';
import { echartsHostFormat, visualStyle } from 'src/mibi/format/styles';
import { useChartTooltipPage } from 'src/mibi/report/TooltipPageHost';
import { InteractionControl } from 'src/mibi/report/InteractionControl';
import { isInteractionControl } from 'src/mibi/report/interactions';
import { useHiddenOverride } from 'src/mibi/report/visibility';
import { useObjectLocked } from 'src/mibi/format/lock';
import { ObjectBadges } from 'src/mibi/format/ObjectBadges';
import { useMergedVisualFormat } from 'src/mibi/format/useVisualFormat';
import { useDynamicTitle } from 'src/mibi/format/dynamicTitle';
import {
  useCanvasMobile,
  useMaxHeightMultiple,
} from 'src/mibi/format/CanvasFrame';
import {
  gridColumnCount,
  MIN_CHART_COLUMNS,
  MIN_CHART_ROWS,
  minObjectColumns,
} from 'src/mibi/format/columns';
import {
  openFormat,
  selectVisual,
  useIsVisualSelected,
} from 'src/mibi/format/selection';
import {
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
      width: 100vw;
      height: 100vh;
      padding: ${theme.sizeUnit * 2}px;
    }
  `;
  const { chartId } = component.meta;
  const isFullSize = fullSizeChartId === chartId;
  const chartHolderRef = useRef<HTMLDivElement | null>(null);

  const focusHighlightStyles = useFilterFocusHighlightStyles(chartId ?? 0);
  const visualFormat = useMergedVisualFormat(component.meta.mibiFormat);
  // AuraData BI: the report page its marks show as tooltip
  const tooltipPage = useChartTooltipPage(chartId, visualFormat);
  // A title with tokens shows the value or the selections it names
  const dynamicName = useDynamicTitle(
    visualFormat?.title?.template,
    component.meta.sliceNameOverride || component.meta.sliceName || '',
    component.meta.chartId ?? 0,
    t('All'),
  );
  const formatted = useMemo(
    () => visualStyle(visualFormat, theme),
    [visualFormat, theme],
  );
  const isSelected = useIsVisualSelected(component.id) && editMode;
  const mobile = useCanvasMobile();
  // The page is a limit: an object grows only into the room left on it
  const maxHeightMultiple = useMaxHeightMultiple(
    component.meta.height ?? GRID_MIN_ROW_UNITS,
    parentComponent,
    component.meta,
  );
  // A bookmark may show or hide the chart for this visit
  const hiddenOverride = useHiddenOverride(component.id);
  const hidden = hiddenOverride ?? !!component.meta.mibiHidden;
  const locked = useObjectLocked(component.meta);
  const altText = component.meta.mibiAltText as string | undefined;
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
      const { shrinkX, shrinkY } = formatted;
      width = Math.floor(widthMultiple * columnWidth - CHART_MARGIN - shrinkX);
      height = Math.floor(
        (component.meta.height ?? 0) * CELL - CHART_MARGIN - shrinkY,
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
    formatted.shrinkX,
    formatted.shrinkY,
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
        heightStep={CELL}
        heightMultiple={component.meta.height ?? GRID_MIN_ROW_UNITS}
        minWidthMultiple={Math.max(minObjectColumns(), MIN_CHART_COLUMNS)}
        minHeightMultiple={Math.max(GRID_MIN_ROW_UNITS, MIN_CHART_ROWS)}
        maxHeightMultiple={maxHeightMultiple}
        maxWidthMultiple={
          maxWidthCells(component.meta) ?? availableColumnCount + widthMultiple
        }
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        editMode={editMode}
        lockAspectRatio={!!visualFormat?.lockAspect}
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
          role={altText ? 'group' : undefined}
          aria-label={altText || undefined}
          style={holderStyle}
          data-mibi-echarts={echartsHostFormat(visualFormat, !!tooltipPage)}
          data-mibi-tooltip-page={tooltipPage}
          css={isFullSize ? fullSizeStyle : undefined}
          onClickCapture={
            editMode
              ? (event: MouseEvent<HTMLDivElement>) => {
                  // AuraData BI: the interaction controls keep the selection
                  if (!isInteractionControl(event.target)) {
                    selectVisual(
                      component.id,
                      event.shiftKey || event.metaKey || event.ctrlKey,
                    );
                  }
                }
              : undefined
          }
          className={cx(
            'dashboard-component',
            'dashboard-component-chart-holder',
            !isFullSize && formatted.className,
            isFullSize && 'mibi-full-size',
            isSelected && 'mibi-selected',
            editMode && hidden && 'mibi-hidden',
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
                editMode
                  ? component.meta.sliceNameOverride ||
                    component.meta.sliceName ||
                    ''
                  : dynamicName
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
            {editMode && chartId !== undefined && (
              <InteractionControl chartId={chartId} layoutId={component.id} />
            )}
            {editMode && <ObjectBadges meta={component.meta} hidden={hidden} />}
            {editMode && (
              <ObjectActions
                id={component.id}
                onDelete={locked ? undefined : handleDeleteComponent}
                onFormat={() => openFormat(component.id)}
                formatTestId="mibi-format-visual-button"
                deleteTestId="dashboard-delete-component-button"
              />
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
      altText,
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
      tooltipPage,
    ],
  );

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
      {renderChild}
    </MovableDraggable>
  );
};

export default memo(ChartHolder);
