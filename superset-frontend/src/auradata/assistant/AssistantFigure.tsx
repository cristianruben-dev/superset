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
import { useEffect, useMemo, useState } from 'react';
import { type QueryData, SuperChart } from '@superset-ui/core';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useResizeDetector } from 'react-resize-detector';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { chartFormData, figureSource } from './figure';
import type { Figure } from './types';

const CHART_HEIGHT = 220;
const NUMBER_HEIGHT = 110;
const DEFAULT_WIDTH = 360;

const Card = styled.figure`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit * 3}px 0 0;
    padding: ${theme.sizeUnit * 3}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};

    figcaption {
      display: flex;
      align-items: baseline;
      gap: ${theme.sizeUnit}px;
      margin-top: ${theme.sizeUnit * 3}px;
      padding-top: ${theme.sizeUnit * 2}px;
      border-top: 1px solid ${theme.colorBorderSecondary};
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
      line-height: 1.5;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const Note = styled.p`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit * 2}px 0 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const Rows = styled.div`
  ${({ theme }) => css`
    max-height: ${theme.sizeUnit * 60}px;
    overflow: auto;

    table {
      display: table;
      width: 100%;
      margin: 0;
      border-collapse: collapse;
      font-size: ${theme.fontSizeSM}px;
    }
    th,
    td {
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 3}px ${theme.sizeUnit}px 0;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      text-align: left;
      white-space: nowrap;
    }
    th {
      position: sticky;
      top: 0;
      background: ${theme.colorBgContainer};
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorTextSecondary};
    }
    th:last-child,
    td:last-child {
      padding-right: 0;
    }
    tr:last-child td {
      border-bottom: 0;
    }
    td.figure,
    th.figure {
      font-family: ${theme.fontFamilyCode};
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
  `}
`;

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return typeof value === 'number' ? value.toLocaleString() : String(value);
};

/** The rows of the answer, which came with it. */
function FigureRows({ figure }: { figure: Figure }) {
  const columns = Object.keys(figure.rows[0] ?? {});
  return (
    <Rows>
      <table>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column}
                className={
                  typeof figure.rows[0]?.[column] === 'number' ? 'figure' : ''
                }
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {figure.rows.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={index}>
              {columns.map(column => (
                <td
                  key={column}
                  className={typeof row[column] === 'number' ? 'figure' : ''}
                >
                  {cellText(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {figure.row_count > figure.rows.length && (
        <Note>
          {t('Showing %s of %s rows.', figure.rows.length, figure.row_count)}
        </Note>
      )}
    </Rows>
  );
}

/**
 * A chart or a table of an answer, saying where it comes from. The chart goes through
 * the chart data API as any other, and if the server refuses it the rows stay.
 */
export function AssistantFigure({
  figure,
  dashboardId,
}: {
  figure: Figure;
  dashboardId: number;
}) {
  const formData = useMemo(
    () => chartFormData(figure, dashboardId),
    [figure, dashboardId],
  );
  const [data, setData] = useState<QueryData[]>();
  const [failed, setFailed] = useState(false);
  const { width, ref } = useResizeDetector<HTMLDivElement>({
    handleHeight: false,
  });

  useEffect(() => {
    if (!formData) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    requestChartDataResolved(
      {
        formData,
        resultFormat: 'json',
        resultType: 'full',
        requestParams: { signal, dashboard_id: dashboardId },
      },
      signal,
    ).then(setData, () => {
      if (!signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [formData, dashboardId]);

  const height = formData?.metric ? NUMBER_HEIGHT : CHART_HEIGHT;
  let content;
  if (!formData) {
    content = <FigureRows figure={figure} />;
  } else if (failed) {
    content = (
      <>
        <Note>{t('The chart could not be drawn.')}</Note>
        <FigureRows figure={figure} />
      </>
    );
  } else if (data) {
    content = (
      <SuperChart
        chartType={formData.viz_type}
        formData={formData}
        queriesData={data}
        width={width ?? DEFAULT_WIDTH}
        height={height}
        enableNoResults
      />
    );
  } else {
    content = <Loading position="inline-centered" size="s" />;
  }

  return (
    <Card data-test="auradata-assistant-figure">
      <div ref={ref}>{content}</div>
      <figcaption>
        <Icons.DatabaseOutlined iconSize="xs" />
        <span>
          {figureSource(figure)}
          {figure.row_count > 1 &&
            ` · ${tn('%s row', '%s rows', figure.row_count, figure.row_count)}`}
        </span>
      </figcaption>
    </Card>
  );
}
