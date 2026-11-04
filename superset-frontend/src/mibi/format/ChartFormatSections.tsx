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
  Fragment,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isEmpty, isEqual } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import {
  DatasourceType,
  type JsonObject,
  type JsonValue,
} from '@superset-ui/core';
import type {
  ControlPanelSectionConfig,
  ControlPanelState,
  ControlState,
  ControlStateMapping,
} from '@superset-ui/chart-controls';
import { Button, Switch, Tooltip } from '@superset-ui/core/components';
import { triggerQuery } from 'src/components/Chart/chartAction';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import type { RootState } from 'src/dashboard/types';
import { openChartEditor } from 'src/mibi/chartEditor';
import Control from 'src/explore/components/Control';
import {
  getSectionsToRender,
  isQuerySection,
} from 'src/explore/controlUtils/getSectionsToRender';
import { getControlStateFromControlConfig } from 'src/explore/controlUtils/getControlState';
import {
  legacyCardFormat,
  useChartFormat,
  withChartFormat,
} from './chartFormat';
import { resetChartFormat, setChartFormatValue } from './chartFormatActions';
import { FormatSearchContext, Hint, searchable, Section } from './controls';
import type { VisualFormat } from './types';
import {
  buildFormatCards,
  cardControlNames,
  type FormatCard,
  type FormatCardItem,
} from './formatCards';

type FormData = Record<string, unknown> & { viz_type?: string };
type ChartEntry = {
  id: number;
  form_data?: FormData;
  queriesResponse?: unknown;
};
type Anything = JsonObject;

const isEmptyValue = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (typeof value === 'object' && isEmpty(value));

export const isSameValue = (next: unknown, current: unknown) =>
  isEqual(next, current) || (isEmptyValue(next) && isEmptyValue(current));

export const safely = <T,>(run: () => T, fallback: T): T => {
  try {
    return run();
  } catch {
    return fallback;
  }
};

/**
 * What a control shows for a chart that never set it but saved the control of
 * Superset 7.0 that the pane replaced, so the pane says what the chart draws.
 */
export function legacyValue(name: string, formData: FormData): unknown {
  if (name === 'gridlines_hidden')
    return formData.gridlines === false ? true : undefined;
  if (name === 'special_start_angle') return formData.startAngle;
  return undefined;
}

/** The value of every control of a chart: conditions read each other's. */
export function seedControls(
  sections: ControlPanelSectionConfig[],
  formData: FormData,
  datasource: unknown,
) {
  const controls: Anything = {};
  sections.forEach(section =>
    section.controlSetRows?.flat().forEach(item => {
      if (!item || typeof item !== 'object' || !('config' in item)) return;
      const { name, config } = item;
      if (!config) return;
      const fallback =
        typeof config.default === 'function' ? undefined : config.default;
      controls[name] = {
        ...config,
        value: formData[name] ?? legacyValue(name, formData) ?? fallback,
      };
    }),
  );
  // The conditions of some controls look at the columns of the dataset
  const datasourceControl = (controls as Anything).datasource ?? {};
  (controls as Anything).datasource = {
    ...datasourceControl,
    datasource,
  };
  return controls;
}

/** What Explore keeps in its store for a control, built from the report. */
export function controlWithState(
  name: string,
  config: Anything,
  state: ControlPanelState,
  controls: Anything,
  chart: unknown,
) {
  const formData = state.form_data as unknown as FormData;
  // Resolve result-dependent choices before validation can discard a value.
  const mapped = config.mapStateToProps
    ? safely(
        () =>
          config.mapStateToProps?.(
            state,
            controls[name] as never,
            chart as never,
          ),
        undefined,
      )
    : undefined;
  const base = safely(
    () =>
      getControlStateFromControlConfig(
        { ...config, ...mapped, mapStateToProps: undefined },
        state,
        (mapped && 'value' in mapped
          ? mapped.value
          : formData[name]) as JsonValue,
      ),
    null,
  );
  return (base ?? { ...controls[name], ...mapped }) as ControlState;
}

/** The look controls of a chart, sorted into the sections of the pane. */
function buildControls(
  vizType: string,
  datasourceType: DatasourceType,
  panelState: Omit<ControlPanelState, 'controls'>,
  chart: ChartEntry,
) {
  const sections = getSectionsToRender(vizType, datasourceType).filter(
    Boolean,
  ) as ControlPanelSectionConfig[];
  const lookSections = sections.filter(
    section =>
      // Small multiples ask for data, but are part of the Analytics level
      (section.tabOverride === 'matrixify' || !isQuerySection(section)) &&
      section.controlSetRows?.length > 0,
  );
  const formData = panelState.form_data as unknown as FormData;
  const controls = seedControls(sections, formData, panelState.datasource);
  const state = { ...panelState, controls } as ControlPanelState;
  const cards = buildFormatCards(lookSections);
  cards
    .flatMap(card => [
      ...(card.toggle ? [card.toggle.item] : []),
      ...card.items,
    ])
    .forEach(({ name, config }) => {
      controls[name] = controlWithState(
        name,
        config as Anything,
        state,
        controls,
        chart,
      );
    });
  return { cards, state };
}

/**
 * The look of a chart, in the side panel of its report: the controls its control
 * panel declares, sorted into the sections of the pane. What changes is kept in
 * the layout, over what the chart saved (see chartFormat.ts).
 */
export function ChartFormatSections({
  id,
  chartId,
  level,
}: {
  id: string;
  chartId: number;
  /** Which sections to show; without it, all of them */
  level?: 'visual' | 'analytics' | 'fields';
}) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const dashboardPageId = useContext(DashboardPageIdContext);
  const chart = useSelector(
    (state: RootState) =>
      (state.charts as unknown as Record<number, ChartEntry>)[chartId],
  );
  const search = useContext(FormatSearchContext);
  const format = useChartFormat(id);
  const ownVisual = useSelector(
    (state: RootState) =>
      state.dashboardLayout.present[id]?.meta?.mibiFormat as
        | VisualFormat
        | undefined,
  );
  const ownFormat = useMemo(
    () => ({ ...legacyCardFormat(ownVisual), ...ownVisual?.chart }),
    [ownVisual],
  );
  const formData = useMemo(
    () => withChartFormat(chart?.form_data, format),
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
  const vizType = formData?.viz_type;
  const datasourceType = (datasource?.type ??
    DatasourceType.Table) as DatasourceType;

  const built = useMemo(() => {
    if (!vizType || !formData) return null;
    return buildControls(
      vizType,
      datasourceType,
      {
        slice: { slice_id: chartId },
        form_data: formData as never,
        datasource: datasource ?? null,
        common: common ?? {},
      },
      chart,
    );
  }, [chart, chartId, common, datasource, datasourceType, formData, vizType]);

  const setValue = useCallback(
    (name: string, value: unknown) => {
      const config = built?.state.controls?.[name] as ControlState | undefined;
      // Some controls report their value when they appear: it changes nothing
      if (isSameValue(value, config?.value)) return;
      dispatch(setChartFormatValue(id, chartId, name, value) as never);
      // A setting a query depends on asks for the data again
      if (config && !config.renderTrigger) {
        dispatch(triggerQuery(true, chartId));
      }
    },
    [built, chartId, dispatch, id],
  );
  const actions = useMemo(() => ({ setControlValue: setValue }), [setValue]);

  if (!built) return <Hint>{t('The chart is still loading.')}</Hint>;
  const { state } = built;
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

  type View = { controls: ControlStateMapping; panelProps: typeof panelProps };
  const actual: View = { controls, panelProps };
  // The settings of a section whose switch is off, as they would be once on
  const switchedOn = (control: string, value: boolean): View => {
    const forced = {
      ...controls,
      [control]: { ...controls[control], value },
    } as ControlStateMapping;
    return {
      controls: forced,
      panelProps: {
        ...panelProps,
        controls: forced,
        form_data: { ...formData, [control]: value },
      },
    };
  };

  const isItemShown = (
    { name, config, sectionVisibility }: FormatCardItem,
    view: View = actual,
  ) => {
    const { visibility } = config as Anything;
    const data = { ...config, ...view.controls[name], name } as Anything;
    const sectionShown = sectionVisibility
      ? safely(
          () => sectionVisibility(view.panelProps as never, view.controls),
          true,
        )
      : true;
    const visible = visibility
      ? safely(() => visibility.call(config, view.panelProps, data), true)
      : undefined;
    return sectionShown && visible !== false;
  };

  const renderItem = (first: FormatCardItem, view: View = actual) => {
    // A control declared twice shows as the one for this case
    const { name, config, heading } =
      [first, ...(first.alternatives ?? [])].find(item =>
        isItemShown(item, view),
      ) ?? first;
    if (!isItemShown({ ...first, config, name }, view)) return null;
    const {
      visibility: _visibility,
      hidden,
      disableStash: _disableStash,
      ...rest
    } = config as Anything;
    const data = { ...rest, ...controls[name], name } as Anything;
    const isHidden =
      typeof hidden === 'function'
        ? safely(() => hidden.call(config, view.panelProps, data), false)
        : hidden;
    const { validationErrors, label, description, ...props } = data;
    return (
      <Fragment key={name}>
        {heading && <h5>{heading}</h5>}
        <Control
          {...props}
          type={props.type}
          name={name}
          label={resolve(label, name)}
          description={resolve(description, name)}
          validationErrors={validationErrors}
          actions={actions as never}
          hidden={isHidden}
          // Hiding a control leaves its value alone: only the editor changes it
          resetOnHide={false}
        />
      </Fragment>
    );
  };

  const renderCard = (card: FormatCard) => {
    const { toggle } = card;
    const raw = toggle ? Boolean(controls[toggle.control]?.value) : true;
    const on = toggle?.inverted ? !raw : raw;
    const changed = cardControlNames(card).some(
      name => ownFormat && name in ownFormat,
    );
    // A switch of a section that does not apply takes the section with it
    if (toggle && !isItemShown(toggle.item)) return null;
    const query = searchable(search.trim());
    const items =
      query && !searchable(card.title).includes(query)
        ? card.items.filter(item =>
            searchable(
              `${resolve(item.config.label, item.name)} ${item.heading ?? ''}`,
            ).includes(query),
          )
        : card.items;
    const view =
      toggle && !on ? switchedOn(toggle.control, !toggle.inverted) : actual;
    const body = items.map(item => renderItem(item, view)).filter(Boolean);
    if (!toggle && !body.length) return null;
    return (
      <Section
        key={card.id}
        collapsedByDefault
        off={toggle ? !on : undefined}
        data-test={`mibi-chart-format-${card.id}`}
        headExtra={
          <>
            {changed && (
              <Tooltip title={t('Changed in this report')}>
                <span
                  aria-label={t('Changed in this report')}
                  css={css`
                    width: ${theme.sizeUnit * 1.5}px;
                    height: ${theme.sizeUnit * 1.5}px;
                    border-radius: 50%;
                    background: ${theme.colorPrimary};
                  `}
                />
              </Tooltip>
            )}
            {toggle && (
              <Switch
                size="small"
                checked={on}
                aria-label={card.title}
                onChange={checked =>
                  setValue(toggle.control, toggle.inverted ? !checked : checked)
                }
              />
            )}
          </>
        }
      >
        <h4>{card.title}</h4>
        {body}
        {on && !body.length && (
          <Hint>{t('This chart has no more options here.')}</Hint>
        )}
        {changed && (
          <Button
            buttonSize="small"
            buttonStyle="link"
            data-test={`mibi-chart-format-reset-${card.id}`}
            onClick={() =>
              dispatch(resetChartFormat(id, cardControlNames(card)) as never)
            }
          >
            {t('Reset to default')}
          </Button>
        )}
      </Section>
    );
  };

  // Some charts, like the deck.gl maps, keep their look with their data
  if (!built.cards.length) {
    if (level === 'fields') return null;
    return (
      <div className="actions">
        <Hint>{t('The options of this chart are in its editor.')}</Hint>
        <Button
          buttonStyle="secondary"
          data-test="mibi-format-chart"
          onClick={() =>
            openChartEditor({
              url: `/explore/?dashboard_page_id=${dashboardPageId}&slice_id=${chartId}`,
              chartId,
            })
          }
        >
          {t('Edit visual')}
        </Button>
      </div>
    );
  }

  const shown = built.cards.filter(
    card => !level || (card.level ?? 'visual') === level,
  );
  if (!shown.length) {
    if (level === 'fields') return null;
    return <Hint>{t('This chart has no options at this level.')}</Hint>;
  }
  return <>{shown.map(renderCard)}</>;
}
