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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import {
  DEFAULT_GRID,
  GridGuide,
  gridBackground,
  readGrid,
} from './gridGuides';
import { GridSection } from './GridSection';

afterEach(() => window.localStorage.clear());

test('reads the stored grid and repairs bad values', () => {
  expect(readGrid()).toEqual(DEFAULT_GRID);
  window.localStorage.setItem(
    'mibi.grid',
    JSON.stringify({ show: false, style: 'waves', spacing: 1000, opacity: -4 }),
  );
  expect(readGrid()).toEqual({
    show: false,
    style: 'lines',
    square: true,
    spacing: 96,
    color: undefined,
    opacity: 5,
  });
  window.localStorage.setItem('mibi.grid', '{not json');
  expect(readGrid()).toEqual(DEFAULT_GRID);
});

test('keeps the older on/off preference', () => {
  window.localStorage.setItem('mibi.showGrid', 'false');
  expect(readGrid().show).toBe(false);
});

test('draws columns and rows, dots or column bands', () => {
  // Square cells by default: rows as tall as a column and its gap
  const lines = gridBackground(DEFAULT_GRID, 100, 16, '#5b5bd6');
  expect(lines.backgroundSize).toBe('116px 100%, 100% 116px');
  const free = gridBackground(
    { ...DEFAULT_GRID, square: false },
    100,
    16,
    '#5b5bd6',
  );
  expect(free.backgroundSize).toBe('116px 100%, 100% 32px');
  expect(String(lines.backgroundImage)).toContain('to bottom');

  const dots = gridBackground(
    { ...DEFAULT_GRID, style: 'dots', square: false, spacing: 24 },
    100,
    16,
    '#5b5bd6',
  );
  expect(String(dots.backgroundImage)).toContain('radial-gradient');
  expect(dots.backgroundSize).toBe('116px 24px');

  const columns = gridBackground(
    { ...DEFAULT_GRID, style: 'columns' },
    100,
    16,
    '#5b5bd6',
  );
  expect(String(columns.backgroundImage)).not.toContain('to bottom');
});

test('styles the grid from the Format pane and remembers it', () => {
  render(
    <>
      <GridSection />
      <GridGuide columnWidth={100} gutter={16} />
    </>,
    { useRedux: true },
  );
  const guide = screen.getByTestId('mibi-grid-guide');
  expect(guide.style.backgroundSize).toBe('116px 100%, 100% 116px');

  fireEvent.click(screen.getByRole('switch', { name: 'Square cells' }));
  expect(guide.style.backgroundSize).toBe('116px 100%, 100% 32px');

  fireEvent.click(screen.getByRole('radio', { name: 'Dots' }));
  expect(guide.style.backgroundSize).toBe('116px 32px');
  expect(JSON.parse(window.localStorage.getItem('mibi.grid')!).style).toBe(
    'dots',
  );

  fireEvent.click(screen.getByRole('switch', { name: 'Show grid' }));
  expect(screen.queryByTestId('mibi-grid-guide')).not.toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Dots' })).not.toBeInTheDocument();
});
