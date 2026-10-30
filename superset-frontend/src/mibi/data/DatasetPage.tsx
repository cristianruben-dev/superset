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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { t, tn } from '@apache-superset/core/translation';
import { GenericDataType } from '@apache-superset/core/common';
import { css, styled } from '@apache-superset/core/theme';
import {
  DatasourceType,
  getClientErrorObject,
  SupersetClient,
} from '@superset-ui/core';
import { ColumnTypeLabel } from '@superset-ui/chart-controls';
import {
  Button,
  Loading,
  Skeleton,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { DatasourceModal } from 'src/components';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { ColumnObject, DatasetObject } from 'src/features/datasets/types';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { findPermission } from 'src/utils/findPermission';
import { VizTypeIcon } from '../vizIcons/VizTypeIcon';
import { Page } from '../workspaces/WorkspaceListPage';
import { fetchEditableDataset } from './api';
import { MetricModal, type MetricFields } from './MetricModal';

type Tab = 'columns' | 'metrics' | 'preview' | 'usage';

type Metric = DatasetObject['metrics'][number];

interface DatasetDetail extends DatasetObject {
  kind?: 'physical' | 'virtual';
  database?: { id: number; database_name: string };
}

interface RelatedObjects {
  charts: {
    count: number;
    result: { id: number; slice_name: string; viz_type?: string }[];
  };
  dashboards: {
    count: number;
    result: { id: number; title: string; slug?: string | null }[];
  };
}

interface Samples {
  colnames: string[];
  data: Record<string, unknown>[];
}

const Crumbs = styled.nav`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 1.5}px;
    margin-bottom: ${theme.sizeUnit * 4}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};

    a {
      color: ${theme.colorTextSecondary};
      font-weight: 500;
    }
  `}
`;

const Hero = styled.header`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 5}px;
    padding: ${theme.sizeUnit * 6}px ${theme.sizeUnit * 7}px;
    margin-bottom: ${theme.sizeUnit * 6}px;
    border-radius: ${theme.borderRadiusLG + 4}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background:
      radial-gradient(
        600px 200px at 0% 0%,
        ${theme.colorPrimaryBg},
        transparent 70%
      ),
      ${theme.colorBgContainer};

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 64px;
      height: 64px;
      border-radius: 18px;
      background: ${theme.colorPrimary};
      color: ${theme.colorTextLightSolid};
      font-size: 28px;
      box-shadow: ${theme.boxShadowSecondary};

      &.virtual {
        background: ${theme.colorWarning};
      }
    }

    .titles {
      flex: 1;
      min-width: 240px;
    }

    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.024em;
      color: ${theme.colorText};
      word-break: break-word;
    }

    .description {
      margin: ${theme.sizeUnit * 1.5}px 0 0;
      color: ${theme.colorTextSecondary};
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 2}px;
      margin-top: ${theme.sizeUnit * 3}px;

      > span {
        display: inline-flex;
        align-items: center;
        gap: ${theme.sizeUnit * 1.5}px;
        height: 24px;
        padding: 0 ${theme.sizeUnit * 2.5}px;
        border-radius: 999px;
        background: ${theme.colorFillTertiary};
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
      }
    }

    .actions {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const Tabs = styled.div`
  ${({ theme }) => css`
    display: flex;
    gap: ${theme.sizeUnit * 6}px;
    margin-bottom: ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    button {
      all: unset;
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 3}px 0;
      font-weight: 500;
      color: ${theme.colorTextSecondary};
      cursor: pointer;

      &:hover {
        color: ${theme.colorText};
      }

      &[aria-selected='true'] {
        color: ${theme.colorPrimary};
        font-weight: 600;

        &::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 3px;
          border-radius: 3px 3px 0 0;
          background: ${theme.colorPrimary};
        }
      }

      &:focus-visible {
        outline: 2px solid ${theme.colorPrimaryBorder};
      }

      .count {
        padding: 0 ${theme.sizeUnit * 1.5}px;
        border-radius: 999px;
        background: ${theme.colorFillSecondary};
        font-size: 11px;
        line-height: 18px;
        color: ${theme.colorTextSecondary};
      }
    }
  `}
`;

const Panel = styled.section`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    overflow: hidden;

    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }

    .item {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;

      & + .item {
        border-top: 1px solid ${theme.colorBorderSecondary};
      }

      &:hover .item-actions {
        opacity: 1;
      }
    }

    .main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;

      strong {
        font-weight: 600;
        word-break: break-word;
      }

      .sub {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
      }
    }

    code {
      display: inline-block;
      max-width: 100%;
      margin-top: ${theme.sizeUnit}px;
      padding: 1px ${theme.sizeUnit * 2}px;
      border-radius: ${theme.borderRadiusSM}px;
      background: ${theme.colorFillTertiary};
      font-family: ${theme.fontFamilyCode};
      font-size: 12px;
      color: ${theme.colorText};
      white-space: pre-wrap;
      word-break: break-word;
    }

    .type {
      flex-shrink: 0;
      min-width: 90px;
      font-family: ${theme.fontFamilyCode};
      font-size: 11px;
      color: ${theme.colorTextTertiary};
      text-align: right;
    }

    .flags {
      display: flex;
      gap: ${theme.sizeUnit}px;
      flex-shrink: 0;

      span {
        padding: 0 ${theme.sizeUnit * 2}px;
        border-radius: 999px;
        background: ${theme.colorFillTertiary};
        font-size: 11px;
        line-height: 20px;
        color: ${theme.colorTextSecondary};
      }

      .time {
        background: ${theme.colorPrimaryBg};
        color: ${theme.colorPrimary};
      }
    }

    .metric-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: ${theme.colorSuccessBg};
      color: ${theme.colorSuccessText};
      font-weight: 700;
      font-family: ${theme.fontFamilyCode};
    }

    .item-actions {
      display: flex;
      gap: ${theme.sizeUnit}px;
      opacity: 0;
      transition: opacity ${theme.motionDurationFast};

      &:focus-within {
        opacity: 1;
      }

      @media (hover: none) {
        opacity: 1;
      }
    }

    .empty {
      padding: ${theme.sizeUnit * 12}px ${theme.sizeUnit * 6}px;
      text-align: center;
      color: ${theme.colorTextSecondary};

      strong {
        display: block;
        margin-bottom: ${theme.sizeUnit}px;
        font-size: ${theme.fontSizeLG}px;
        color: ${theme.colorText};
      }
    }

    .preview {
      max-height: 520px;
      overflow: auto;

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${theme.fontSizeSM}px;
        font-variant-numeric: tabular-nums;
      }

      th {
        position: sticky;
        top: 0;
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
        background: ${theme.colorFillQuaternary};
        backdrop-filter: blur(8px);
        text-align: left;
        font-weight: 600;
        white-space: nowrap;
        border-bottom: 1px solid ${theme.colorBorderSecondary};
      }

      td {
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
        border-bottom: 1px solid ${theme.colorBorderSecondary};
        white-space: nowrap;
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      tr:hover td {
        background: ${theme.colorFillQuaternary};
      }

      .number {
        text-align: right;
      }
    }

    .usage {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .usage > div + div {
      border-left: 1px solid ${theme.colorBorderSecondary};
    }

    .usage h3 {
      margin: 0;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      color: ${theme.colorTextSecondary};
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }

    .usage a,
    .usage .chart {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2.5}px ${theme.sizeUnit * 4}px;
      color: ${theme.colorText};

      .anticon,
      svg {
        color: ${theme.colorPrimary};
      }
    }

    .usage .none {
      padding: ${theme.sizeUnit * 4}px;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

/** The generic type behind a database column type, for its icon. */
export function genericType(
  column: ColumnObject,
): GenericDataType | 'expression' {
  if (column.expression) return 'expression';
  if (column.is_dttm) return GenericDataType.Temporal;
  const type = (column.type || '').toUpperCase();
  if (/BOOL/.test(type)) return GenericDataType.Boolean;
  if (/INT|NUM|DEC|FLOAT|DOUBLE|REAL|MONEY/.test(type))
    return GenericDataType.Numeric;
  if (/DATE|TIME/.test(type)) return GenericDataType.Temporal;
  return GenericDataType.String;
}

const metricPayload = (metric: Metric | MetricFields) => ({
  ...(metric.id ? { id: metric.id } : {}),
  metric_name: metric.metric_name,
  expression: metric.expression || '',
  verbose_name: metric.verbose_name || null,
  description: metric.description || null,
  d3format: metric.d3format || null,
});

/** A dataset: its columns, its metrics, a preview of its rows and where it is used. */
export default function DatasetPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const id = Number(datasetId);
  const { addDangerToast, addSuccessToast } = useToasts();
  const user = useSelector<
    { user: UserWithPermissionsAndRoles },
    UserWithPermissionsAndRoles
  >(state => state.user);
  const canWrite = findPermission('can_write', 'Dataset', user?.roles || {});
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>('columns');
  const [samples, setSamples] = useState<Samples | null>(null);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [related, setRelated] = useState<RelatedObjects | null>(null);
  const [editingMetric, setEditingMetric] = useState<{
    metric?: MetricFields;
  } | null>(null);
  const [editingDataset, setEditingDataset] = useState(false);

  const load = useCallback(() => {
    fetchEditableDataset(id)
      .then(result => setDataset(result as DatasetDetail))
      .catch(() => setMissing(true));
  }, [id]);

  useEffect(() => {
    setDataset(null);
    setSamples(null);
    setSamplesError(null);
    setRelated(null);
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'preview' && !samples && !samplesError) {
      getDatasourceSamples(DatasourceType.Table, id, false, {}, 100, 1)
        .then(result => setSamples(result as Samples))
        .catch(async error => {
          const { error: message } = await getClientErrorObject(error);
          setSamplesError(message || t('The rows could not be loaded'));
        });
    }
    if (tab === 'usage' && !related) {
      SupersetClient.get({ endpoint: `/api/v1/dataset/${id}/related_objects` })
        .then(({ json }) => setRelated(json as RelatedObjects))
        .catch(() =>
          setRelated({
            charts: { count: 0, result: [] },
            dashboards: { count: 0, result: [] },
          }),
        );
    }
  }, [tab, id, samples, samplesError, related]);

  const columnNames = useMemo(
    () =>
      (dataset?.columns || [])
        .filter(column => genericType(column) === GenericDataType.Numeric)
        .map(column => column.column_name),
    [dataset],
  );

  const saveMetrics = async (metrics: ReturnType<typeof metricPayload>[]) => {
    await SupersetClient.put({
      endpoint: `/api/v1/dataset/${id}`,
      jsonPayload: { metrics },
    });
    load();
  };

  const saveMetric = async (fields: MetricFields) => {
    const others = (dataset?.metrics || [])
      .filter(metric => metric.id !== fields.id)
      .map(metricPayload);
    try {
      await saveMetrics([...others, metricPayload(fields)]);
      addSuccessToast(fields.id ? t('Metric updated') : t('Metric created'));
      setEditingMetric(null);
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(message || t('The metric could not be saved'));
    }
  };

  const deleteMetric = async (metric: Metric) => {
    try {
      await saveMetrics(
        (dataset?.metrics || [])
          .filter(other => other.id !== metric.id)
          .map(metricPayload),
      );
      addSuccessToast(t('Metric deleted'));
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(message || t('The metric could not be deleted'));
    }
  };

  if (missing) {
    return (
      <Page>
        <Panel>
          <div className="empty">
            <strong>{t('This dataset does not exist')}</strong>
            <Link to="/data/">{t('Back to data')}</Link>
          </div>
        </Panel>
      </Page>
    );
  }

  if (!dataset) {
    return (
      <Page>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Page>
    );
  }

  const virtual = dataset.kind === 'virtual' || !!dataset.sql;
  const tabs: [Tab, string, number | null][] = [
    ['columns', t('Columns'), dataset.columns.length],
    ['metrics', t('Metrics'), dataset.metrics.length],
    ['preview', t('Preview'), null],
    ['usage', t('Usage'), null],
  ];

  return (
    <Page data-test="dataset-page">
      <Crumbs aria-label={t('Breadcrumb')}>
        <Link to="/data/">{t('Data')}</Link>
        <Icons.RightOutlined iconSize="xs" />
        <span>{dataset.table_name}</span>
      </Crumbs>

      <Hero>
        <span className={virtual ? 'icon virtual' : 'icon'} aria-hidden>
          {virtual ? <Icons.ConsoleSqlOutlined /> : <Icons.TableOutlined />}
        </span>
        <div className="titles">
          <h1>{dataset.table_name}</h1>
          {dataset.description && (
            <p className="description">{dataset.description}</p>
          )}
          <div className="chips">
            <span>
              <Icons.DatabaseOutlined iconSize="s" />
              {dataset.database?.database_name}
            </span>
            {dataset.schema && <span>{dataset.schema}</span>}
            <span>{virtual ? t('SQL query') : t('Table')}</span>
            <span>
              {tn(
                '%s column',
                '%s columns',
                dataset.columns.length,
                dataset.columns.length,
              )}
            </span>
            <span>
              {tn(
                '%s metric',
                '%s metrics',
                dataset.metrics.length,
                dataset.metrics.length,
              )}
            </span>
          </div>
        </div>
        <div className="actions">
          {canWrite && (
            <Button
              buttonStyle="secondary"
              icon={<Icons.EditOutlined />}
              onClick={() => setEditingDataset(true)}
            >
              {t('Edit dataset')}
            </Button>
          )}
          {canWrite && (
            <Button
              buttonStyle="primary"
              icon={<Icons.PlusOutlined />}
              onClick={() => {
                setTab('metrics');
                setEditingMetric({});
              }}
            >
              {t('New metric')}
            </Button>
          )}
        </div>
      </Hero>

      <Tabs role="tablist">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            {count !== null && <span className="count">{count}</span>}
          </button>
        ))}
      </Tabs>

      {tab === 'columns' && (
        <Panel role="tabpanel" data-test="dataset-columns">
          {dataset.columns.map(column => (
            <div className="item" key={column.id}>
              <ColumnTypeLabel type={genericType(column)} />
              <span className="main">
                <strong>{column.verbose_name || column.column_name}</strong>
                {column.verbose_name && (
                  <span className="sub">{column.column_name}</span>
                )}
                {column.description && (
                  <span className="sub">{column.description}</span>
                )}
                {column.expression && <code>{column.expression}</code>}
              </span>
              <span className="flags">
                {column.is_dttm && <span className="time">{t('Time')}</span>}
                {column.groupby && <span>{t('Groupable')}</span>}
                {column.filterable && <span>{t('Filterable')}</span>}
              </span>
              <span className="type">{column.type || '—'}</span>
            </div>
          ))}
        </Panel>
      )}

      {tab === 'metrics' && (
        <Panel role="tabpanel" data-test="dataset-metrics">
          <div className="bar">
            {t(
              'Metrics are reusable calculations, like Power BI measures. Charts can use them as they are.',
            )}
            {canWrite && (
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                icon={<Icons.PlusOutlined />}
                onClick={() => setEditingMetric({})}
              >
                {t('New metric')}
              </Button>
            )}
          </div>
          {dataset.metrics.length === 0 && (
            <div className="empty">
              <strong>{t('No metrics yet')}</strong>
              {t('Create one to reuse a calculation in every chart.')}
            </div>
          )}
          {dataset.metrics.map(metric => (
            <div className="item" key={metric.id} data-test="dataset-metric">
              <span className="metric-icon" aria-hidden>
                Σ
              </span>
              <span className="main">
                <strong>{metric.verbose_name || metric.metric_name}</strong>
                {metric.verbose_name && (
                  <span className="sub">{metric.metric_name}</span>
                )}
                <code>{metric.expression}</code>
                {metric.description && (
                  <span className="sub">{metric.description}</span>
                )}
              </span>
              {metric.d3format && (
                <span className="type">{metric.d3format}</span>
              )}
              {canWrite && (
                <span className="item-actions">
                  <Tooltip title={t('Edit metric')}>
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      aria-label={t('Edit %s', metric.metric_name)}
                      onClick={() =>
                        setEditingMetric({
                          metric: {
                            id: metric.id,
                            metric_name: metric.metric_name,
                            verbose_name: metric.verbose_name,
                            expression: metric.expression || '',
                            description: metric.description,
                            d3format: metric.d3format,
                          },
                        })
                      }
                    >
                      <Icons.EditOutlined iconSize="m" />
                    </Button>
                  </Tooltip>
                  <Tooltip title={t('Delete metric')}>
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      aria-label={t('Delete %s', metric.metric_name)}
                      onClick={() => deleteMetric(metric)}
                    >
                      <Icons.DeleteOutlined iconSize="m" />
                    </Button>
                  </Tooltip>
                </span>
              )}
            </div>
          ))}
        </Panel>
      )}

      {tab === 'preview' && (
        <Panel role="tabpanel" data-test="dataset-preview">
          {!samples && !samplesError && <Loading position="inline-centered" />}
          {samplesError && (
            <div className="empty">
              <strong>{t('The rows could not be loaded')}</strong>
              {samplesError}
            </div>
          )}
          {samples && (
            <>
              <div className="bar">
                {tn(
                  'First %s row',
                  'First %s rows',
                  samples.data.length,
                  samples.data.length,
                )}
              </div>
              <div className="preview">
                <table>
                  <thead>
                    <tr>
                      {samples.colnames.map(name => (
                        <th key={name}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {samples.data.map((row, index) => (
                      // Sample rows have no identity of their own
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={index}>
                        {samples.colnames.map(name => {
                          const value = row[name];
                          return (
                            <td
                              key={name}
                              className={
                                typeof value === 'number' ? 'number' : undefined
                              }
                            >
                              {value === null || value === undefined
                                ? '—'
                                : String(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      )}

      {tab === 'usage' && (
        <Panel role="tabpanel" data-test="dataset-usage">
          {!related && <Loading position="inline-centered" />}
          {related && (
            <div className="usage">
              <div>
                <h3>
                  {tn(
                    '%s dashboard',
                    '%s dashboards',
                    related.dashboards.count,
                    related.dashboards.count,
                  )}
                </h3>
                {related.dashboards.result.map(dashboard => (
                  <Link
                    key={dashboard.id}
                    to={`/superset/dashboard/${dashboard.slug || dashboard.id}/`}
                  >
                    <Icons.DashboardOutlined iconSize="m" />
                    {dashboard.title}
                  </Link>
                ))}
                {related.dashboards.count === 0 && (
                  <div className="none">{t('No dashboard uses it yet.')}</div>
                )}
              </div>
              <div>
                <h3>
                  {tn(
                    '%s chart',
                    '%s charts',
                    related.charts.count,
                    related.charts.count,
                  )}
                </h3>
                {related.charts.result.map(chart => (
                  <span className="chart" key={chart.id}>
                    <VizTypeIcon vizType={chart.viz_type} size={18} />
                    {chart.slice_name}
                  </span>
                ))}
                {related.charts.count === 0 && (
                  <div className="none">{t('No chart uses it yet.')}</div>
                )}
              </div>
            </div>
          )}
        </Panel>
      )}

      <MetricModal
        show={!!editingMetric}
        metric={editingMetric?.metric}
        columns={columnNames}
        takenNames={dataset.metrics.map(metric => metric.metric_name)}
        onHide={() => setEditingMetric(null)}
        onSave={saveMetric}
      />
      {editingDataset && (
        <DatasourceModal
          datasource={dataset}
          show
          onHide={() => setEditingDataset(false)}
          onDatasourceSave={() => {
            setEditingDataset(false);
            load();
          }}
        />
      )}
    </Page>
  );
}
