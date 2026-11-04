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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { act } from 'react-dom/test-utils';
import { SupersetClient } from '@superset-ui/core';
import { DataPane } from './DataPane';
import { selectVisual } from './selection';
import { setPaneCollapsed, usePaneCollapsed } from './panes';

const mockToggle = jest.fn();
let mockReady = false;
jest.mock('./ChartFieldsSections', () => ({
  useChartFieldToggle: () => ({
    ready: mockReady,
    uses: (field: { name: string }) => field.name === 'center',
    toggle: mockToggle,
  }),
}));

const datasources = {
  '1__table': {
    table_name: 'sales',
    columns: [{ column_name: 'region' }, { column_name: 'amount' }],
    metrics: [{ metric_name: 'total' }],
  },
  '2__table': {
    table_name: 'costs',
    columns: [{ column_name: 'center' }],
    metrics: [],
  },
};

function Pane() {
  const closed = usePaneCollapsed('data');
  return closed ? <span>closed</span> : <DataPane />;
}

const setup = () =>
  render(<Pane />, {
    useRedux: true,
    useDnd: true,
    useTheme: true,
    initialState: {
      datasources,
      dashboardInfo: { id: 9 },
      charts: { 3: { id: 3, form_data: { datasource: '2__table' } } },
      dashboardLayout: {
        past: [],
        present: { 'CHART-1': { meta: { chartId: 3 } } },
        future: [],
      },
    },
  });

afterEach(() => selectVisual(null));

const asked: string[] = [];

beforeEach(() => {
  setPaneCollapsed('data', false);
  asked.length = 0;
  jest.spyOn(SupersetClient, 'get').mockImplementation((({
    endpoint,
  }: {
    endpoint: string;
  }) => {
    asked.push(decodeURIComponent(endpoint));
    const result = endpoint.includes('?q=')
      ? [
          { id: 1, table_name: 'sales' },
          { id: 5, table_name: 'budget' },
        ]
      : {
          table_name: 'budget',
          columns: [{ column_name: 'year' }],
          metrics: [],
        };
    return Promise.resolve({ json: { result } });
  }) as never);
});

afterEach(() => jest.restoreAllMocks());

test('lists the tables of the report and opens them on demand', () => {
  setup();
  expect(screen.getByText('sales')).toBeInTheDocument();
  expect(screen.queryByText('region')).not.toBeInTheDocument();
  userEvent.click(screen.getByText('sales'));
  expect(screen.getByText('region')).toBeInTheDocument();
  expect(screen.getByText('total')).toBeInTheDocument();
});

test('searching opens the tables with a match and hides the others', async () => {
  setup();
  await userEvent.type(screen.getByLabelText('Search fields'), 'cent');
  expect(screen.getByText('center')).toBeInTheDocument();
  expect(screen.queryByText('sales')).not.toBeInTheDocument();
});

test('closes as a pane the ribbon can bring back', () => {
  setup();
  userEvent.click(screen.getByTestId('mibi-data-pane-close'));
  expect(screen.getByText('closed')).toBeInTheDocument();
});

test('only the table of the selected chart can be dragged', () => {
  setup();
  act(() => selectVisual('CHART-1'));
  expect(screen.getByText('center').closest('.dataset-fields')).not.toHaveClass(
    'other',
  );
  userEvent.click(screen.getByText('sales'));
  expect(screen.getByText('region').closest('.dataset-fields')).toHaveClass(
    'other',
  );
  expect(
    screen.getByText('The selected chart uses another table.'),
  ).toBeInTheDocument();
});

test('lists the other datasets the charts could use and loads them on demand', async () => {
  setup();
  expect(await screen.findByText('budget')).toBeInTheDocument();
  expect(asked[0]).toContain('opr:dataset_usable_in_dashboard,value:9');
  expect(screen.queryByText('year')).not.toBeInTheDocument();
  userEvent.click(screen.getByText('budget'));
  expect(await screen.findByText('year')).toBeInTheDocument();
  expect(asked[1]).toBe('/api/v1/dataset/5');
});

test('the selected chart gets a box per field to add or remove it', () => {
  mockReady = true;
  setup();
  act(() => selectVisual('CHART-1'));
  const center = screen.getByRole('checkbox', {
    name: 'Show center in the chart',
  });
  expect(center).toBeChecked();
  userEvent.click(center);
  expect(mockToggle).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'column', name: 'center' }),
    false,
  );
  // Fields of another table have no box
  userEvent.click(screen.getByText('sales'));
  expect(
    screen.queryByRole('checkbox', { name: 'Show region in the chart' }),
  ).not.toBeInTheDocument();
  mockReady = false;
});
