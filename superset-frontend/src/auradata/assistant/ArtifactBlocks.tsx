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
import type { ReactNode } from 'react';
import { SuperChart } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useResizeDetector } from 'react-resize-detector';
import getBootstrapData from 'src/utils/getBootstrapData';
import { blockSource, figureValue, grouped, rowsOf } from './artifact';
import { AssistantMarkdown } from './AssistantMarkdown';
import type {
  ArtifactBlock,
  ChartBlock,
  DataBlock,
  FigureBlock,
  TableBlock,
} from './types';
import { useBlockData } from './useBlockData';

const CHART_HEIGHT = 280;
const DEFAULT_WIDTH = 560;
const FIGURE_MIN_WIDTH = 168;

const Flow = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const Figures = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(${FIGURE_MIN_WIDTH}px, 1fr));
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const Selectable = styled.section`
  ${({ theme }) => css`
    position: relative;
    min-width: 0;
    margin: 0 -${theme.sizeUnit * 4}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-radius: ${theme.sizeUnit * 2}px;
    cursor: pointer;
    transition: background ${theme.motionDurationFast};

    &:hover {
      background: ${theme.colorFillQuaternary};
    }
    &[data-selected='true'] {
      background: ${theme.colorPrimaryBg};
      box-shadow: inset 2px 0 0 ${theme.colorPrimary};
    }
    .pick {
      position: absolute;
      top: ${theme.sizeUnit * 2}px;
      right: ${theme.sizeUnit * 2}px;
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      padding: ${theme.sizeUnit / 2}px ${theme.sizeUnit * 2}px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.sizeUnit}px;
      background: ${theme.colorBgContainer};
      color: ${theme.colorTextSecondary};
      font: inherit;
      font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
      cursor: pointer;
      opacity: 0;
      transition: opacity ${theme.motionDurationFast};
    }
    &:hover .pick,
    &[data-selected='true'] .pick,
    .pick:focus-visible {
      opacity: 1;
    }
    .pick:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
    @media (hover: none) {
      .pick {
        opacity: 1;
      }
    }
  `}
`;

const ReadOnly = styled(Selectable)`
  cursor: default;

  &:hover {
    background: none;
  }
`;

/** The type of a report that has to read well: this is the page people came for. */
const Prose = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeLG}px;
    line-height: 1.7;
    color: ${theme.colorText};
    overflow-wrap: anywhere;

    p,
    ul,
    ol {
      margin: 0 0 ${theme.sizeUnit * 3}px;
    }
    p:last-child,
    ul:last-child,
    ol:last-child {
      margin-bottom: 0;
    }
    ul,
    ol {
      padding-left: ${theme.sizeUnit * 6}px;
    }
    li + li {
      margin-top: ${theme.sizeUnit}px;
    }
    h1,
    h2 {
      margin: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeXL}px;
      line-height: 1.3;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.01em;
    }
    h3,
    h4 {
      margin: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit}px;
      font-size: ${theme.fontSizeLG}px;
      font-weight: ${theme.fontWeightStrong};
    }
    strong {
      font-weight: ${theme.fontWeightStrong};
    }
    code {
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeSM}px;
    }
    a {
      color: ${theme.colorLink};
    }
  `}
`;

const BlockTitle = styled.h3`
  ${({ theme }) => css`
    margin: 0 0 ${theme.sizeUnit * 3}px;
    padding-right: ${theme.sizeUnit * 16}px;
    font-size: ${theme.fontSize}px;
    line-height: 1.4;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const Source = styled.p`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit * 2}px 0 0;
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
    line-height: 1.5;
    color: ${theme.colorTextTertiary};
    overflow-wrap: anywhere;
  `}
`;

const Value = styled.div`
  ${({ theme }) => css`
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.sizeUnit * 8}px;
    line-height: 1.2;
    font-weight: ${theme.fontWeightMedium ?? 500};
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    color: ${theme.colorText};
    overflow-wrap: anywhere;
  `}
`;

const Label = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit}px;
    padding-right: ${theme.sizeUnit * 8}px;
    font-size: ${theme.fontSizeSM}px;
    line-height: 1.4;
    color: ${theme.colorTextSecondary};
  `}
`;

const Notice = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px;
    border: 1px dashed ${theme.colorBorder};
    border-radius: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};

    button {
      margin-left: auto;
      padding: 0;
      border: 0;
      background: none;
      color: ${theme.colorLink};
      font: inherit;
      cursor: pointer;
    }
  `}
`;

const Rows = styled.div`
  ${({ theme }) => css`
    overflow-x: auto;

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${theme.fontSizeSM}px;
    }
    th,
    td {
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 4}px
        ${theme.sizeUnit * 1.5}px 0;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      text-align: left;
      white-space: nowrap;
    }
    th {
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorTextSecondary};
    }
    th:last-child,
    td:last-child {
      padding-right: 0;
    }
    .figure {
      font-family: ${theme.fontFamilyCode};
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
  `}
`;

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return typeof value === 'number'
    ? value.toLocaleString(getBootstrapData().common?.locale)
    : String(value);
};

function Refused() {
  return (
    <Notice data-test="auradata-artifact-refused">
      <Icons.LockOutlined iconSize="s" />
      <span>{t('You do not have access to this data.')}</span>
    </Notice>
  );
}

function Failed({ retry }: { retry: () => void }) {
  return (
    <Notice data-test="auradata-artifact-failed">
      <Icons.WarningOutlined iconSize="s" />
      <span>{t('This data could not be read.')}</span>
      <button type="button" onClick={retry}>
        {t('Try again')}
      </button>
    </Notice>
  );
}

function Empty() {
  return (
    <Notice data-test="auradata-artifact-empty">
      <span>{t('No data for these filters.')}</span>
    </Notice>
  );
}

function BlockSource({
  block,
  sources,
}: {
  block: DataBlock;
  sources: Record<string, string>;
}) {
  const name = sources[block.query.dataset_id];
  return name ? <Source>{blockSource(block, name)}</Source> : null;
}

interface DataProps<Block extends DataBlock> {
  block: Block;
  dashboardId: number;
  sources: Record<string, string>;
}

/** What every block of data shows until it has numbers to draw. */
function BlockState({
  data,
  draw,
}: {
  data: ReturnType<typeof useBlockData>;
  draw: (rows: Record<string, unknown>[]) => ReactNode;
}) {
  const { state, retry } = data;
  if (state.status === 'loading') {
    return <Loading position="inline-centered" size="s" />;
  }
  if (state.status === 'refused') return <Refused />;
  if (state.status === 'failed') return <Failed retry={retry} />;
  const rows = rowsOf(state.data);
  return rows.length ? <>{draw(rows)}</> : <Empty />;
}

function FigureView({ block, dashboardId, sources }: DataProps<FigureBlock>) {
  const data = useBlockData(
    block,
    dashboardId,
    !!sources[block.query.dataset_id],
  );
  return (
    <>
      <Label>{block.label}</Label>
      <BlockState
        data={data}
        draw={rows => (
          <Value data-test="auradata-artifact-value">
            {figureValue(rows, block.format)}
          </Value>
        )}
      />
      <BlockSource block={block} sources={sources} />
    </>
  );
}

function TableView({ block, dashboardId, sources }: DataProps<TableBlock>) {
  const data = useBlockData(
    block,
    dashboardId,
    !!sources[block.query.dataset_id],
  );
  return (
    <>
      <BlockTitle>{block.title}</BlockTitle>
      <BlockState
        data={data}
        draw={rows => {
          const columns = Object.keys(rows[0]);
          const isFigure = (column: string) =>
            typeof rows[0][column] === 'number' ? 'figure' : undefined;
          return (
            <Rows>
              <table>
                <thead>
                  <tr>
                    {columns.map(column => (
                      <th key={column} className={isFigure(column)}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={index}>
                      {columns.map(column => (
                        <td key={column} className={isFigure(column)}>
                          {cellText(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Rows>
          );
        }}
      />
      <BlockSource block={block} sources={sources} />
    </>
  );
}

function ChartView({ block, dashboardId, sources }: DataProps<ChartBlock>) {
  const data = useBlockData(
    block,
    dashboardId,
    !!sources[block.query.dataset_id],
  );
  const { width, ref } = useResizeDetector<HTMLDivElement>({
    handleHeight: false,
  });
  const { state } = data;
  return (
    <>
      <BlockTitle>{block.title}</BlockTitle>
      <div ref={ref}>
        <BlockState
          data={data}
          draw={() =>
            state.status === 'ready' && (
              <SuperChart
                chartType={state.formData.viz_type}
                formData={state.formData}
                queriesData={state.data}
                width={width ?? DEFAULT_WIDTH}
                height={CHART_HEIGHT}
                enableNoResults
              />
            )
          }
        />
      </div>
      <BlockSource block={block} sources={sources} />
    </>
  );
}

function BlockView({
  block,
  dashboardId,
  sources,
}: {
  block: ArtifactBlock;
  dashboardId: number;
  sources: Record<string, string>;
}) {
  switch (block.type) {
    case 'text':
      return (
        <Prose>
          <AssistantMarkdown text={block.text} />
        </Prose>
      );
    case 'figure':
      return (
        <FigureView block={block} dashboardId={dashboardId} sources={sources} />
      );
    case 'chart':
      return (
        <ChartView block={block} dashboardId={dashboardId} sources={sources} />
      );
    default:
      return (
        <TableView block={block} dashboardId={dashboardId} sources={sources} />
      );
  }
}

/** A click on a link of a text follows it and selects nothing. */
const isInteractive = (target: EventTarget) =>
  target instanceof Element && !!target.closest('a, button');

function Picked({
  block,
  selected,
  onSelect,
  children,
}: {
  block: ArtifactBlock;
  selected: boolean;
  onSelect?: (id: string) => void;
  children: ReactNode;
}) {
  if (!onSelect) return <ReadOnly>{children}</ReadOnly>;
  return (
    <Selectable
      data-selected={selected}
      data-test="auradata-artifact-block"
      onClick={event => {
        if (!isInteractive(event.target)) onSelect(block.id);
      }}
    >
      {children}
      <button
        type="button"
        className="pick"
        aria-pressed={selected}
        onClick={event => {
          event.stopPropagation();
          onSelect(block.id);
        }}
        data-test="auradata-artifact-pick"
      >
        {selected ? t('Selected') : t('Select')}
      </button>
    </Selectable>
  );
}

/**
 * The blocks of a document. Text goes through `AssistantMarkdown`, as anything the model
 * writes, and cells and labels are plain text. Numbers come from the query of each block,
 * with the permissions of the person looking, and a block that gets refused says so.
 * Without `onSelect` it is an earlier version, only to read.
 */
export function ArtifactBlocks({
  blocks,
  sources,
  dashboardId,
  selected,
  onSelect,
}: {
  blocks: ArtifactBlock[];
  sources: Record<string, string>;
  dashboardId: number;
  selected?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <Flow>
      {grouped(blocks).map(group =>
        group.length > 1 ? (
          <Figures key={group[0].id}>
            {group.map(block => (
              <Picked
                key={block.id}
                block={block}
                selected={block.id === selected}
                onSelect={onSelect}
              >
                <BlockView
                  block={block}
                  dashboardId={dashboardId}
                  sources={sources}
                />
              </Picked>
            ))}
          </Figures>
        ) : (
          <Picked
            key={group[0].id}
            block={group[0]}
            selected={group[0].id === selected}
            onSelect={onSelect}
          >
            <BlockView
              block={group[0]}
              dashboardId={dashboardId}
              sources={sources}
            />
          </Picked>
        ),
      )}
    </Flow>
  );
}
