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
    JSON.stringify({ show: false, style: 'dots', opacity: -4 }),
  );
  expect(readGrid()).toEqual({ color: undefined, opacity: 5 });
  window.localStorage.setItem('mibi.grid', '{not json');
  expect(readGrid()).toEqual(DEFAULT_GRID);
});

test('draws lines around square cells of 32 px', () => {
  const lines = gridBackground(DEFAULT_GRID, '#5b5bd6');
  expect(lines.backgroundSize).toBe('32px 32px');
  expect(String(lines.backgroundImage)).toContain('to right');
  expect(String(lines.backgroundImage)).toContain('to bottom');
});

test('styles the grid from the Format pane and remembers it', () => {
  render(
    <>
      <GridSection />
      <GridGuide />
    </>,
    { useRedux: true },
  );
  const guide = screen.getByTestId('mibi-grid-guide');
  expect(guide).toHaveStyle({ backgroundSize: '32px 32px' });

  fireEvent.click(screen.getByRole('button', { name: 'Reset grid' }));
  expect(JSON.parse(window.localStorage.getItem('mibi.grid')!).opacity).toBe(
    DEFAULT_GRID.opacity,
  );
  // The grid is always there: it has no switch
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
