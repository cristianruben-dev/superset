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
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import cx from 'classnames';
import { useSelector, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  SuperChart,
  type QueryData,
  type QueryFormData,
} from '@superset-ui/core';
import { Loading, SafeMarkdown } from '@superset-ui/core/components';
import {
  getChartDataRequest,
  handleChartDataResponse,
} from 'src/components/Chart/chartAction';
import type { RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import { selectChartCustomizationFromRedux } from 'src/dashboard/components/nativeFilters/state';
import { getQuerySettings } from 'src/explore/exploreUtils';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';
import {
  layoutChartFormat,
  withChartFormat,
} from 'src/mibi/format/chartFormat';
import {
  canvasStyle,
  mergeVisualFormat,
  visualStyle,
} from 'src/mibi/format/styles';
import {
  CELL,
  TOOLTIP_FORMAT_KEY,
  type CanvasFormat,
  type ChartTooltipFormat,
  type VisualFormat,
} from 'src/mibi/format/types';
import {
  ELEMENT_DEFAULTS,
  ELEMENT_KEY,
  type ElementConfig,
} from 'src/mibi/elements/types';
import {
  ButtonView,
  ImageView,
  ShapeView,
  TextView,
} from 'src/mibi/elements/views';
import { datasetColumns } from './drillthrough';
import type { DrillthroughField } from './drillthroughScope';
import {
  MARK_HOVER_EVENT,
  MARK_LEAVE_EVENT,
  type MarkHover,
} from './markHover';
import {
  chartDimensions,
  isLessPrecise,
  markKey,
  QUERY_ABORTED,
  resolveTooltipPage,
  tooltipObjects,
  tooltipPageOf,
  tooltipPosition,
  tooltipQueryKey,
  TooltipQueryCache,
  withMarkFilters,
  type TooltipObject,
} from './tooltipPages';
import { ReportTheme } from './ReportTheme';
import { PAGE_BACKGROUND_KEY } from './types';

/** Time on a mark before its page is asked for, and off it before it goes. */
const SHOW_DELAY = 250;
const HIDE_DELAY = 150;

/** Results of the tooltip charts, by chart and filters, for the session. */
const queries = new TooltipQueryCache<QueryData[]>(120);

/** The tooltip page the marks of a chart show, if any. */
export function useChartTooltipPage(
  chartId: number | undefined,
  format: VisualFormat | undefined,
): string | undefined {
  // Turning the tooltips off turns the tooltip page off too
  const tooltip = format?.chart?.[TOOLTIP_FORMAT_KEY] as
    | ChartTooltipFormat
    | undefined;
  const setting = tooltip?.show === false ? undefined : format?.tooltipPage;
  return useSelector((state: RootState) => {
    if (setting?.type !== 'page' || !chartId) return undefined;
    const layout = state.dashboardLayout?.present;
    if (!layout) return undefined;
    return resolveTooltipPage(
      layout,
      setting,
      chartDimensions(
        state.charts?.[chartId]?.form_data as
          | Record<string, unknown>
          | undefined,
      ),
    );
  });
}

/**
 * The form data a chart of a tooltip page runs: as on the dashboard, with
 * its filters and format, plus the values of the mark under the pointer.
 */
export function tooltipChartFormData(
  state: RootState,
  componentId: string,
  chartId: number,
  fields: DrillthroughField[],
): QueryFormData | undefined {
  const chart = state.charts[chartId];
  if (!chart?.form_data) return undefined;
  const layout = state.dashboardLayout.present;
  const metadata = state.dashboardInfo.metadata ?? {};
  const formData = withChartFormat(
    chart.form_data,
    layoutChartFormat(layout, componentId),
  ) as QueryFormData;
  const base = getFormDataWithExtraFilters({
    chart: { id: chartId, form_data: formData },
    chartConfiguration: metadata.chart_configuration,
    chartCustomizationItems: selectChartCustomizationFromRedux(state) as never,
    filters: getAppliedFilterValues(chartId),
    colorScheme: state.dashboardState.colorScheme,
    colorNamespace: (state.dashboardState as { colorNamespace?: string })
      .colorNamespace,
    sliceId: chartId,
    nativeFilters: state.nativeFilters?.filters,
    allSliceIds: state.dashboardState.sliceIds,
    dataMask: state.dataMask,
    extraControls: {},
    labelsColor: metadata.label_colors || {},
    labelsColorMap: metadata.map_label_colors || {},
    sharedLabelsColors: enforceSharedLabelsColorsArray(
      metadata.shared_label_colors,
    ),
    ownColorScheme: chart.form_data.color_scheme as string | undefined,
  }) as unknown as QueryFormData;
  return withMarkFilters(
    { ...base, dashboardId: state.dashboardInfo.id },
    fields,
    datasetColumns(state, chartId),
  );
}

async function fetchChartData(
  formData: QueryFormData,
  signal: AbortSignal,
): Promise<QueryData[]> {
  const { response, json } = await getChartDataRequest({
    formData,
    resultFormat: 'json',
    resultType: 'full',
    requestParams: { signal, dashboard_id: formData.dashboardId },
  });
  const [useLegacyApi] = getQuerySettings(formData);
  return handleChartDataResponse(
    response,
    json as { result: QueryData[] },
    useLegacyApi,
  );
}

const Box = styled.div`
  ${({ theme }) => css`
    position: fixed;
    z-index: 1100;
    pointer-events: none;
    overflow: hidden;
    border-radius: ${theme.borderRadius}px;
    box-shadow: ${theme.boxShadowSecondary};
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
  `}
`;

const Placed = styled.div`
  position: absolute;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

const Title = styled.div`
  ${({ theme }) => css`
    flex: none;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px 0;
    font-weight: ${theme.fontWeightStrong};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `}
`;

const Centered = styled.div`
  ${({ theme }) => css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const TITLE_HEIGHT = 26;

/** One chart of a tooltip page, filtered to the mark. */
const TooltipChart = memo(function TooltipChart({
  object,
  fields,
}: {
  object: TooltipObject;
  fields: DrillthroughField[];
}) {
  const theme = useTheme();
  const store = useStore<RootState>();
  const dataMask = useSelector((state: RootState) => state.dataMask);
  const chartId = object.chartId ?? 0;
  const formData = useMemo(
    () => tooltipChartFormData(store.getState(), object.id, chartId, fields),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, object.id, chartId, fields, dataMask],
  );
  const datasource = useSelector((state: RootState) =>
    formData?.datasource ? state.datasources[formData.datasource] : undefined,
  );
  const meta = useSelector(
    (state: RootState) => state.dashboardLayout.present[object.id]?.meta,
  );
  const shared = useSelector(
    (state: RootState) =>
      (
        state.dashboardLayout.present[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas as
          | CanvasFormat
          | undefined
      )?.visuals,
  );
  const format = mergeVisualFormat(
    shared,
    meta?.mibiFormat as VisualFormat | undefined,
  );
  const key = formData ? tooltipQueryKey(chartId, formData) : '';
  const [result, setResult] = useState<{
    key: string;
    data?: QueryData[];
    failed?: boolean;
  }>();
  useEffect(() => {
    if (!formData) return undefined;
    let live = true;
    queries
      .get(key, signal => fetchChartData(formData, signal))
      .then(
        data => live && setResult({ key, data }),
        // A query cancelled because the pointer left is not a failure
        error =>
          live && error !== QUERY_ABORTED && setResult({ key, failed: true }),
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const width = object.width * CELL;
  const height = object.height * CELL;
  const showTitle = format?.title?.show !== false;
  const title = String(meta?.sliceNameOverride || meta?.sliceName || '');
  const { style } = visualStyle(format, theme);
  const chartHeight = height - (showTitle ? TITLE_HEIGHT : 0);
  const current = result?.key === key ? result : undefined;
  return (
    <Placed
      style={{
        ...style,
        left: object.x * CELL,
        top: object.y * CELL,
        width,
        height,
      }}
      data-test="mibi-tooltip-chart"
    >
      {showTitle && title && (
        <Title
          style={{
            fontSize: format?.title?.size,
            color: format?.title?.color,
          }}
        >
          {title}
        </Title>
      )}
      {!formData || current?.failed ? (
        <Centered>{t('No data')}</Centered>
      ) : current?.data ? (
        <SuperChart
          chartType={formData.viz_type}
          formData={formData}
          queriesData={current.data}
          datasource={datasource}
          width={width}
          height={Math.max(1, chartHeight)}
          enableNoResults
        />
      ) : (
        <Centered>
          <Loading position="inline-centered" size="s" />
        </Centered>
      )}
    </Placed>
  );
});

const noop = () => {};

/** An image, shape, button or text of a tooltip page, as on the page. */
function TooltipElement({ object }: { object: TooltipObject }) {
  const theme = useTheme();
  const meta = useSelector(
    (state: RootState) => state.dashboardLayout.present[object.id]?.meta,
  );
  const kind = object.kind ?? 'shape';
  const config = (meta?.[ELEMENT_KEY] ??
    ELEMENT_DEFAULTS[kind].element) as ElementConfig;
  const box = visualStyle(meta?.mibiFormat as VisualFormat | undefined, theme);
  const content = () => {
    switch (config.kind) {
      case 'image':
        return <ImageView config={config} editMode={false} />;
      case 'button':
        return <ButtonView config={config} editMode={false} />;
      case 'text':
        return (
          <TextView
            config={config}
            editing={false}
            editMode={false}
            onChange={noop}
          />
        );
      case 'shape':
        return <ShapeView config={config} id={object.id} editMode={false} />;
      default:
        return null;
    }
  };
  return (
    <Placed
      className={cx('mibi-element', `mibi-element-${kind}`, box.className)}
      style={{
        ...box.style,
        left: object.x * CELL,
        top: object.y * CELL,
        width: object.width * CELL,
        height: object.height * CELL,
      }}
      data-test="mibi-tooltip-element"
    >
      {content()}
    </Placed>
  );
}

/** The tooltip area of a page with its charts, texts and design elements. */
function TooltipPageView({
  hover,
  boxRef,
  onSize,
}: {
  hover: MarkHover;
  boxRef: React.RefObject<HTMLDivElement>;
  onSize: () => void;
}) {
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const theme = useTheme();
  const page = tooltipPageOf(layout[hover.pageId]?.meta);
  const objects = useMemo(() => {
    const area = tooltipPageOf(layout[hover.pageId]?.meta);
    return area ? tooltipObjects(layout, hover.pageId, area) : [];
  }, [layout, hover.pageId]);
  const htmlSanitization = useSelector(
    (state: RootState) =>
      (state.common?.conf as { HTML_SANITIZATION?: boolean } | undefined)
        ?.HTML_SANITIZATION,
  );
  useEffect(onSize, [page?.width, page?.height, onSize]);

  if (!page) return null;
  const canvas = layout[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas as
    | CanvasFormat
    | undefined;
  const pageBackground = layout[hover.pageId]?.meta?.[PAGE_BACKGROUND_KEY] as
    | CanvasFormat['background']
    | undefined;
  const background =
    pageBackground && pageBackground.type !== 'none'
      ? pageBackground
      : canvas?.background;
  return (
    <Box
      ref={boxRef}
      role="tooltip"
      data-test="mibi-tooltip-page"
      style={{
        width: page.width * CELL,
        height: page.height * CELL,
        ...canvasStyle({ background }, theme),
      }}
    >
      {objects.map(object =>
        object.type === CHART_TYPE ? (
          <TooltipChart key={object.id} object={object} fields={hover.fields} />
        ) : object.kind ? (
          <TooltipElement key={object.id} object={object} />
        ) : (
          <Placed
            key={object.id}
            style={{
              left: object.x * CELL,
              top: object.y * CELL,
              width: object.width * CELL,
              height: object.height * CELL,
              padding: theme.sizeUnit * 2,
            }}
          >
            <SafeMarkdown
              source={String(layout[object.id]?.meta?.code ?? '')}
              htmlSanitization={htmlSanitization}
            />
          </Placed>
        ),
      )}
    </Box>
  );
}

/**
 * Shows the tooltip page of a chart over the mark under the pointer. Waits a
 * moment on a mark before asking for its data, keeps the answers by mark and
 * cancels the queries of a mark the pointer has left.
 */
export function TooltipPageHost() {
  const [hover, setHover] = useState<MarkHover | null>(null);
  const shown = useRef<string>();
  // The last mark the pointer entered, shown or about to be
  const latest = useRef<MarkHover>();
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const pointer = useRef({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);

  const place = useMemo(
    () => () => {
      const box = boxRef.current;
      if (!box) return;
      const { left, top } = tooltipPosition(
        pointer.current,
        { width: box.offsetWidth, height: box.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
    },
    [],
  );

  useEffect(() => () => queries.clear(), [dashboardId]);

  useEffect(() => {
    // Leaving a mark for another one is not leaving: a mark about to show
    // is only cancelled when the pointer stays out
    const hide = () => {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        clearTimeout(showTimer.current);
        shown.current = undefined;
        latest.current = undefined;
        setHover(null);
        queries.abortPending();
      }, HIDE_DELAY);
    };
    const onHover = (event: Event) => {
      const { detail } = event as CustomEvent<MarkHover>;
      clearTimeout(hideTimer.current);
      pointer.current = { x: detail.x, y: detail.y };
      if (isLessPrecise(detail, latest.current)) {
        place();
        return;
      }
      latest.current = detail;
      const key = `${detail.chartId}|${detail.pageId}|${markKey(detail.fields)}`;
      if (key === shown.current) {
        place();
        return;
      }
      clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => {
        // Queries of the mark before this one go on and fill the cache
        shown.current = key;
        setHover(detail);
      }, SHOW_DELAY);
    };
    // A click or a context menu takes over from the tooltip at once
    const hideNow = () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      latest.current = undefined;
      if (shown.current) {
        shown.current = undefined;
        setHover(null);
      }
    };
    const onMove = (event: MouseEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      place();
    };
    window.addEventListener(MARK_HOVER_EVENT, onHover);
    window.addEventListener(MARK_LEAVE_EVENT, hide);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('blur', hide);
    window.addEventListener('wheel', hide, { passive: true });
    window.addEventListener('pointerdown', hideNow, true);
    window.addEventListener('contextmenu', hideNow, true);
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      window.removeEventListener(MARK_HOVER_EVENT, onHover);
      window.removeEventListener(MARK_LEAVE_EVENT, hide);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('blur', hide);
      window.removeEventListener('wheel', hide);
      window.removeEventListener('pointerdown', hideNow, true);
      window.removeEventListener('contextmenu', hideNow, true);
    };
  }, [place]);

  if (!hover) return null;
  // The page shows in the look of the report, not that of the app
  return createPortal(
    <ReportTheme>
      <TooltipPageView hover={hover} boxRef={boxRef} onSize={place} />
    </ReportTheme>,
    document.body,
  );
}
