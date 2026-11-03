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
import {
  useCallback,
  useContext,
  useMemo,
  Fragment,
  type ReactNode,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { DatasourceType, type JsonObject } from '@superset-ui/core';
import type {
  ControlPanelSectionConfig,
  ControlPanelState,
  ControlState,
  ControlStateMapping,
} from '@superset-ui/chart-controls';
import { Button } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import Control from 'src/explore/components/Control';
import { DirectMetricDropContext } from 'src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import {
  getSectionsToRender,
  isQuerySection,
} from 'src/explore/controlUtils/getSectionsToRender';
import { useChartFormat, withChartFormat } from './chartFormat';
import {
  canChangeFields,
  fieldRole,
  hasPendingFields,
  isFieldWell,
  revertChartFields,
  setChartFieldValue,
  wellOrder,
} from './chartFields';
import {
  ChartFormatSections,
  controlWithState,
  isSameValue,
  safely,
  seedControls,
} from './ChartFormatSections';
import { FormatSearchContext, Hint, Section } from './controls';

/** Other screens of the app change these: the dataset and the kind of chart. */
const NOT_DATA_OPTIONS = ['datasource', 'viz_type'];

type Anything = JsonObject;
type ChartEntry = { id: number; form_data?: Record<string, unknown> };
type FieldItem = { name: string; config: Anything; shown?: unknown };

/** The controls of the data of a chart, in the order its control panel has them. */
function dataItems(sections: ControlPanelSectionConfig[]) {
  return sections
    .filter(
      section =>
        // Small multiples ask for data, but are part of the Analytics level
        section.tabOverride !== 'matrixify' &&
        isQuerySection(section) &&
        section.controlSetRows?.length > 0,
    )
    .flatMap(section =>
      section.controlSetRows.flat().flatMap(item =>
        item && typeof item === 'object' && 'config' in item && item.config
          ? [
              {
                name: item.name,
                config: item.config as Anything,
                shown: section.visibility,
              },
            ]
          : [],
      ),
    );
}

function buildFields(
  vizType: string,
  datasourceType: DatasourceType,
  panelState: Omit<ControlPanelState, 'controls'>,
  chart: ChartEntry,
) {
  const sections = getSectionsToRender(vizType, datasourceType).filter(
    Boolean,
  ) as ControlPanelSectionConfig[];
  const controls = seedControls(
    sections,
    panelState.form_data as never,
    panelState.datasource,
  );
  const state = { ...panelState, controls } as ControlPanelState;
  const items: FieldItem[] = dataItems(sections);
  items.forEach(({ name, config }) => {
    controls[name] = controlWithState(name, config, state, controls, chart);
  });
  return { items, state };
}

/**
 * What a chart shows, by the role each field plays in it, as the field wells of
 * Power BI. Changing a field asks for the data and waits for the report to be
 * saved (see chartFields.ts); fields come from the Data pane or from each control.
 */
export function ChartFieldsSections({
  id,
  chartId,
}: {
  id: string;
  chartId: number;
}) {
  const dispatch = useDispatch();
  const chart = useSelector(
    (state: RootState) =>
      (state.charts as unknown as Record<number, ChartEntry>)[chartId],
  );
  const format = useChartFormat(id);
  const formData = useMemo(
    () => withChartFormat(chart?.form_data, format) as Anything | undefined,
    [chart?.form_data, format],
  );
  const datasource = useSelector(
    (state: RootState) =>
      (state.datasources as unknown as Anything)?.[
        String(formData?.datasource)
      ],
  );
  const common = useSelector(
    (state: RootState) => (state as unknown as Anything).common,
  );
  const allowed = useSelector((state: RootState) =>
    canChangeFields(
      state.user,
      (state.sliceEntities?.slices as unknown as Anything)?.[chartId]?.owners,
    ),
  );
  const search = useContext(FormatSearchContext);
  const vizType = formData?.viz_type as string | undefined;
  const datasourceType = (datasource?.type ??
    DatasourceType.Table) as DatasourceType;

  const build = useCallback(
    (data: Anything) =>
      buildFields(
        vizType as string,
        datasourceType,
        {
          slice: { slice_id: chartId },
          form_data: data as never,
          datasource: datasource ?? null,
          common: common ?? {},
        },
        chart,
      ),
    [chart, chartId, common, datasource, datasourceType, vizType],
  );
  const built = useMemo(
    () => (vizType && formData ? build(formData) : null),
    [build, formData, vizType],
  );

  const setValue = useCallback(
    (name: string, value: unknown) => {
      const control = built?.state.controls?.[name] as ControlState | undefined;
      // Some controls report their value when they appear: it changes nothing
      if (!built || !formData || isSameValue(value, control?.value)) return;
      const next = build({ ...formData, [name]: value });
      const invalid = next.items.some(
        item =>
          !!(next.state.controls?.[item.name] as ControlState)?.validationErrors
            ?.length,
      );
      dispatch(
        setChartFieldValue({
          id,
          chartId,
          name,
          value,
          ask: control?.renderTrigger ? 'render' : 'query',
          invalid,
        }) as never,
      );
    },
    [build, built, chartId, dispatch, formData, id],
  );
  const actions = useMemo(() => ({ setControlValue: setValue }), [setValue]);

  if (!allowed) {
    return (
      <Hint>{t('Only the owners of this chart can change its fields.')}</Hint>
    );
  }
  if (!built || !formData) {
    return <Hint>{t('The chart is still loading.')}</Hint>;
  }
  const { state, items } = built;
  const controls = state.controls as ControlStateMapping;
  const panelProps = {
    controls,
    form_data: formData,
    chart,
    exploreState: state,
    datasource_type: datasourceType,
    actions,
  };
  const resolve = (value: unknown, name: string): ReactNode =>
    typeof value === 'function'
      ? safely(() => value(state, controls[name], chart), null)
      : (value as ReactNode);

  const isShown = ({ name, config, shown }: FieldItem) => {
    const { visibility } = config;
    const data = { ...config, ...controls[name], name };
    const sectionShown =
      typeof shown === 'function'
        ? safely(() => shown(panelProps, controls), true)
        : true;
    const visible =
      typeof visibility === 'function'
        ? safely(() => visibility.call(config, panelProps, data), true)
        : undefined;
    return sectionShown && visible !== false;
  };

  // A control declared twice, as bars do for each orientation, shows once
  const names = new Set<string>();
  const shownItems = items.filter(item => {
    if (
      names.has(item.name) ||
      NOT_DATA_OPTIONS.includes(item.name) ||
      !isShown(item)
    ) {
      return false;
    }
    names.add(item.name);
    return true;
  });

  const renderItem = ({ name, config }: FieldItem) => {
    const {
      visibility: _visibility,
      hidden,
      disableStash: _disableStash,
      ...rest
    } = config;
    const data = { ...rest, ...controls[name], name } as Anything;
    const isHidden =
      typeof hidden === 'function'
        ? safely(() => hidden.call(config, panelProps, data), false)
        : hidden;
    const { validationErrors, label, description, ...props } = data;
    return (
      <Fragment key={name}>
        <Control
          {...props}
          type={props.type}
          name={name}
          label={fieldRole(formData, name) ?? resolve(label, name)}
          description={resolve(description, name)}
          validationErrors={validationErrors}
          actions={actions as never}
          hidden={isHidden}
          resetOnHide={false}
        />
      </Fragment>
    );
  };

  const isFilter = ({ config }: FieldItem) =>
    config.type === 'DndFilterSelect' || config.type === 'AdhocFilterControl';
  const isField = (item: FieldItem) =>
    isFieldWell(formData, item.name, item.config.type);
  const fields = shownItems
    .filter(item => isField(item) && !isFilter(item))
    .sort((a, b) => wellOrder(formData, a.name) - wellOrder(formData, b.name));
  const filters = shownItems.filter(isFilter);
  const others = shownItems.filter(item => !isField(item) && !isFilter(item));
  const searching = !!search.trim();

  return (
    <>
      <Section data-test="mibi-chart-fields">
        <h4>{t('Fields')}</h4>
        <DirectMetricDropContext.Provider value>
          {fields.map(renderItem)}
        </DirectMetricDropContext.Provider>
        {!fields.length && (
          <Hint>{t('This chart has no fields to choose.')}</Hint>
        )}
        {hasPendingFields(chartId) && (
          <>
            <Hint>
              {t(
                'Fields are saved with the report. Undo does not change them: use the button below.',
              )}
            </Hint>
            <Button
              buttonSize="small"
              buttonStyle="link"
              data-test="mibi-chart-fields-reset"
              onClick={() => dispatch(revertChartFields(chartId) as never)}
            >
              {t('Back to the saved fields')}
            </Button>
          </>
        )}
      </Section>
      <ChartFormatSections id={id} chartId={chartId} level="fields" />
      {!!filters.length && (
        <Section collapsedByDefault data-test="mibi-chart-fields-filters">
          <h4>{t('Filters on this visual')}</h4>
          {filters.map(renderItem)}
        </Section>
      )}
      {!!others.length && !searching && (
        <Section collapsedByDefault data-test="mibi-chart-fields-more">
          <h4>{t('More data options')}</h4>
          {others.map(renderItem)}
        </Section>
      )}
    </>
  );
}
