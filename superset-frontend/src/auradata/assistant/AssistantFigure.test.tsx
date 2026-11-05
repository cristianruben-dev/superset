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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { AssistantFigure } from './AssistantFigure';
import type { Figure } from './types';

jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: jest.fn(),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ chartType }: { chartType: string }) => (
    <div data-test="super-chart">{chartType}</div>
  ),
}));

const request = requestChartDataResolved as jest.Mock;

const FIGURE: Figure = {
  dataset_id: 7,
  dataset_name: 'ventas',
  metrics: ['total'],
  columns: ['region'],
  filters: [{ col: 'pais', op: '==', val: 'MX' }],
  order_by: [],
  order_desc: true,
  rows: [
    { region: 'Norte', total: 1000 },
    { region: 'Sur', total: 4 },
  ],
  row_count: 2,
  from_dttm: null,
  to_dttm: null,
};

beforeEach(() => request.mockReset());

test('draws the chart through the chart data API and names its source', async () => {
  request.mockResolvedValue([{ data: [] }]);

  render(<AssistantFigure figure={FIGURE} dashboardId={3} />);

  expect(await screen.findByTestId('super-chart')).toHaveTextContent(
    'echarts_timeseries_bar',
  );
  const [params] = request.mock.calls[0];
  expect(params.formData.datasource).toBe('7__table');
  expect(params.requestParams.dashboard_id).toBe(3);
  expect(screen.getByText(/Dataset: ventas · pais == MX/)).toBeInTheDocument();
});

test('when the server refuses the chart the rows stay', async () => {
  request.mockRejectedValue(new Error('403'));

  render(<AssistantFigure figure={FIGURE} dashboardId={3} />);

  expect(
    await screen.findByText('The chart could not be drawn.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Norte')).toBeInTheDocument();
  expect(screen.queryByTestId('super-chart')).not.toBeInTheDocument();
});

test('a shape that reads better as a table asks nothing of the server', async () => {
  render(
    <AssistantFigure
      figure={{
        ...FIGURE,
        columns: ['region', 'pais'],
        rows: [{ region: 'Norte', pais: 'MX', total: 1 }],
        row_count: 120,
      }}
      dashboardId={3}
    />,
  );

  expect(screen.getByText('MX')).toBeInTheDocument();
  expect(screen.getByText('Showing 1 of 120 rows.')).toBeInTheDocument();
  await waitFor(() => expect(request).not.toHaveBeenCalled());
});
