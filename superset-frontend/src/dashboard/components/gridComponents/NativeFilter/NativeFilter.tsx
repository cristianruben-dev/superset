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
import { FC, useCallback, useMemo } from 'react';
import cx from 'classnames';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Filter, NativeFilterType } from '@superset-ui/core';
import { Checkbox, Select, Typography } from '@superset-ui/core/components';
import { ResizeCallback, ResizeStartCallback } from 're-resizable';
import type { ConnectDragSource } from 'react-dnd';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { Draggable } from '../../dnd/DragDroppable';
import { COLUMN_TYPE, ROW_TYPE } from '../../../util/componentTypes';
import ResizableContainer from '../../resizable/ResizableContainer';
import { GRID_BASE_UNIT, GRID_MIN_COLUMN_COUNT } from '../../../util/constants';
import HoverMenu from '../../menu/HoverMenu';
import DeleteComponentButton from '../../DeleteComponentButton';
import { LayoutItem } from '../../../types';
import CanvasFilterControl from './CanvasFilterControl';

type NativeFilterProps = {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;
  columnWidth: number;
  availableColumnCount: number;
  handleComponentDrop: (dropResult: unknown) => void;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: (updates: Record<string, LayoutItem>) => void;
};

const Container = styled.div`
  ${({ theme }) => `
    background-color: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    position: relative;
    width: 100%;

    &.dashboard-component-native-filter--editing {
      border: 1px dashed ${theme.colorBorder};
    }
  `}
`;

const EditorRow = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const NativeFilter: FC<NativeFilterProps> = ({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  editMode,
  columnWidth,
  availableColumnCount,
  handleComponentDrop,
  onResizeStart,
  onResize,
  onResizeStop,
  deleteComponent,
  updateComponents,
}) => {
  const filters = useFilters();
  const filterId = component.meta?.filterId as string | undefined;
  const showInFilterBar = component.meta?.showInFilterBar !== false;
  const candidate = filterId ? filters[filterId] : undefined;
  const filter =
    candidate?.type === NativeFilterType.NativeFilter
      ? (candidate as Filter)
      : undefined;

  const filterOptions = useMemo(
    () =>
      Object.values(filters)
        .filter(
          (item): item is Filter => item.type === NativeFilterType.NativeFilter,
        )
        .map(nativeFilter => ({
          value: nativeFilter.id,
          label: nativeFilter.name,
        })),
    [filters],
  );

  const widthMultiple =
    parentComponent.type === COLUMN_TYPE
      ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
      : component.meta.width || GRID_MIN_COLUMN_COUNT;

  const updateMeta = useCallback(
    (meta: Partial<LayoutItem['meta']>) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: { ...component.meta, ...meta },
        },
      });
    },
    [component, updateComponents],
  );

  const handleDelete = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const renderBody = () => {
    if (filter) {
      return <CanvasFilterControl filter={filter} />;
    }
    if (filterId) {
      return (
        <Typography.Text type="secondary">
          {t('The selected filter no longer exists')}
        </Typography.Text>
      );
    }
    return (
      <Typography.Text type="secondary">
        {editMode
          ? t('Choose a dashboard filter to show here')
          : t('No filter selected')}
      </Typography.Text>
    );
  };

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {({ dragSourceRef }: { dragSourceRef: ConnectDragSource }) => (
        <div
          data-test="dashboard-native-filter-component"
          className="dashboard-component dashboard-component-native-filter"
          id={component.id}
        >
          <ResizableContainer
            id={component.id}
            editMode={editMode}
            adjustableWidth={parentComponent.type === ROW_TYPE}
            adjustableHeight={false}
            heightMultiple={0}
            widthStep={columnWidth}
            widthMultiple={widthMultiple}
            heightStep={GRID_BASE_UNIT}
            minWidthMultiple={GRID_MIN_COLUMN_COUNT}
            maxWidthMultiple={availableColumnCount + widthMultiple}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
          >
            <Container
              ref={dragSourceRef}
              className={cx(
                editMode && 'dashboard-component-native-filter--editing',
              )}
            >
              {editMode && (
                <HoverMenu position="top">
                  <DeleteComponentButton onDelete={handleDelete} />
                </HoverMenu>
              )}
              {editMode && (
                <EditorRow>
                  <Select
                    ariaLabel={t('Filter to show')}
                    placeholder={t('Select a filter')}
                    options={filterOptions}
                    value={filterId}
                    onChange={value =>
                      updateMeta({ filterId: value as unknown as string })
                    }
                  />
                  <Checkbox
                    checked={showInFilterBar}
                    onChange={event =>
                      updateMeta({ showInFilterBar: event.target.checked })
                    }
                  >
                    {t('Also show in the filter bar')}
                  </Checkbox>
                </EditorRow>
              )}
              {renderBody()}
            </Container>
          </ResizableContainer>
        </div>
      )}
    </Draggable>
  );
};

export default NativeFilter;
