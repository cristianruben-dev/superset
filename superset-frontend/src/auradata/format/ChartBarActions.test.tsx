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
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { registerActionSlot } from './actionSlots';
import { ChartBarActions } from './ChartBarActions';
import { captionLines } from './copyVisual';
import type { VisualFormat } from './types';

const renderActions = (
  props: Partial<Parameters<typeof ChartBarActions>[0]> = {},
) =>
  render(
    <ChartBarActions
      componentId="CHART-1"
      chartId={1}
      format={undefined}
      showFilters={false}
      onToggleFullSize={() => {}}
      {...props}
    />,
    { useRedux: true },
  );

test('copy and focus mode show by default, named for their tooltips', () => {
  renderActions();
  expect(
    screen.getByRole('button', { name: 'Copy as image with caption' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Focus mode' }),
  ).toBeInTheDocument();
});

test('the header icon switches of the Format pane leave them out', () => {
  renderActions({
    format: { header: { copy: false, focus: false } } as VisualFormat,
  });
  expect(screen.queryByTestId('auradata-header-copy')).not.toBeInTheDocument();
  expect(screen.queryByTestId('auradata-header-focus')).not.toBeInTheDocument();
});

test('focus mode toggles the full size chart, and Escape leaves it', async () => {
  const onToggleFullSize = jest.fn();
  const { rerender } = renderActions({ onToggleFullSize });
  await userEvent.click(screen.getByRole('button', { name: 'Focus mode' }));
  expect(onToggleFullSize).toHaveBeenCalledTimes(1);
  rerender(
    <ChartBarActions
      componentId="CHART-1"
      chartId={1}
      format={undefined}
      showFilters={false}
      isFullSize
      onToggleFullSize={onToggleFullSize}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Exit focus mode' }),
  ).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onToggleFullSize).toHaveBeenCalledTimes(2);
});

test('the buttons go to the floating bar of the object when it has one', () => {
  const slot = document.createElement('span');
  document.body.appendChild(slot);
  let release = () => {};
  act(() => {
    release = registerActionSlot('CHART-1', slot);
  });
  renderActions({ menu: <button type="button">menu</button> });
  expect(slot).toContainElement(
    screen.getByRole('button', { name: 'Focus mode' }),
  );
  expect(slot).toContainElement(screen.getByRole('button', { name: 'menu' }));
  act(() => release());
  slot.remove();
});

test('the caption names the report, the moment and the address', () => {
  const copiedAt = new Date(2026, 10, 15, 9, 30);
  expect(
    captionLines({ report: 'Ventas', copiedAt, link: 'https://bi/x' }),
  ).toEqual([
    'Report: Ventas',
    `Copied on ${copiedAt.toLocaleString()}`,
    'https://bi/x',
  ]);
  expect(captionLines({ copiedAt, link: 'https://bi/x' })).toHaveLength(2);
});

test('the export icon shows only when switched on for someone who may download', async () => {
  const exportXLSX = jest.fn();
  const exportCSV = jest.fn();
  const format = { header: { export: true } } as VisualFormat;
  const { rerender } = renderActions({
    format,
    canDownload: false,
    exportXLSX,
    exportCSV,
  });
  expect(
    screen.queryByTestId('auradata-header-export'),
  ).not.toBeInTheDocument();

  rerender(
    <ChartBarActions
      componentId="CHART-1"
      chartId={7}
      format={{ header: {} } as VisualFormat}
      showFilters={false}
      onToggleFullSize={() => {}}
      canDownload
      exportXLSX={exportXLSX}
      exportCSV={exportCSV}
    />,
  );
  expect(
    screen.queryByTestId('auradata-header-export'),
  ).not.toBeInTheDocument();

  rerender(
    <ChartBarActions
      componentId="CHART-1"
      chartId={7}
      format={format}
      showFilters={false}
      onToggleFullSize={() => {}}
      canDownload
      exportXLSX={exportXLSX}
      exportCSV={exportCSV}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Export data' }));
  await userEvent.click(await screen.findByText('Export to .CSV'));
  expect(exportCSV).toHaveBeenCalledWith(7);
  expect(exportXLSX).not.toHaveBeenCalled();
});
