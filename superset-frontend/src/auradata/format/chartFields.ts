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
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual } from 'lodash-es';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  addChart,
  renderTriggered,
  triggerQuery,
} from 'src/components/Chart/chartAction';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { setUnsavedChanges } from 'src/dashboard/actions/dashboardState';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import {
  isUserAdmin,
  isUserInSubjects,
  type SubjectRef,
} from 'src/dashboard/util/permissionUtils';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { fetchDatasourceMetadata } from 'src/dashboard/actions/datasources';
import { fetchDashboardSlices } from 'src/auradata/dashboard/reloadSavedChart';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import type { ChartState } from 'src/explore/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { updateLayout } from './actions';
import type { VisualFormat } from './types';

type Dispatch = (action: unknown) => unknown;
type FormData = Record<string, unknown>;

/**
 * The field wells of a chart, in the order Power BI shows them: each control that
 * takes a field and the name of its role. Empty for a chart without roles.
 */
function rolesOf(formData: FormData): Record<string, () => string> {
  const horizontal = formData.orientation === 'horizontal';
  const xy: Record<string, () => string> = {
    x_axis: () => (horizontal ? t('Y-axis') : t('X-axis')),
    metrics: () => (horizontal ? t('X-axis') : t('Y-axis')),
    groupby: () => t('Legend'),
  };
  const byChart: Record<string, Record<string, () => string>> = {
    echarts_timeseries_bar: xy,
    echarts_timeseries_line: xy,
    echarts_timeseries_smooth: xy,
    echarts_timeseries_step: xy,
    echarts_timeseries_scatter: xy,
    echarts_area: xy,
    mixed_timeseries: {
      x_axis: () => t('X-axis'),
      metrics: () => t('Column Y-axis'),
      groupby: () => t('Column legend'),
      metrics_b: () => t('Line Y-axis'),
      groupby_b: () => t('Line legend'),
    },
    pie: { groupby: () => t('Legend'), metric: () => t('Values') },
    funnel: { groupby: () => t('Category'), metric: () => t('Values') },
    treemap_v2: { groupby: () => t('Category'), metric: () => t('Values') },
    gauge_chart: {
      groupby: () => t('Category'),
      metric: () => t('Value'),
      gauge_target_metric: () => t('Target'),
    },
    waterfall: {
      x_axis: () => t('Category'),
      groupby: () => t('Breakdown'),
      metric: () => t('Values'),
    },
    butterfly: {
      groupby: () => t('Category'),
      left_metric: () => t('Left values'),
      right_metric: () => t('Right values'),
    },
    big_number_total: { metric: () => t('Fields') },
    big_number: {
      x_axis: () => t('Trend axis'),
      metric: () => t('Value'),
      goal_metric: () => t('Target'),
    },
    table: {
      groupby: () => t('Columns'),
      all_columns: () => t('Columns'),
      metrics: () => t('Values'),
      percent_metrics: () => t('Values as a percentage'),
    },
    pivot_table_v2: {
      groupbyRows: () => t('Rows'),
      groupbyColumns: () => t('Columns'),
      metrics: () => t('Values'),
    },
    bubble_v2: {
      entity: () => t('Details'),
      series: () => t('Legend'),
      x: () => t('X-axis'),
      y: () => t('Y-axis'),
      size: () => t('Size'),
    },
  };
  return byChart[String(formData.viz_type)] ?? {};
}

/** A well and whether it takes one field or a list. */
type Well = { name: string; single?: boolean };
type AddWells = { column: Well[]; metric: Well[] };

const XY_WELLS: AddWells = {
  column: [{ name: 'x_axis', single: true }, { name: 'groupby' }],
  metric: [{ name: 'metrics' }],
};
const CATEGORY_WELLS: AddWells = {
  column: [{ name: 'groupby' }],
  metric: [{ name: 'metric', single: true }],
};

/**
 * Where a field ticked in the Data pane or dropped on a chart goes, in order,
 * as Power BI fills the wells of a visual: the first that still takes it.
 */
function addWellsOf(formData: FormData): AddWells | undefined {
  const byChart: Record<string, AddWells> = {
    echarts_timeseries_bar: XY_WELLS,
    echarts_timeseries_line: XY_WELLS,
    echarts_timeseries_smooth: XY_WELLS,
    echarts_timeseries_step: XY_WELLS,
    echarts_timeseries_scatter: XY_WELLS,
    echarts_area: XY_WELLS,
    mixed_timeseries: {
      column: [{ name: 'x_axis', single: true }, { name: 'groupby' }],
      metric: [{ name: 'metrics' }],
    },
    pie: CATEGORY_WELLS,
    funnel: CATEGORY_WELLS,
    treemap_v2: CATEGORY_WELLS,
    gauge_chart: CATEGORY_WELLS,
    waterfall: {
      column: [{ name: 'x_axis', single: true }, { name: 'groupby' }],
      metric: [{ name: 'metric', single: true }],
    },
    butterfly: {
      column: [{ name: 'groupby' }],
      metric: [
        { name: 'left_metric', single: true },
        { name: 'right_metric', single: true },
      ],
    },
    big_number_total: {
      column: [],
      metric: [{ name: 'metric', single: true }],
    },
    big_number: {
      column: [{ name: 'x_axis', single: true }],
      metric: [{ name: 'metric', single: true }],
    },
    table:
      formData.query_mode === 'raw'
        ? { column: [{ name: 'all_columns' }], metric: [] }
        : { column: [{ name: 'groupby' }], metric: [{ name: 'metrics' }] },
    pivot_table_v2: {
      column: [{ name: 'groupbyRows' }, { name: 'groupbyColumns' }],
      metric: [{ name: 'metrics' }],
    },
    bubble_v2: {
      column: [
        { name: 'entity', single: true },
        { name: 'series', single: true },
      ],
      metric: [
        { name: 'x', single: true },
        { name: 'y', single: true },
        { name: 'size', single: true },
      ],
    },
  };
  return byChart[String(formData.viz_type)];
}

/** A field of the Data pane: a measure of the dataset or one of its columns. */
export type DataField =
  | { kind: 'metric'; name: string }
  | { kind: 'column'; name: string; numeric: boolean; value: unknown };

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && !value.length);

/**
 * Whether a value of a well is the field: a name in a well of its own kind, or
 * a column inside an aggregate of a well of values.
 */
function isField(value: unknown, field: DataField, metricWell: boolean) {
  if (typeof value === 'string')
    return value === field.name && metricWell === (field.kind === 'metric');
  if (!value || typeof value !== 'object') return false;
  const item = value as {
    column?: { column_name?: string };
    metric_name?: string;
  };
  return field.kind === 'metric'
    ? item.metric_name === field.name
    : item.column?.column_name === field.name;
}

const wellsWithKind = (wells: AddWells) => [
  ...wells.column.map(well => ({ name: well.name, metricWell: false })),
  ...wells.metric.map(well => ({ name: well.name, metricWell: true })),
];

const valuesOf = (value: unknown) => (Array.isArray(value) ? value : [value]);

/** Whether a chart shows a field in any of the wells a field goes to. */
export function usesField(formData: FormData, field: DataField) {
  const wells = addWellsOf(formData);
  if (!wells) return false;
  return wellsWithKind(wells).some(({ name, metricWell }) =>
    valuesOf(formData[name]).some(value => isField(value, field, metricWell)),
  );
}

/**
 * The change that adds a field to a chart: a measure, or a number column as its
 * sum, goes to the values; another column to the axis or the legend. Undefined
 * when no well takes it.
 */
export function addFieldChange(
  formData: FormData,
  field: DataField,
  asMetric: (column: unknown) => unknown,
): { name: string; value: unknown } | undefined {
  const wells = addWellsOf(formData);
  if (!wells) return undefined;
  const measure = field.kind === 'metric' || field.numeric;
  const value =
    field.kind === 'metric'
      ? field.name
      : measure
        ? asMetric(field.value)
        : field.name;
  const order = measure ? wells.metric : wells.column;
  const well = order.find(
    ({ name, single }) => !single || isEmpty(formData[name]),
  );
  if (!well) return undefined;
  const current = formData[well.name];
  return {
    name: well.name,
    value: well.single
      ? value
      : [...(Array.isArray(current) ? current : []), value],
  };
}

/** The changes that take a field out of every well of a chart that has it. */
export function removeFieldChanges(formData: FormData, field: DataField) {
  const wells = addWellsOf(formData);
  if (!wells) return [];
  return wellsWithKind(wells).flatMap(({ name, metricWell }) => {
    const current = formData[name];
    if (Array.isArray(current)) {
      const kept = current.filter(value => !isField(value, field, metricWell));
      return kept.length === current.length ? [] : [{ name, value: kept }];
    }
    return isField(current, field, metricWell)
      ? [{ name, value: undefined }]
      : [];
  });
}

/** Controls of a chart that take a field, whatever chart it is. */
const isFieldControl = (type: unknown) =>
  typeof type === 'string' && /^Dnd(?!Filter)/.test(type);

/** The name of a control as a role of its chart, if it has one. */
export const fieldRole = (formData: FormData, name: string) =>
  rolesOf(formData)[name]?.();

/**
 * Whether a control is a field well: one with a role or, on a chart without roles,
 * any that takes a field. Others, like the sort of a query, are data options.
 */
export function isFieldWell(formData: FormData, name: string, type: unknown) {
  const roles = rolesOf(formData);
  return Object.keys(roles).length ? name in roles : isFieldControl(type);
}

/** Sorts field wells as Power BI shows them; the rest keep their order. */
export function wellOrder(formData: FormData, name: string) {
  const index = Object.keys(rolesOf(formData)).indexOf(name);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * Whether a viewer may change the fields of a chart: the server asks for the same
 * when saving it. Editors that have not loaded yet leave the decision to the server.
 * Whoever edits the dashboard (including a workspace contributor, who is not one of
 * the chart's editors) edits its chart, since a chart belongs to one dashboard.
 */
export function canChangeFields(
  user: UserWithPermissionsAndRoles | undefined,
  editors: SubjectRef[] | undefined,
  canEditDashboard = false,
) {
  if (!editors || !user) return true;
  return isUserAdmin(user) || canEditDashboard || isUserInSubjects(editors);
}

type Pending = {
  /** The form data of the chart when its first field changed */
  saved: FormData;
  changes: FormData;
  /** It lacks a required field: it asks for no data and cannot be saved */
  invalid: boolean;
};

/**
 * Field changes waiting for the report to be saved. They belong to the chart, not
 * to the layout, so the chart keeps them wherever it is used. Discarding the
 * report reloads the page, which forgets them.
 */
const pending = new Map<number, Pending>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const hasPendingFields = (chartId?: number) =>
  chartId === undefined ? pending.size > 0 : pending.has(chartId);

/** Forgets the changes waiting, as leaving the editor without saving does. */
export function clearPendingFields() {
  pending.clear();
  steps.clear();
  shownStep = 0;
}

const chartOf = (getState: GetState, chartId: number) =>
  (getState().charts as Record<number, ChartState>)[chartId];

const QUERY_DELAY = 300;

/** Shows a form data on the chart, asking for its data unless told otherwise. */
const applyFormData =
  (chartId: number, formData: FormData, ask: 'query' | 'render' | 'none') =>
  (dispatch: Dispatch, getState: GetState) => {
    const chart = chartOf(getState, chartId);
    if (!chart) return;
    dispatch(
      addChart(
        { ...chart, form_data: formData } as unknown as ChartState,
        chartId,
      ),
    );
    clearTimeout(timers.get(chartId));
    if (ask === 'render') dispatch(renderTriggered(Date.now(), chartId));
    if (ask === 'query') {
      // Quick changes ask once: every query takes time on the server
      timers.set(
        chartId,
        setTimeout(() => dispatch(triggerQuery(true, chartId)), QUERY_DELAY),
      );
    }
  };

/** Where a field step is counted: the root of the layout, so undo moves it. */
const FIELD_STEP_KEY = 'mibiFieldStep';

/**
 * One change of the fields of a chart, as undo and redo need it: the values of
 * the keys it changed before and after, and whether the chart could draw itself.
 */
type FieldStep = {
  id: string;
  chartId: number;
  before: FormData;
  after: FormData;
  invalidBefore: boolean;
  invalidAfter: boolean;
};

/**
 * Field changes by step. The layout only holds the number of the last step, so
 * undoing the layout moves through these and fields never live in the layout.
 */
const steps = new Map<number, FieldStep>();
/** The step the charts show; undo and redo move the layout away from it. */
let shownStep = 0;

const stepOf = (getState: GetState) =>
  Number(
    getState().dashboardLayout.present[DASHBOARD_ROOT_ID]?.meta?.[
      FIELD_STEP_KEY
    ] ?? 0,
  );

/**
 * Shows some field values on a chart and keeps them waiting for the report to
 * be saved, without recording anything for undo.
 */
const applyFieldValues =
  (
    chartId: number,
    values: FormData,
    ask: 'query' | 'render',
    invalid: boolean,
  ) =>
  (dispatch: Dispatch, getState: GetState) => {
    const chart = chartOf(getState, chartId);
    if (!chart) return;
    const current = (chart as unknown as { form_data: FormData }).form_data;
    const entry: Pending = pending.get(chartId) ?? {
      saved: current,
      changes: {},
      invalid,
    };
    const changes = { ...entry.changes };
    Object.entries(values).forEach(([name, value]) => {
      if (isEqual(value, entry.saved[name])) delete changes[name];
      else changes[name] = value;
    });
    if (Object.keys(changes).length) {
      pending.set(chartId, { ...entry, changes, invalid });
    } else {
      pending.delete(chartId);
    }
    dispatch(
      applyFormData(chartId, { ...current, ...values }, invalid ? 'none' : ask),
    );
    dispatch(setUnsavedChanges(true));
  };

/**
 * Records a change of the fields of a chart as one undo step and shows it. The
 * layout gets the number of the step and, in the same write, loses the keys its
 * format held for those fields, so one undo puts both back.
 */
const recordFieldStep =
  (
    step: Omit<FieldStep, 'before' | 'invalidBefore'>,
    ask: 'query' | 'render',
  ) =>
  (dispatch: Dispatch, getState: GetState) => {
    const chart = chartOf(getState, step.chartId);
    if (!chart) return;
    const current = (chart as unknown as { form_data: FormData }).form_data;
    const before = Object.fromEntries(
      Object.keys(step.after).map(name => [name, current[name]]),
    );
    const number = Math.max(stepOf(getState), shownStep) + 1;
    // A change after undoing drops the steps that could be redone
    [...steps.keys()]
      .filter(key => key >= number)
      .forEach(key => steps.delete(key));
    steps.set(number, {
      ...step,
      before,
      invalidBefore: pending.get(step.chartId)?.invalid ?? false,
    });
    shownStep = number;

    const layout = getState().dashboardLayout.present;
    const root = layout[DASHBOARD_ROOT_ID];
    if (!root) {
      // A layout that has not loaded has no history to undo
      dispatch(
        applyFieldValues(step.chartId, step.after, ask, step.invalidAfter),
      );
      return;
    }
    const next: Record<string, LayoutItem> = {
      [DASHBOARD_ROOT_ID]: {
        ...root,
        meta: { ...root.meta, [FIELD_STEP_KEY]: number },
      },
    };
    const item = layout[step.id];
    const own = item?.meta?.mibiFormat as VisualFormat | undefined;
    const moved = Object.keys(step.after).filter(
      name => own?.chart && name in own.chart,
    );
    if (item && own?.chart && moved.length) {
      const ownChart = { ...own.chart };
      moved.forEach(name => delete ownChart[name]);
      next[step.id] = {
        ...item,
        meta: { ...item.meta, mibiFormat: { ...own, chart: ownChart } },
      };
    }
    dispatch(updateLayout(next, `fields:${number}`) as never);
    dispatch(
      applyFieldValues(step.chartId, step.after, ask, step.invalidAfter),
    );
  };

/**
 * Follows undo and redo of the layout: when its field step moves, the charts
 * get the field values of the steps it went back or forward through.
 */
export const followFieldSteps =
  () => (dispatch: Dispatch, getState: GetState) => {
    const target = stepOf(getState);
    if (target === shownStep) return;
    if (target < shownStep) {
      for (let number = shownStep; number > target; number -= 1) {
        const step = steps.get(number);
        if (step)
          dispatch(
            applyFieldValues(
              step.chartId,
              step.before,
              'query',
              step.invalidBefore,
            ),
          );
      }
    } else {
      for (let number = shownStep + 1; number <= target; number += 1) {
        const step = steps.get(number);
        if (step)
          dispatch(
            applyFieldValues(
              step.chartId,
              step.after,
              'query',
              step.invalidAfter,
            ),
          );
      }
    }
    shownStep = target;
  };

/** Keeps the charts in step with undo and redo while the report is edited. */
export function useFollowFieldSteps() {
  const dispatch = useDispatch();
  const step = useSelector(
    (state: RootState) =>
      state.dashboardLayout.present[DASHBOARD_ROOT_ID]?.meta?.[FIELD_STEP_KEY],
  );
  useEffect(() => {
    dispatch(followFieldSteps() as never);
  }, [dispatch, step]);
}

/**
 * Changes a field of a chart: it shows at once, waits for the report to be
 * saved and undoes as one step. A value the layout also holds moves here, or the
 * layout would hide it.
 */
export const setChartFieldValue = ({
  id,
  chartId,
  name,
  value,
  ask,
  invalid,
}: {
  id: string;
  chartId: number;
  name: string;
  value: unknown;
  ask: 'query' | 'render';
  invalid: boolean;
}) =>
  recordFieldStep(
    { id, chartId, after: { [name]: value }, invalidAfter: invalid },
    ask,
  );

/** Puts the fields of a chart back as they were saved, as one undo step. */
export const revertChartFields =
  (chartId: number, id?: string) => (dispatch: Dispatch) => {
    const entry = pending.get(chartId);
    if (!entry) return;
    const saved = Object.fromEntries(
      Object.keys(entry.changes).map(name => [name, entry.saved[name]]),
    );
    if (id) {
      dispatch(
        recordFieldStep(
          { id, chartId, after: saved, invalidAfter: false },
          'query',
        ),
      );
      return;
    }
    // A save the server refused: the chart goes back and nothing is undone
    pending.delete(chartId);
    dispatch(applyFormData(chartId, entry.saved, 'query'));
  };

type DatasetFields = {
  columns?: { column_name: string }[];
  metrics?: { metric_name: string }[];
};

/**
 * The values of the wells of a chart that a dataset still has: a column or a
 * measure by name, an aggregate of one of its columns, or a SQL expression.
 */
export function fieldsKeptBy(formData: FormData, dataset: DatasetFields) {
  const columns = new Set((dataset.columns ?? []).map(c => c.column_name));
  const metrics = new Set((dataset.metrics ?? []).map(m => m.metric_name));
  const wells = addWellsOf(formData);
  const metricWells = new Set(wells?.metric.map(well => well.name) ?? []);
  const names = new Set([
    ...Object.keys(rolesOf(formData)),
    ...(wells ? wellsWithKind(wells).map(well => well.name) : []),
  ]);
  const keeps = (value: unknown, metricWell: boolean) => {
    if (typeof value === 'string')
      return metricWell ? metrics.has(value) : columns.has(value);
    const item = value as {
      column?: { column_name?: string };
      subject?: string;
      sqlExpression?: string;
    } | null;
    if (!item || typeof item !== 'object') return true;
    if (item.column?.column_name) return columns.has(item.column.column_name);
    if (item.subject) return columns.has(item.subject);
    return true;
  };
  const kept: FormData = {};
  let emptied = false;
  names.forEach(name => {
    const current = formData[name];
    if (current === undefined || current === null) return;
    const metricWell = metricWells.has(name) || /metric/.test(name);
    if (Array.isArray(current)) {
      const next = current.filter(value => keeps(value, metricWell));
      if (next.length !== current.length) kept[name] = next;
      if (current.length && !next.length) emptied = true;
    } else if (!keeps(current, metricWell)) {
      kept[name] = undefined;
      emptied = true;
    }
  });
  const filters = formData.adhoc_filters;
  if (Array.isArray(filters)) {
    const next = filters.filter(filter => keeps(filter, false));
    if (next.length !== filters.length) kept.adhoc_filters = next;
  }
  return { kept, emptied };
}

/**
 * Moves a chart to another dataset of its report, in one undo step: the fields
 * the new dataset lacks leave its wells and its filters. The chart cannot draw
 * itself until a well that emptied gets a field again.
 */
export const changeChartDataset =
  ({
    id,
    chartId,
    datasetKey,
  }: {
    id: string;
    chartId: number;
    datasetKey: string;
  }) =>
  async (dispatch: Dispatch, getState: GetState) => {
    await dispatch(fetchDatasourceMetadata(datasetKey));
    const dataset = (
      getState().datasources as unknown as Record<string, DatasetFields>
    )[datasetKey];
    const chart = chartOf(getState, chartId);
    if (!dataset || !chart) return;
    const formData = (chart as unknown as { form_data: FormData }).form_data;
    const { kept, emptied } = fieldsKeptBy(formData, dataset);
    dispatch(
      recordFieldStep(
        {
          id,
          chartId,
          after: { datasource: datasetKey, ...kept },
          invalidAfter: emptied,
        },
        'query',
      ),
    );
  };

async function saveChart(chartId: number, changes: FormData) {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/chart/${chartId}`,
  });
  // What the server keeps, not what the report holds: the report adds its filters
  // and colors to the form data of its charts
  const formData = { ...JSON.parse(json.result.params || '{}'), ...changes };
  const queryContext = await buildV1ChartDataPayload({
    formData,
    force: false,
    resultFormat: 'json',
    resultType: 'full',
    setDataMask: undefined,
    ownState: undefined,
  });
  // A chart moved to another dataset tells the server which one
  const [datasourceId, datasourceType] = String(changes.datasource ?? '').split(
    '__',
  );
  await SupersetClient.put({
    endpoint: `/api/v1/chart/${chartId}`,
    jsonPayload: {
      ...(changes.datasource !== undefined && {
        datasource_id: Number(datasourceId),
        datasource_type: datasourceType,
      }),
      params: JSON.stringify(formData),
      query_context: JSON.stringify(queryContext),
      query_context_generation: true,
    },
  });
}

/**
 * Saves the fields waiting on the charts, all of them or just one. A chart that
 * lacks a required field goes back as it was, since it could not draw itself.
 */
export const saveChartFields =
  (only?: number) => async (dispatch: Dispatch) => {
    const ids = [...pending.keys()].filter(
      chartId => only === undefined || chartId === only,
    );
    if (!ids.length) return;
    // One at a time: the server may attend a single request at once
    for (const chartId of ids) {
      const entry = pending.get(chartId);
      if (entry?.invalid) {
        dispatch(revertChartFields(chartId));
        dispatch(
          addDangerToast(
            t('A chart lacks a required field: it keeps its saved fields.'),
          ),
        );
      } else if (entry) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await saveChart(chartId, entry.changes);
          pending.delete(chartId);
        } catch (error) {
          const status = (error as { status?: number })?.status;
          if (status === 400 || status === 422) {
            // The server refuses the fields, as a dataset of another workspace
            dispatch(revertChartFields(chartId));
            dispatch(
              addDangerToast(
                t(
                  'The server refused the fields of a chart: it keeps its saved fields.',
                ),
              ),
            );
          } else if (status === 403) {
            // Trying again cannot help: the chart goes back to what it saved
            dispatch(revertChartFields(chartId));
            dispatch(
              addDangerToast(
                t(
                  "You can't change the fields of a chart you don't own: it keeps its saved fields.",
                ),
              ),
            );
          } else {
            dispatch(
              addDangerToast(
                t('The fields of a chart could not be saved. Try again.'),
              ),
            );
          }
        }
      }
    }
    await dispatch(fetchDashboardSlices());
  };
