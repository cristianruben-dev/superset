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
import { Fragment, useCallback, useRef } from 'react';
import classNames from 'classnames';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { EmptyState } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { navigateTo } from 'src/utils/navigationUtils';
import type { LayoutItem } from 'src/dashboard/types';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import DashboardComponent from '../containers/DashboardComponent';
import { Droppable } from './dnd/DragDroppable';
import { CELL } from 'src/mibi/format/types';
import { gridColumnCount } from 'src/mibi/format/columns';
import { GridGuide } from 'src/mibi/format/gridGuides';
import { TAB_TYPE } from '../util/componentTypes';
import { DASHBOARD_GRID_CLASS } from '../util/embeddedLayout';

export interface DashboardGridProps {
  depth: number;
  editMode?: boolean;
  canEdit?: boolean;
  gridComponent?: LayoutItem;
  handleComponentDrop: (dropResult: DropResult) => void;
  isComponentVisible: boolean;
  resizeComponent: (params: {
    id: string;
    width: number;
    height: number;
  }) => void;
  setDirectPathToChild: (path: string[]) => void;
  setEditMode?: (editMode: boolean) => void;
  width: number;
  dashboardId?: number;
}

interface DropProps {
  dropIndicatorProps?: Record<string, unknown>;
}

const renderDraggableContent = (dropProps: DropProps) =>
  dropProps.dropIndicatorProps && <div {...dropProps.dropIndicatorProps} />;

// An empty page or tab: a card hanging from the top of the page, so it never
// spills over the tabs above however short the grid is. Drops pass through
// the space around it to the grid below.
const DashboardEmptyStateContainer = styled.div`
  ${({ theme }) => css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1;
    pointer-events: none;
    display: flex;
    justify-content: center;
    padding: ${theme.sizeUnit * 10}px ${theme.sizeUnit * 6}px;

    & > * {
      width: 100%;
      max-width: 520px;
      padding: ${theme.sizeUnit * 8}px ${theme.sizeUnit * 6}px;
      border: 1.5px dashed ${theme.colorBorder};
      border-radius: ${theme.borderRadiusLG * 1.5}px;
      background: ${theme.colorBgContainer};
      pointer-events: auto;
    }
  `}
`;

const GridContent = styled.div<{ editMode?: boolean }>`
  ${({ theme, editMode }) => css`
    display: flex;
    flex-direction: column;
    /* gutters between rows */
    & > div:not(:last-child):not(.empty-droptarget) {
      ${!editMode && `margin-bottom: ${theme.sizeUnit * 4}px`};
    }

    .empty-droptarget {
      width: 100%;
      height: ${theme.sizeUnit * 4}px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: ${theme.borderRadius}px;
      overflow: hidden;

      &:before {
        content: '';
        display: block;
        width: calc(100% - ${theme.sizeUnit * 2}px);
        height: calc(100% - ${theme.sizeUnit * 2}px);
        border: 1px dashed transparent;
        border-radius: ${theme.borderRadius}px;
        opacity: 0.5;
      }
    }

    & > .empty-droptarget:first-of-type {
      height: ${theme.sizeUnit * 4}px;
      margin-top: ${theme.sizeUnit * -4}px;
    }

    & > .empty-droptarget:last-child {
      height: ${theme.sizeUnit * 24}px;
    }

    & > .empty-droptarget.empty-droptarget--full:only-child {
      height: 80vh;
    }
  `}
`;

function DashboardGrid({
  depth,
  editMode,
  canEdit,
  gridComponent,
  handleComponentDrop,
  isComponentVisible,
  resizeComponent,
  setDirectPathToChild,
  setEditMode,
  width,
  dashboardId,
}: DashboardGridProps) {
  const theme = useTheme();
  const gridRef = useRef<HTMLDivElement | null>(null);

  const setGridRef = useCallback((ref: HTMLDivElement | null): void => {
    gridRef.current = ref;
  }, []);

  // The grid of cells always shows while editing, so resizing needs no guides
  const handleResizeStart = useCallback((): void => {}, []);

  const handleResize = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      _direction: string,
      _elementRef: HTMLElement,
      _delta: { width: number; height: number },
    ): void => {
      // no-op: the cell grid is the guide
    },
    [],
  );

  const handleResizeStop = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      _direction: string,
      _elementRef: HTMLElement,
      delta: { width: number; height: number },
      id: string,
    ): void => {
      resizeComponent({
        id,
        width: delta.width,
        height: delta.height,
      });
    },
    [resizeComponent],
  );

  const handleTopDropTargetDrop = useCallback(
    (dropResult: DropResult): void => {
      if (dropResult?.destination) {
        handleComponentDrop({
          ...dropResult,
          destination: {
            ...dropResult.destination,
            // force appending as the first child if top drop target
            index: 0,
          },
        });
      }
    },
    [handleComponentDrop],
  );

  const handleChangeTab = useCallback(
    ({ pathToTabIndex }: { pathToTabIndex: string[] }): void => {
      setDirectPathToChild(pathToTabIndex);
    },
    [setDirectPathToChild],
  );

  // Objects are measured in cells of the canvas
  const columnWidth = CELL;

  const shouldDisplayEmptyState = gridComponent?.children?.length === 0;
  const shouldDisplayTopLevelTabEmptyState =
    shouldDisplayEmptyState && gridComponent?.type === TAB_TYPE;

  const dashboardEmptyState = editMode && (
    <EmptyState
      title={t('Drag and drop components and charts to the dashboard')}
      description={t(
        'You can create a new chart or use existing ones from the panel on the right',
      )}
      size="medium"
      buttonText={
        <>
          <Icons.PlusOutlined iconSize="m" color={theme.colorPrimary} />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        navigateTo(`/chart/add?dashboard_id=${dashboardId}`, {
          newWindow: true,
        });
      }}
      image="chart.svg"
    />
  );

  const topLevelTabEmptyState = editMode ? (
    <EmptyState
      title={t('Drag and drop components to this tab')}
      size="medium"
      description={t(
        `You can create a new chart or use existing ones from the panel on the right`,
      )}
      buttonText={
        <>
          <Icons.PlusOutlined iconSize="m" color={theme.colorPrimary} />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        navigateTo(`/chart/add?dashboard_id=${dashboardId}`, {
          newWindow: true,
        });
      }}
      image="chart.svg"
    />
  ) : (
    <EmptyState
      title={t('There are no components added to this tab')}
      size="large"
      description={canEdit && t('You can add the components in the edit mode.')}
      buttonText={canEdit ? t('Edit the dashboard') : undefined}
      buttonAction={
        canEdit
          ? () => {
              setEditMode?.(true);
            }
          : undefined
      }
      image="chart.svg"
    />
  );

  return width < 100 ? null : (
    <>
      {shouldDisplayEmptyState && (
        <DashboardEmptyStateContainer>
          {shouldDisplayTopLevelTabEmptyState
            ? topLevelTabEmptyState
            : dashboardEmptyState}
        </DashboardEmptyStateContainer>
      )}
      <div className={DASHBOARD_GRID_CLASS} ref={setGridRef}>
        <GridContent
          className="grid-content"
          data-test="grid-content"
          editMode={editMode}
        >
          {editMode && <GridGuide />}
          {/* make the area above components droppable */}
          {editMode && (
            <Droppable
              component={gridComponent}
              depth={depth}
              parentComponent={null}
              index={0}
              orientation="column"
              onDrop={handleTopDropTargetDrop}
              className={classNames({
                'empty-droptarget': true,
                'empty-droptarget--full': gridComponent?.children?.length === 0,
              })}
              editMode
              dropToChild={gridComponent?.children?.length === 0}
            >
              {renderDraggableContent}
            </Droppable>
          )}
          {gridComponent?.children?.map((id, index) => (
            <Fragment key={id}>
              <DashboardComponent
                id={id}
                parentId={gridComponent.id}
                depth={depth + 1}
                index={index}
                availableColumnCount={gridColumnCount()}
                columnWidth={columnWidth}
                isComponentVisible={isComponentVisible}
                onResizeStart={handleResizeStart}
                onResize={handleResize}
                onResizeStop={handleResizeStop}
                onChangeTab={handleChangeTab}
              />
              {/* make the area below components droppable */}
              {editMode && (
                <Droppable
                  component={gridComponent}
                  depth={depth}
                  parentComponent={null}
                  index={index + 1}
                  orientation="column"
                  onDrop={handleComponentDrop}
                  className="empty-droptarget"
                  editMode
                >
                  {renderDraggableContent}
                </Droppable>
              )}
            </Fragment>
          ))}
        </GridContent>
      </div>
    </>
  );
}

export default DashboardGrid;
