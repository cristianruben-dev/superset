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
  useRef,
  MouseEvent,
  type CSSProperties,
} from 'react';
import { t } from '@apache-superset/core/translation';
import {
  getNumberFormatter,
  getTimeFormatter,
  SMART_DATE_VERBOSE_ID,
  computeMaxFontSize,
  BinaryQueryObjectFilterClause,
  DTTM_ALIAS,
} from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/theme';
import Echart from '../components/Echart';
import { BigNumberVizProps } from './types';
import { cardTextStyle, kpiStatus, kpiColor } from './cardFormat';
import { getDisplayFormatter } from '../utils/chartFormatOptions';
import { PROPORTION } from './constants';
import { EventHandlers } from '../types';

const defaultNumberFormatter = getNumberFormatter();

function BigNumberVis({
  className = '',
  headerFormatter = defaultNumberFormatter,
  formatTime = getTimeFormatter(SMART_DATE_VERBOSE_ID),
  headerFontSize = PROPORTION.HEADER,
  kickerFontSize = PROPORTION.KICKER,
  metricNameFontSize = PROPORTION.METRIC_NAME,
  showMetricName = true,
  showTimestamp = false,
  showTrendLine = false,
  subheader = '',
  subheaderFontSize = PROPORTION.SUBHEADER,
  subtitleFontSize = PROPORTION.SUBHEADER,
  ...props
}: BigNumberVizProps) {
  const theme = useTheme();
  const format = props.cardFormat ?? {};
  const status = kpiStatus(props.bigNumber, props.goalValue, format);
  const statusColor =
    kpiColor(status, format) ??
    (status === 'good'
      ? theme.colorSuccess
      : status === 'bad'
        ? theme.colorError
        : status === 'neutral'
          ? theme.colorTextSecondary
          : undefined);
  const displayFormatter =
    getDisplayFormatter(format.cardValueUnits, format.cardValueDecimals) ??
    headerFormatter;
  const customText =
    Object.entries(format).some(
      ([key, value]) =>
        value != null && (key.endsWith('Font') || key.endsWith('Wrap')),
    ) || props.goalValue !== undefined;
  const textLayout: CSSProperties = {
    ...(customText ? { width: '100%', overflowY: 'auto', minHeight: 0 } : {}),
    ...(format.cardVerticalAlign
      ? {
          justifyContent:
            format.cardVerticalAlign === 'top'
              ? 'flex-start'
              : format.cardVerticalAlign === 'bottom'
                ? 'flex-end'
                : 'center',
        }
      : {}),
    ...(format.cardValueAlign
      ? {
          alignItems:
            format.cardValueAlign === 'center'
              ? 'center'
              : format.cardValueAlign === 'right'
                ? 'flex-end'
                : 'flex-start',
        }
      : {}),
  };

  // Create refs for each component to measure heights
  const metricNameRef = useRef<HTMLDivElement>(null);
  const kickerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const subheaderRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);

  const getClassName = () => {
    const names = `superset-legacy-chart-big-number ${className} ${
      props.bigNumberFallback ? 'is-fallback-value' : ''
    }`;
    if (showTrendLine) return names;
    return `${names} no-trendline`;
  };

  const createTemporaryContainer = () => {
    const container = document.createElement('div');
    container.className = getClassName();
    container.style.position = 'absolute'; // so it won't disrupt page layout
    container.style.opacity = '0'; // and not visible
    return container;
  };

  const renderFallbackWarning = () => {
    const { bigNumberFallback } = props;
    if (!formatTime || !bigNumberFallback || showTimestamp) return null;
    return (
      <span
        className="alert alert-warning"
        role="alert"
        title={t(
          `Last available value seen on %s`,
          formatTime(bigNumberFallback[0]),
        )}
      >
        {t('Not up to date')}
      </span>
    );
  };

  const renderMetricName = (maxHeight: number) => {
    const { metricName, width } = props;
    if (
      !(format.cardLabelShow ?? showMetricName) ||
      !(format.cardLabelText ?? metricName)
    )
      return null;

    const text = format.cardLabelText ?? metricName ?? '';

    const container = createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'metric-name',
      container,
    });
    container.remove();

    return (
      <div
        ref={metricNameRef}
        className="metric-name"
        style={{
          fontSize,
          height: 'auto',
          ...cardTextStyle(format, 'cardLabel'),
          ...(format.cardLabelGap != null && {
            [format.cardLabelPosition === 'after'
              ? 'marginTop'
              : 'marginBottom']: Math.max(0, format.cardLabelGap),
          }),
        }}
      >
        {text}
      </div>
    );
  };

  const renderKicker = (maxHeight: number) => {
    const { timestamp, width } = props;
    if (
      !formatTime ||
      !showTimestamp ||
      typeof timestamp === 'string' ||
      typeof timestamp === 'bigint' ||
      typeof timestamp === 'boolean'
    )
      return null;

    const text = timestamp === null ? '' : formatTime(timestamp);

    const container = createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'kicker',
      container,
    });
    container.remove();

    return (
      <div
        ref={kickerRef}
        className="kicker"
        style={{
          fontSize,
          height: 'auto',
          ...cardTextStyle(format, 'cardDate'),
        }}
      >
        {text}
      </div>
    );
  };

  const renderHeader = (maxHeight: number) => {
    if (format.cardValueShow === false) return null;
    const { bigNumber, width, colorThresholdFormatters, onContextMenu } = props;
    // Format bigNumber based on its type: null/undefined -> "No data", number -> format, else -> string
    let text: string;
    if (bigNumber === null || bigNumber === undefined) {
      text = format.cardBlankText ?? t('No data');
    } else if (typeof bigNumber === 'number') {
      text = displayFormatter(bigNumber);
    } else if (typeof bigNumber === 'string') {
      text = bigNumber;
    } else {
      // For boolean/Date values, convert to number if possible, else show as string
      const numValue = Number(bigNumber);
      text = Number.isNaN(numValue)
        ? String(bigNumber)
        : displayFormatter(numValue);
    }

    const hasThresholdColorFormatter =
      Array.isArray(colorThresholdFormatters) &&
      colorThresholdFormatters.length > 0;

    let numberColor;
    if (hasThresholdColorFormatter) {
      colorThresholdFormatters!.forEach(formatter => {
        if (typeof bigNumber === 'number' && !isNaN(bigNumber)) {
          numberColor = formatter.getColorFromValue(bigNumber);
        }
      });
    } else {
      numberColor = theme.colorText;
    }

    const container = createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width * 0.9, // reduced it's max width
      maxHeight,
      className: 'header-line',
      container,
    });
    container.remove();

    const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
      if (onContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
      }
    };

    return (
      <div
        ref={headerRef}
        className="header-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize,
          height: 'auto',
          color: numberColor,
          ...cardTextStyle(format, 'cardValue'),
          ...(statusColor
            ? { color: statusColor, '--mb-v-value-color': statusColor }
            : {}),
        }}
        onContextMenu={handleContextMenu}
      >
        {status && format.kpiShowIcon !== false && (
          <i
            role="img"
            aria-label={
              status === 'good'
                ? t('Good')
                : status === 'bad'
                  ? t('Bad')
                  : t('Neutral')
            }
            style={{
              fontStyle: 'normal',
              fontSize: format.kpiIconSize ?? '0.6em',
              marginRight: 8,
            }}
          >
            {status === 'neutral'
              ? '●'
              : typeof props.bigNumber === 'number' &&
                  props.bigNumber > (props.goalValue ?? 0)
                ? '▲'
                : '▼'}
          </i>
        )}
        {text}
      </div>
    );
  };

  const rendermetricComparisonSummary = (maxHeight: number) => {
    const { width } = props;
    let fontSize = 0;
    if (props.goalValue !== undefined) {
      const delta =
        typeof props.bigNumber === 'number'
          ? props.bigNumber - props.goalValue
          : undefined;
      const distance =
        delta === undefined
          ? t('N/A')
          : format.kpiDistanceMode === 'absolute'
            ? displayFormatter(delta)
            : props.goalValue === 0
              ? t('N/A')
              : getNumberFormatter('+.1%')(delta / Math.abs(props.goalValue));
      return (
        <div
          className="auradata-kpi-goal"
          style={{
            fontSize: Math.max(10, Math.min(16, maxHeight / 2)),
            color: statusColor,
          }}
        >
          {format.kpiGoalShow !== false && (
            <div style={cardTextStyle(format, 'kpiGoal')}>
              {format.kpiGoalLabel ?? t('Goal')}:{' '}
              {displayFormatter(props.goalValue)}
            </div>
          )}
          {format.kpiDistanceShow !== false && (
            <div style={cardTextStyle(format, 'kpiDistance')}>
              {format.kpiDistanceLabel ?? t('Distance')}: {distance}
            </div>
          )}
        </div>
      );
    }
    const text = subheader;

    if (text) {
      const container = createTemporaryContainer();
      document.body.append(container);
      try {
        fontSize = computeMaxFontSize({
          text,
          maxWidth: width * 0.9,
          maxHeight,
          className: 'subheader-line',
          container,
        });
      } finally {
        container.remove();
      }

      return (
        <div
          ref={subheaderRef}
          className="subheader-line"
          style={{
            fontSize,
            height: maxHeight,
          }}
        >
          {text}
        </div>
      );
    }
    return null;
  };

  const renderSubtitle = (maxHeight: number) => {
    const { subtitle, width, bigNumber, bigNumberFallback } = props;
    let fontSize = 0;

    const NO_DATA_OR_HASNT_LANDED = t(
      'No data after filtering or data is NULL for the latest time record',
    );
    const NO_DATA = t(
      'Try applying different filters or ensuring your datasource has data',
    );

    let text = subtitle;
    if (bigNumber === null) {
      text =
        subtitle || (bigNumberFallback ? NO_DATA : NO_DATA_OR_HASNT_LANDED);
    }

    if (text) {
      const container = createTemporaryContainer();
      document.body.append(container);
      fontSize = computeMaxFontSize({
        text,
        maxWidth: width * 0.9,
        maxHeight,
        className: 'subtitle-line',
        container,
      });
      container.remove();

      return (
        <>
          <div
            ref={subtitleRef}
            className="subtitle-line subheader-line"
            style={{
              fontSize: `${fontSize}px`,
              height: maxHeight,
              ...cardTextStyle(format, 'cardSubtitle'),
            }}
          >
            {text}
          </div>
        </>
      );
    }
    return null;
  };

  const renderTrendline = (maxHeight: number) => {
    const {
      width,
      trendLineData,
      echartOptions,
      refs,
      onContextMenu,
      formData,
      xValueFormatter,
    } = props;

    // if can't find any non-null values, no point rendering the trendline
    if (!trendLineData?.some(d => d[1] !== null)) {
      return null;
    }

    const eventHandlers: EventHandlers = {
      contextmenu: eventParams => {
        if (onContextMenu) {
          eventParams.event.stop();
          const { data } = eventParams;
          if (data) {
            const pointerEvent = eventParams.event.event;
            const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
            drillToDetailFilters.push({
              col:
                formData?.xAxis === DTTM_ALIAS
                  ? formData?.granularitySqla
                  : formData?.xAxis,
              grain: formData?.timeGrainSqla,
              op: '==',
              val: data[0],
              formattedVal: xValueFormatter?.(data[0]),
            });
            onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
              drillToDetail: drillToDetailFilters,
            });
          }
        }
      },
    };

    return (
      echartOptions && (
        <Echart
          refs={refs}
          width={Math.floor(width)}
          height={maxHeight}
          echartOptions={echartOptions}
          eventHandlers={eventHandlers}
          vizType={formData?.vizType}
        />
      )
    );
  };

  const { height } = props;
  const componentClassName = getClassName();

  if (showTrendLine) {
    const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
    const allTextHeight = height - chartHeight;
    return (
      <div className={componentClassName} style={{ height, width: '100%', overflow: 'hidden' }}>
        <div
          className="text-container"
          style={{
            height: allTextHeight,
            width: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box',
            ...textLayout,
          }}
        >
          {renderFallbackWarning()}
          {format.cardLabelPosition !== 'after' &&
            renderMetricName(
              Math.ceil(
                (metricNameFontSize || 0) * (1 - PROPORTION.TRENDLINE) * height,
              ),
            )}
          {renderKicker(
            Math.ceil(
              (kickerFontSize || 0) * (1 - PROPORTION.TRENDLINE) * height,
            ),
          )}
          {renderHeader(
            Math.ceil(headerFontSize * (1 - PROPORTION.TRENDLINE) * height),
          )}
          {format.cardLabelPosition === 'after' &&
            renderMetricName((metricNameFontSize || 0) * height)}
          {rendermetricComparisonSummary(
            Math.ceil(subheaderFontSize * (1 - PROPORTION.TRENDLINE) * height),
          )}
          {renderSubtitle(
            Math.ceil(subtitleFontSize * (1 - PROPORTION.TRENDLINE) * height),
          )}
        </div>
        {renderTrendline(chartHeight)}
      </div>
    );
  }
    return (
      <div
        className={componentClassName}
        style={{
          height,
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          className="text-container"
          style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box',
            ...textLayout,
          }}
        >
        {renderFallbackWarning()}
        {format.cardLabelPosition !== 'after' &&
          renderMetricName((metricNameFontSize || 0) * height)}
        {renderKicker((kickerFontSize || 0) * height)}
        {renderHeader(Math.ceil(headerFontSize * height))}
        {format.cardLabelPosition === 'after' &&
          renderMetricName((metricNameFontSize || 0) * height)}
        {rendermetricComparisonSummary(Math.ceil(subheaderFontSize * height))}
        {renderSubtitle(Math.ceil(subtitleFontSize * height))}
      </div>
    </div>
  );
}

const StyledBigNumberVis = styled(BigNumberVis)`
  ${({ theme }) => `
    font-family: ${theme.fontFamily};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;

    &.no-trendline .subheader-line {
      padding-bottom: 0.3em;
    }

    .text-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      .alert {
        font-size: ${theme.fontSizeSM};
        margin: -0.5em 0 0.4em;
        line-height: 1;
        padding: ${theme.sizeUnit}px;
        border-radius: ${theme.borderRadius}px;
      }
    }

    .kicker {
      line-height: 1.1em;
      margin-bottom: ${theme.sizeUnit}px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .metric-name {
      line-height: 1.1em;
      margin-bottom: ${theme.sizeUnit}px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-line {
      position: relative;
      line-height: 1.1em;
      white-space: nowrap;
      margin-bottom: ${theme.sizeUnit}px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .subheader-line {
      line-height: 1.1em;
      margin-bottom: ${theme.sizeUnit}px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .subtitle-line {
      line-height: 1.1em;
      margin-bottom: ${theme.sizeUnit}px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &.is-fallback-value {
      .kicker,
      .header-line,
      .subheader-line {
        opacity: 60%;
      }
    }
  `}
`;

export default StyledBigNumberVis;
