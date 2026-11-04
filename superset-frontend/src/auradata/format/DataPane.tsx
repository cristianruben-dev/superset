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
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { GenericDataType } from '@apache-superset/core/common';
import { SupersetClient } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import type { ColumnMeta, Metric } from '@superset-ui/chart-controls';
import { Button, Checkbox, Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { fetchDataSets } from 'src/auradata/data/api';
import DatasourcePanelDragOption from 'src/explore/components/DatasourcePanel/DatasourcePanelDragOption';
import { DndItemType } from 'src/explore/components/DndItemType';
import { changeChartDataset, type DataField } from './chartFields';
import { useChartFieldToggle } from './ChartFieldsSections';
import { searchable } from './controls';
import { setPaneCollapsed } from './panes';
import { useSelectedVisual } from './selection';

export const DATA_PANE_WIDTH = 260;

const Pane = styled.aside<{ $top: number; $pageTop: number }>`
  ${({ theme, $top, $pageTop }) => css`
    position: sticky;
    top: ${$top}px;
    flex: none;
    box-sizing: border-box;
    width: ${DATA_PANE_WIDTH}px;
    height: calc(100vh - ${$top + $pageTop}px);
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};
    border-left: 1px solid ${theme.colorBorderSecondary};

    .pane-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: ${theme.fontWeightStrong};
    }

    .pane-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .dataset-name {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      width: 100%;
      padding: ${theme.sizeUnit}px 0;
      border: 0;
      background: none;
      color: ${theme.colorText};
      font-weight: ${theme.fontWeightStrong};
      text-align: left;
      cursor: pointer;
    }

    .dataset-group {
      margin: ${theme.sizeUnit}px 0;
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
    }

    .dataset-fields {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit / 2}px;
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    .dataset-field {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;

      > :last-child {
        flex: 1;
        min-width: 0;
      }
    }

    .dataset-fields.other {
      opacity: 0.5;
      pointer-events: none;
    }

    .dataset-other {
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

type Dataset = {
  datasource_name?: string;
  table_name?: string;
  name?: string;
  columns?: ColumnMeta[];
  metrics?: Metric[];
};

/** The key of a dataset in the `datasources` of the dashboard state. */
const datasetKey = (id: number) => `${id}__table`;

/** Fields of a dataset no chart of the report uses yet, loaded when opened. */
async function fetchDatasetFields(key: string): Promise<Dataset> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/dataset/${parseInt(key, 10)}`,
  });
  const { table_name: tableName, columns, metrics } = json.result as Dataset;
  return { table_name: tableName, columns, metrics };
}

/**
 * The datasets the charts of a dashboard can use, by key and name: those of its
 * workspace and the shared ones, as the server decides.
 */
function useUsableDatasets(dashboardId: number | undefined) {
  const [usable, setUsable] = useState<Record<string, string>>({});
  useEffect(() => {
    if (dashboardId === undefined) return undefined;
    let current = true;
    fetchDataSets(dashboardId)
      .then(list => {
        if (current)
          setUsable(
            Object.fromEntries(
              list.map(dataset => [datasetKey(dataset.id), dataset.table_name]),
            ),
          );
      })
      // Without the list the pane keeps the datasets the charts already use
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [dashboardId]);
  return usable;
}

/**
 * The dataset of the field being dragged from the pane, so a chart of another
 * dataset can refuse it when it is dropped on the canvas.
 */
export const draggedField: { dataset?: string } = {};

const metricField = (metric: Metric): DataField => ({
  kind: 'metric',
  name: metric.metric_name,
});
const columnField = (column: ColumnMeta): DataField => ({
  kind: 'column',
  name: column.column_name,
  numeric: column.type_generic === GenericDataType.Numeric,
  value: column,
});

const nameOfMetric = (metric: Metric) =>
  metric.verbose_name || metric.metric_name;
const nameOfColumn = (column: ColumnMeta) =>
  column.verbose_name || column.column_name;

/**
 * The tables of the report and their fields, beside the canvas as in Power BI, to
 * drag onto the field wells of a chart. A chart only takes fields of its dataset.
 */
export function DataPane({
  topOffset = 0,
  pageTop = 0,
}: {
  topOffset?: number;
  pageTop?: number;
}) {
  const datasources = useSelector(
    (state: RootState) =>
      state.datasources as unknown as Record<string, Dataset>,
  );
  const dispatch = useDispatch();
  const dashboardId = useSelector(
    (state: RootState) => state.dashboardInfo?.id,
  );
  const usableDatasets = useUsableDatasets(dashboardId);
  const [fetched, setFetched] = useState<Record<string, Dataset | null>>({});
  const selected = useSelectedVisual();
  const selectedChartId = useSelector((state: RootState) =>
    selected
      ? (state.dashboardLayout.present[selected]?.meta?.chartId as
          | number
          | undefined)
      : undefined,
  );
  const fieldToggle = useChartFieldToggle(
    selectedChartId === undefined ? undefined : (selected ?? undefined),
    selectedChartId,
  );
  /** A field with the box that adds it to the selected chart, as Power BI. */
  const withBox = (field: DataField, name: string, option: ReactNode) =>
    fieldToggle.ready ? (
      <div className="dataset-field" key={`${field.kind}:${field.name}`}>
        <Checkbox
          checked={fieldToggle.uses(field)}
          aria-label={t('Show %s in the chart', name)}
          data-test="auradata-data-pane-field-box"
          onChange={event => fieldToggle.toggle(field, event.target.checked)}
        />
        {option}
      </div>
    ) : (
      <Fragment key={`${field.kind}:${field.name}`}>{option}</Fragment>
    );
  const selectedDataset = useSelector((state: RootState) => {
    const chartId = selected
      ? state.dashboardLayout.present[selected]?.meta?.chartId
      : undefined;
    return chartId === undefined
      ? undefined
      : String(
          (
            state.charts as unknown as Record<
              number,
              { form_data?: { datasource?: string } }
            >
          )[chartId]?.form_data?.datasource,
        );
  });
  const [search, setSearch] = useState('');
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const query = searchable(search.trim());
  // The datasets the charts use first, then the others they could use
  const keys = useMemo(() => {
    const used = Object.keys(datasources ?? {});
    const others = Object.keys(usableDatasets)
      .filter(key => !used.includes(key))
      .sort((a, b) => usableDatasets[a].localeCompare(usableDatasets[b]));
    return [...used, ...others].sort((a, b) =>
      a === selectedDataset ? -1 : b === selectedDataset ? 1 : 0,
    );
  }, [datasources, selectedDataset, usableDatasets]);
  const usedCount = Object.keys(datasources ?? {}).length;
  const datasetOf = (key: string): Dataset =>
    datasources?.[key] ??
    fetched[key] ?? {
      table_name: usableDatasets[key],
      columns: [],
      metrics: [],
    };
  const open = (key: string) => {
    setToggled(current => ({ ...current, [key]: true }));
    if (datasources?.[key] || key in fetched) return;
    setFetched(current => ({ ...current, [key]: null }));
    fetchDatasetFields(key)
      .then(dataset => setFetched(current => ({ ...current, [key]: dataset })))
      .catch(() =>
        setFetched(current => {
          const next = { ...current };
          delete next[key];
          return next;
        }),
      );
  };
  const matches = (text: string) => searchable(text).includes(query);

  return (
    <Pane $top={topOffset} $pageTop={pageTop} data-test="auradata-data-pane">
      <div className="pane-title">
        <span>{t('Data')}</span>
        <Button
          buttonStyle="link"
          aria-label={t('Close')}
          data-test="auradata-data-pane-close"
          onClick={() => setPaneCollapsed('data', true)}
        >
          <Icons.CloseOutlined iconSize="s" />
        </Button>
      </div>
      <Input
        allowClear
        placeholder={t('Search')}
        aria-label={t('Search fields')}
        value={search}
        onChange={event => setSearch(event.target.value)}
      />
      <div className="pane-list">
        {keys.map(key => {
          const dataset = datasetOf(key);
          const loading = !datasources?.[key] && fetched[key] === null;
          const name =
            dataset.datasource_name || dataset.table_name || dataset.name || '';
          const metrics = (dataset.metrics ?? []).filter(metric =>
            matches(nameOfMetric(metric)),
          );
          const columns = (dataset.columns ?? []).filter(column =>
            matches(nameOfColumn(column)),
          );
          if (query && !metrics.length && !columns.length && !matches(name))
            return null;
          // A chart only takes fields of its own dataset
          const usable = !selectedDataset || key === selectedDataset;
          const isOpen =
            !!query ||
            (toggled[key] ??
              (key === selectedDataset ||
                (usedCount === 1 && !!datasources?.[key])));
          return (
            <section
              key={key}
              data-test="auradata-data-pane-dataset"
              // A drag starts with the pointer down on one of its fields
              onPointerDownCapture={() => {
                draggedField.dataset = key;
              }}
            >
              <button
                type="button"
                className="dataset-name"
                aria-expanded={isOpen}
                onClick={() =>
                  isOpen ? setToggled({ ...toggled, [key]: false }) : open(key)
                }
              >
                {isOpen ? (
                  <Icons.DownOutlined iconSize="xs" />
                ) : (
                  <Icons.RightOutlined iconSize="xs" />
                )}
                {name}
              </button>
              {isOpen && loading && (
                <div className="dataset-other">{t('Loading...')}</div>
              )}
              {isOpen && !usable && (
                <div className="dataset-other">
                  {t('The selected chart uses another table.')}
                  {fieldToggle.ready && selected && selectedChartId && (
                    <Button
                      buttonSize="xsmall"
                      buttonStyle="link"
                      data-test="auradata-data-pane-use-dataset"
                      onClick={() =>
                        dispatch(
                          changeChartDataset({
                            id: selected,
                            chartId: selectedChartId,
                            datasetKey: key,
                          }) as never,
                        )
                      }
                    >
                      {t('Use this table in the chart')}
                    </Button>
                  )}
                </div>
              )}
              {isOpen && !!metrics.length && (
                <>
                  <div className="dataset-group">{t('Measures')}</div>
                  <div
                    className={
                      usable ? 'dataset-fields' : 'dataset-fields other'
                    }
                  >
                    {metrics.map(metric =>
                      usable ? (
                        withBox(
                          metricField(metric),
                          nameOfMetric(metric),
                          <DatasourcePanelDragOption
                            value={metric}
                            type={DndItemType.Metric}
                            showTooltip
                          />,
                        )
                      ) : (
                        <DatasourcePanelDragOption
                          key={metric.metric_name}
                          value={metric}
                          type={DndItemType.Metric}
                          showTooltip
                        />
                      ),
                    )}
                  </div>
                </>
              )}
              {isOpen && !!columns.length && (
                <>
                  <div className="dataset-group">{t('Columns')}</div>
                  <div
                    className={
                      usable ? 'dataset-fields' : 'dataset-fields other'
                    }
                  >
                    {columns.map(column =>
                      usable ? (
                        withBox(
                          columnField(column),
                          nameOfColumn(column),
                          <DatasourcePanelDragOption
                            value={column}
                            type={DndItemType.Column}
                            showTooltip
                          />,
                        )
                      ) : (
                        <DatasourcePanelDragOption
                          key={column.column_name}
                          value={column}
                          type={DndItemType.Column}
                          showTooltip
                        />
                      ),
                    )}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </Pane>
  );
}
