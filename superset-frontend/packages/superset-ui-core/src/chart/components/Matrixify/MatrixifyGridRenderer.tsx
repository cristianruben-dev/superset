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

import { useMemo, type CSSProperties } from 'react';
import { styled } from '@apache-superset/core/theme';
import { MatrixifyFormData } from '../../types/matrixify';
import {
  getCustomFontCss,
  toBoundedNumber,
  toCssColor,
  type ColorInput,
  type FontStyleValue,
} from '../../visualFormatting';
import { generateMatrixifyGrid } from './MatrixifyGridGenerator';
import MatrixifyGridCell from './MatrixifyGridCell';

// Layout constants
const HEADER_HEIGHT = 24; // Height for column headers and width for row headers (reduced from 32)
const HEADER_MIN_WIDTH = 20; // Minimum width for row headers (reduced from 24)
const HEADER_MAX_WIDTH = 24; // Maximum width for row headers (reduced from 32)
const GRID_GAP = 8; // Gap between grid cells (reduced from 16 for more density)
const GROUP_SPACING = 16; // Spacing between column groups when wrapping (reduced from 32)
const DEFAULT_ROW_HEIGHT = 300; // Default height for each row
const DEFAULT_CHARTS_PER_ROW = 3; // Default number of charts per row when not fitting dynamically

const GridContainer = styled.div<{ height?: number }>`
  width: 100%;
  ${({ height }) => height && `height: ${height}px;`}
  padding: ${({ theme }) =>
    theme.sizeUnit}px; /* Reduced padding for more density */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`;

const GridScrollContainer = styled.div`
  flex: 1;
  overflow: auto;
  min-height: 0;
`;

const GridLayout = styled.div<{
  columns: number;
  hasRowHeaders: boolean;
  rowHeight: number;
  hasColumnHeaders: boolean;
  maxColumns: number; // Maximum columns to maintain consistent width
}>`
  display: grid;
  grid-template-columns: ${({ maxColumns, hasRowHeaders }) =>
    hasRowHeaders
      ? `${HEADER_HEIGHT}px repeat(${maxColumns}, minmax(0, 1fr))`
      : `repeat(${maxColumns}, minmax(0, 1fr))`};
  ${({ hasColumnHeaders, rowHeight }) =>
    hasColumnHeaders
      ? `grid-template-rows: ${HEADER_HEIGHT}px; grid-auto-rows: ${rowHeight}px;`
      : `grid-auto-rows: ${rowHeight}px;`}
  gap: var(--mibi-mx-gap, ${GRID_GAP}px);
  width: 100%;
  min-width: 0;
  min-height: 0;
`;

const GridGroup = styled.div<{ isLast: boolean }>`
  margin-bottom: ${({ isLast }) => (isLast ? 0 : GROUP_SPACING)}px;
`;

const GridHeader = styled.div`
  background-color: var(
    --mibi-mx-header-bg,
    ${({ theme }) => theme.colorFillAlter}
  );
  color: var(--mibi-mx-header-color, inherit);
  font-family: var(--mibi-mx-header-family, inherit);
  font-style: var(--mibi-mx-header-style, normal);
  padding: ${({ theme }) => theme.sizeUnit / 2}px; /* Reduced padding */
  font-weight: var(
    --mibi-mx-header-weight,
    ${({ theme }) => theme.fontWeightStrong}
  );
  text-align: var(--mibi-mx-header-align, center);
  border: var(
    --mibi-mx-header-border,
    1px solid ${({ theme }) => theme.colorBorder}
  );
  border-radius: ${({ theme }) => theme.borderRadius}px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(
    --mibi-mx-header-size,
    ${({ theme }) => theme.fontSizeSM}px
  ); /* Back to small (readable) font */

  &.matrixify-row-header {
    writing-mode: vertical-rl;
    transform: rotate(-180deg);
    padding: ${({ theme }) => theme.sizeUnit}px
      ${({ theme }) => theme.sizeUnit / 4}px; /* Tighter padding */
    min-width: ${HEADER_MIN_WIDTH}px;
    max-width: ${HEADER_MAX_WIDTH}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &.matrixify-col-header {
    height: ${HEADER_HEIGHT}px;
    display: flex;
    align-items: center;
    justify-content: var(--mibi-mx-header-justify, center);
  }
`;

const JUSTIFY: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/**
 * The look of the grid of small multiples, as CSS variables its headers and
 * cells read: gap, cell border and background, and the font, background and
 * alignment of the headers. Settings left empty keep the look of the theme.
 */
export function matrixifyGridStyle(
  formData: Record<string, unknown>,
): CSSProperties {
  const vars: Record<string, string> = {};
  const gap = toBoundedNumber(formData.matrixify_grid_gap, Number.NaN, 0, 64);
  if (Number.isFinite(gap)) vars['--mibi-mx-gap'] = `${gap}px`;
  const font = getCustomFontCss(
    formData.matrixify_header_font as FontStyleValue | null | undefined,
  );
  if (font.color) vars['--mibi-mx-header-color'] = font.color;
  if (font.fontSize) vars['--mibi-mx-header-size'] = font.fontSize;
  if (font.fontFamily) vars['--mibi-mx-header-family'] = font.fontFamily;
  if (font.fontWeight)
    vars['--mibi-mx-header-weight'] = String(font.fontWeight);
  if (font.fontStyle) vars['--mibi-mx-header-style'] = font.fontStyle;
  const headerBg = toCssColor(
    formData.matrixify_header_background as ColorInput,
  );
  if (headerBg) vars['--mibi-mx-header-bg'] = headerBg;
  const align = formData.matrixify_header_align;
  if (typeof align === 'string' && JUSTIFY[align]) {
    vars['--mibi-mx-header-align'] = align;
    vars['--mibi-mx-header-justify'] = JUSTIFY[align];
  }
  const cellBg = toCssColor(formData.matrixify_cell_background as ColorInput);
  if (cellBg) vars['--mibi-mx-cell-bg'] = cellBg;
  if (formData.matrixify_cell_border_show === false) {
    vars['--mibi-mx-cell-border'] = 'none';
    vars['--mibi-mx-header-border'] = 'none';
  } else {
    const color = toCssColor(
      formData.matrixify_cell_border_color as ColorInput,
    );
    const width = toBoundedNumber(
      formData.matrixify_cell_border_width,
      Number.NaN,
      0,
      20,
    );
    if (color || Number.isFinite(width)) {
      const border = `${Number.isFinite(width) ? width : 1}px solid ${
        color ?? 'currentColor'
      }`;
      vars['--mibi-mx-cell-border'] = border;
      vars['--mibi-mx-header-border'] = border;
    }
  }
  const radius = toBoundedNumber(
    formData.matrixify_cell_radius,
    Number.NaN,
    0,
    50,
  );
  if (Number.isFinite(radius)) vars['--mibi-mx-cell-radius'] = `${radius}px`;
  return vars as CSSProperties;
}

interface MatrixifyGridRendererProps {
  formData: MatrixifyFormData;
  datasource?: any;
  width?: number;
  height?: number;
  hooks?: any;
}

function MatrixifyGridRenderer({
  formData,
  datasource,
  width,
  height,
  hooks,
}: MatrixifyGridRendererProps) {
  // Generate grid structure from form data
  const grid = useMemo(
    () => generateMatrixifyGrid(formData as any),
    [formData],
  );

  // Determine layout parameters - only show headers/labels if layout is enabled
  const showRowLabels =
    formData.matrixify_mode_rows !== undefined &&
    formData.matrixify_mode_rows !== 'disabled' &&
    (formData.matrixify_show_row_labels ?? true);
  const showColumnHeaders =
    formData.matrixify_mode_columns !== undefined &&
    formData.matrixify_mode_columns !== 'disabled' &&
    (formData.matrixify_show_column_headers ?? true);
  const rowHeight = formData.matrixify_row_height || DEFAULT_ROW_HEIGHT;
  const fitColumnsDynamically =
    formData.matrixify_fit_columns_dynamically ?? true;
  const chartsPerRow =
    formData.matrixify_charts_per_row || DEFAULT_CHARTS_PER_ROW;

  // Calculate column groups for wrapping - must be before conditional return
  const columnGroups = useMemo(() => {
    if (!grid) {
      return [];
    }
    const { colHeaders: headers } = grid;
    const totalCols = headers.length;
    const colsPerRow = fitColumnsDynamically
      ? totalCols
      : Math.min(chartsPerRow, totalCols);

    const groups = [];
    for (let i = 0; i < totalCols; i += colsPerRow) {
      groups.push({
        startIdx: i,
        endIdx: Math.min(i + colsPerRow, totalCols),
        headers: headers.slice(i, Math.min(i + colsPerRow, totalCols)),
      });
    }
    return groups;
  }, [grid, fitColumnsDynamically, chartsPerRow]);

  if (!grid) {
    return null;
  }

  const { rowHeaders, colHeaders, cells } = grid;

  // Calculate actual columns per row
  const totalColumns = colHeaders.length;
  const columnsPerRow = fitColumnsDynamically
    ? totalColumns
    : Math.min(chartsPerRow, totalColumns);

  const hasRowHeaders = showRowLabels && rowHeaders.length > 0;
  const hasColumnHeaders = showColumnHeaders && colHeaders.length > 0;

  return (
    <GridContainer
      height={height}
      style={matrixifyGridStyle(formData as Record<string, unknown>)}
    >
      <GridScrollContainer>
        {/* Iterate through each row first */}
        {cells.map((row, rowIdx) => (
          <div key={`row-${rowIdx}`}>
            {/* Then iterate through column groups for this row */}
            {columnGroups.map((colGroup, groupIdx) => {
              const groupColumns = colGroup.endIdx - colGroup.startIdx;
              const emptyColumns = columnsPerRow - groupColumns;
              const isLastGroup = groupIdx === columnGroups.length - 1;
              const isLastRow = rowIdx === cells.length - 1;

              // Show headers: always when wrapping (multiple column groups), only first row when not wrapping
              const showHeadersForThisGroup =
                hasColumnHeaders && (columnGroups.length > 1 || rowIdx === 0);

              return (
                <GridGroup
                  key={`row-${rowIdx}-col-group-${groupIdx}`}
                  isLast={isLastGroup && isLastRow}
                >
                  <GridLayout
                    columns={groupColumns}
                    maxColumns={columnsPerRow}
                    hasRowHeaders={hasRowHeaders}
                    rowHeight={rowHeight}
                    hasColumnHeaders={showHeadersForThisGroup}
                  >
                    {/* Corner cell (empty) - when showing headers */}
                    {showHeadersForThisGroup && hasRowHeaders && <div />}

                    {/* Column headers - show based on wrapping logic */}
                    {showHeadersForThisGroup && (
                      <>
                        {colGroup.headers.map((header, idx) => (
                          <GridHeader
                            key={`col-header-${rowIdx}-${groupIdx}-${idx}`}
                            className="matrixify-col-header"
                            title={header}
                          >
                            {header}
                          </GridHeader>
                        ))}
                        {/* Empty cells to maintain grid structure */}
                        {Array.from({ length: emptyColumns }).map((_, idx) => (
                          <div
                            key={`empty-header-${rowIdx}-${groupIdx}-${idx}`}
                          />
                        ))}
                      </>
                    )}

                    {/* Row header - only for first column group */}
                    {hasRowHeaders && groupIdx === 0 && (
                      <GridHeader
                        key={`row-header-${rowIdx}`}
                        className="matrixify-row-header"
                        title={rowHeaders[rowIdx]}
                      >
                        {rowHeaders[rowIdx]}
                      </GridHeader>
                    )}
                    {/* Empty cell if not first column group but has row headers */}
                    {hasRowHeaders && groupIdx > 0 && <div />}

                    {/* Row cells for this column group */}
                    {row
                      .slice(colGroup.startIdx, colGroup.endIdx)
                      .map((cell, colIdx) =>
                        cell ? (
                          <MatrixifyGridCell
                            key={cell.id}
                            cell={cell}
                            rowHeight={rowHeight}
                            datasource={datasource}
                            hooks={hooks}
                          />
                        ) : null,
                      )}
                    {/* Empty cells to maintain grid structure */}
                    {Array.from({ length: emptyColumns }).map((_, idx) => (
                      <div key={`empty-cell-${rowIdx}-${groupIdx}-${idx}`} />
                    ))}
                  </GridLayout>
                </GridGroup>
              );
            })}
          </div>
        ))}
      </GridScrollContainer>
    </GridContainer>
  );
}

export default MatrixifyGridRenderer;
