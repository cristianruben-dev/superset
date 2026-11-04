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
/* eslint-env browser */
import { openChartEditor } from 'src/mibi/chartEditor';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { List, type RowComponentProps } from 'react-window';
// @ts-expect-error
import { createFilter } from 'react-search-input';
import { t } from '@apache-superset/core/translation';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { Button, Input, Loading, Select } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  CHART_TYPE,
  NEW_COMPONENT_SOURCE_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  NEW_CHART_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import { debounce, pickBy } from 'lodash-es';
import { Dispatch } from 'redux';
import { Slice } from 'src/dashboard/types';
import type { ConnectDragSource } from 'react-dnd';
import AddSliceCard from './AddSliceCard';
import AddSliceDragPreview from './dnd/AddSliceDragPreview';
import { DragDroppable } from './dnd/DragDroppable';
import { datasetLabelLower } from 'src/features/semanticLayers/label';

export type SliceAdderProps = {
  fetchSlices: (
    userId?: number,
    filter_value?: string,
    sortColumn?: string,
    dashboardId?: number,
  ) => Promise<void>;
  updateSlices: (slices: {
    [id: number]: Slice;
  }) => (dispatch: Dispatch) => void;
  isLoading: boolean;
  slices: Record<number, Slice>;
  lastUpdated: number;
  errorMessage?: string;
  userId: number;
  selectedSliceIds?: number[];
  editMode?: boolean;
  dashboardId: number;
};

const KEYS_TO_FILTERS = ['slice_name', 'viz_type', 'datasource_name'];
const KEYS_TO_SORT = {
  slice_name: t('name'),
  viz_type: t('viz type'),
  datasource_name: datasetLabelLower(),
  changed_on: t('recent'),
};

export const DEFAULT_SORT_KEY = 'changed_on';

const DEFAULT_CELL_HEIGHT = 64;

const Controls = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    padding:
      ${theme.sizeUnit}px
      ${theme.sizeUnit * 3}px
      ${theme.sizeUnit * 2}px;
  `}
`;

const StyledSelect = styled(Select)<{ id?: string }>`
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
  flex: none;
  width: 164px;
`;

const EmptyMessage = styled.div`
  ${({ theme }) => css`
    padding: 0 ${theme.sizeUnit * 3}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const NewChartButtonContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: flex-end;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px 0;
  `}
`;

const NewChartButton = styled(Button)`
  ${({ theme }) => css`
    height: auto;
    & > .anticon > span {
      margin: auto -${theme.sizeUnit}px auto 0;
    }
    & > [role='img']:first-of-type {
      padding-bottom: 1px;
      line-height: 0;
    }
  `}
`;

export const ChartList = styled.div`
  flex-grow: 1;
  min-height: 0;
`;

export function sortByComparator(attr: keyof Slice) {
  const desc = attr === 'changed_on' ? -1 : 1;

  return (a: Slice, b: Slice) => {
    const aValue = a[attr] ?? Number.MIN_SAFE_INTEGER;
    const bValue = b[attr] ?? Number.MIN_SAFE_INTEGER;

    if (aValue < bValue) {
      return -1 * desc;
    }
    if (aValue > bValue) {
      return 1 * desc;
    }
    return 0;
  };
}

function getFilteredSortedSlices(
  slices: SliceAdderProps['slices'],
  searchTerm: string,
  sortBy: keyof Slice,
) {
  return Object.values(slices)
    .filter(createFilter(searchTerm, KEYS_TO_FILTERS))
    .sort(sortByComparator(sortBy));
}

export interface SliceListRowProps {
  filteredSlices: Slice[];
  selectedSliceIdsSet: Set<number>;
  editMode: boolean;
}

// Rendered via `rowComponent`, so it must be a stable reference (module
// scope) rather than defined inline on every render of SliceAdder -
// otherwise react-window would treat it as a new component type each
// render and remount every row (losing in-flight drag state). All the
// data it needs is threaded through `rowProps` instead of being closed
// over.
export function SliceListRow({
  index,
  style,
  filteredSlices,
  selectedSliceIdsSet,
  editMode,
}: RowComponentProps<SliceListRowProps>) {
  const cellData = filteredSlices[index];

  const isSelected = selectedSliceIdsSet.has(cellData.slice_id);
  const type = CHART_TYPE;
  const id = NEW_CHART_ID;

  const meta = {
    chartId: cellData.slice_id,
    sliceName: cellData.slice_name,
  };
  return (
    <DragDroppable
      key={cellData.slice_id}
      component={{ type, id, meta }}
      parentComponent={{
        id: NEW_COMPONENTS_SOURCE_ID,
        type: NEW_COMPONENT_SOURCE_TYPE,
      }}
      index={index}
      depth={0}
      disableDragDrop={isSelected}
      editMode={editMode}
      // we must use a custom drag preview within the List because
      // it does not seem to work within a fixed-position container
      useEmptyDragPreview
      // List library expect style props here
      // actual style should be applied to nested AddSliceCard component
      style={{}}
    >
      {({ dragSourceRef }: { dragSourceRef: ConnectDragSource }) => (
        <AddSliceCard
          innerRef={dragSourceRef}
          style={style}
          sliceName={cellData.slice_name}
          lastModified={cellData.changed_on_humanized}
          visType={cellData.viz_type}
          datasourceUrl={cellData.datasource_url}
          datasourceName={cellData.datasource_name}
          isSelected={isSelected}
        />
      )}
    </DragDroppable>
  );
}

/**
 * Charts belong to a single dashboard (AuraData BI), so the editor only lists the charts
 * of this dashboard, e.g. the ones created from it that are not placed in the
 * layout yet. Charts of other dashboards can't be added.
 */
function SliceAdder({
  fetchSlices,
  updateSlices,
  isLoading,
  slices,
  errorMessage = '',
  selectedSliceIds = [],
  editMode = false,
  dashboardId,
}: SliceAdderProps) {
  const theme = useTheme();
  const slicesRequestRef = useRef<AbortController | Promise<void>>();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof Slice>(DEFAULT_SORT_KEY);
  const [selectedSliceIdsSet, setSelectedSliceIdsSet] = useState(
    () => new Set(selectedSliceIds),
  );

  // Refs to track latest values for cleanup effect
  const latestSlicesRef = useRef(slices);
  const latestSelectedSliceIdsSetRef = useRef(selectedSliceIdsSet);

  // Keep refs updated with latest values
  useEffect(() => {
    latestSlicesRef.current = slices;
  }, [slices]);

  useEffect(() => {
    latestSelectedSliceIdsSetRef.current = selectedSliceIdsSet;
  }, [selectedSliceIdsSet]);

  const filteredSlices = useMemo(
    () => getFilteredSortedSlices(slices, searchTerm, sortBy),
    [slices, searchTerm, sortBy],
  );

  // Refs so the debounced search reads the latest sortBy at fire time without
  // recreating the debounce (which would drop a pending, armed-but-not-yet-fired
  // search when sortBy changes).
  const sortByRef = useRef(sortBy);
  const searchTermRef = useRef(searchTerm);
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);
  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  const fetchSlicesRef = useRef(fetchSlices);
  useEffect(() => {
    fetchSlicesRef.current = fetchSlices;
  }, [fetchSlices]);

  // Only the charts of this dashboard
  const fetchDashboardSlices = useCallback(
    (term: string, sort: keyof Slice) => {
      slicesRequestRef.current = fetchSlicesRef.current(
        undefined,
        term,
        sort,
        dashboardId,
      );
    },
    [dashboardId],
  );

  // componentDidMount; "Create new chart" may open Explore in another tab, so
  // the list refreshes when the window gets the focus back
  useEffect(() => {
    fetchDashboardSlices('', sortByRef.current);
    const onWindowFocus = () =>
      fetchDashboardSlices(searchTermRef.current, sortByRef.current);
    window.addEventListener('focus', onWindowFocus);
    return () => window.removeEventListener('focus', onWindowFocus);
  }, [fetchDashboardSlices]);

  // Update selectedSliceIdsSet when selectedSliceIds prop changes
  useEffect(() => {
    setSelectedSliceIdsSet(new Set(selectedSliceIds));
  }, [selectedSliceIds]);

  // componentWillUnmount
  useEffect(
    () => () => {
      // Clears the redux store keeping only selected items
      // Use refs to get latest values on unmount
      const selectedSlices = pickBy(latestSlicesRef.current, (value: Slice) =>
        latestSelectedSliceIdsSetRef.current.has(value.slice_id),
      );

      updateSlices(selectedSlices);
      if (slicesRequestRef.current instanceof AbortController) {
        slicesRequestRef.current.abort();
      }
    },
    [updateSlices],
  );

  const searchUpdated = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // Create the debounce once (stable identity) so a pending search isn't
  // dropped when sortBy changes mid-typing. The debounced function reads the
  // latest values from refs at fire time.
  const handleChange = useMemo(
    () =>
      debounce((value: string) => {
        searchUpdated(value);
        fetchDashboardSlices(value, sortByRef.current);
      }, 300),
    [searchUpdated, fetchDashboardSlices],
  );

  useEffect(
    () => () => {
      handleChange.cancel();
    },
    [handleChange],
  );

  const handleSelect = useCallback(
    (newSortBy: keyof Slice) => {
      setSortBy(newSortBy);
      fetchDashboardSlices(searchTerm, newSortBy);
    },
    [fetchDashboardSlices, searchTerm],
  );

  const listRowProps = useMemo<SliceListRowProps>(
    () => ({ filteredSlices, selectedSliceIdsSet, editMode }),
    [filteredSlices, selectedSliceIdsSet, editMode],
  );

  return (
    <div
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
        button > span > :first-of-type {
          margin-right: 0;
        }
      `}
    >
      <NewChartButtonContainer>
        <NewChartButton
          buttonStyle="link"
          buttonSize="xsmall"
          icon={
            <Icons.PlusOutlined iconSize="m" iconColor={theme.colorPrimary} />
          }
          onClick={() =>
            openChartEditor({
              url: `/chart/add?dashboard_id=${dashboardId}`,
            })
          }
        >
          {t('Create new chart')}
        </NewChartButton>
      </NewChartButtonContainer>
      <Controls>
        <Input
          placeholder={t('Filter charts')}
          className="search-input"
          onChange={ev => handleChange(ev.target.value)}
          data-test="dashboard-charts-filter-search-input"
        />
        <StyledSelect
          id="slice-adder-sortby"
          value={sortBy}
          onChange={handleSelect}
          options={Object.entries(KEYS_TO_SORT).map(([key, label]) => ({
            label: t('Sort by %s', label),
            value: key,
          }))}
          placeholder={t('Sort by')}
        />
      </Controls>
      {isLoading && <Loading />}
      {!isLoading && !errorMessage && filteredSlices.length === 0 && (
        <EmptyMessage data-test="slice-adder-empty">
          {t(
            'Charts you create for this dashboard appear here, ready to drag into the layout.',
          )}
        </EmptyMessage>
      )}
      {!isLoading && filteredSlices.length > 0 && (
        <ChartList>
          <AutoSizer>
            {({ height, width }: { height: number; width: number }) => (
              <List
                style={{ width, height, maxHeight: height }}
                rowCount={filteredSlices.length}
                rowHeight={DEFAULT_CELL_HEIGHT}
                rowProps={listRowProps}
                rowComponent={SliceListRow}
                rowKey={(index, data) => data.filteredSlices[index].slice_id}
              />
            )}
          </AutoSizer>
        </ChartList>
      )}
      {errorMessage && (
        <div
          css={css`
            padding: 16px;
          `}
        >
          {errorMessage}
        </div>
      )}
      {/* Drag preview is just a single fixed-position element */}
      <AddSliceDragPreview slices={filteredSlices} />
    </div>
  );
}

export default SliceAdder;
