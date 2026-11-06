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
import { act, useState } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { ArtifactPanel } from './ArtifactPanel';
import { fetchArtifact, restoreArtifact } from './client';
import type { Artifact, ArtifactBlock } from './types';

jest.unmock('react-markdown');

jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: jest.fn(),
}));

jest.mock('./client', () => ({
  ...jest.requireActual('./client'),
  fetchArtifact: jest.fn(),
  restoreArtifact: jest.fn(),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ chartType }: { chartType: string }) => (
    <div data-test="super-chart">{chartType}</div>
  ),
}));

const fetched = fetchArtifact as jest.Mock;
const restored = restoreArtifact as jest.Mock;
const request = requestChartDataResolved as jest.Mock;

const QUERY = { dataset_id: 7, metrics: ['total'], columns: ['region'] };
const TEXT: ArtifactBlock = {
  id: 'text',
  type: 'text',
  text: 'Las **ventas** subieron.',
  written_on: '2026-11-06T10:00:00',
};
const FIGURE: ArtifactBlock = {
  id: 'figure',
  type: 'figure',
  label: 'Ventas totales',
  query: { dataset_id: 7, metrics: ['total'] },
};
const CHART: ArtifactBlock = {
  id: 'chart',
  type: 'chart',
  title: 'Por región',
  chart: 'bar',
  query: QUERY,
};
const TABLE: ArtifactBlock = {
  id: 'table',
  type: 'table',
  title: 'Detalle',
  query: QUERY,
};

const document_ = (fields: Partial<Artifact> = {}): Artifact => ({
  id: 'doc',
  title: 'Resumen ejecutivo',
  version: 2,
  conversation_id: 'c',
  dashboard_id: 3,
  blocks: [TEXT, FIGURE, CHART, TABLE],
  sources: { 7: 'ventas' },
  created_on: '2026-11-06T10:00:00',
  versions: [
    {
      number: 1,
      title: 'Resumen',
      origin: 'created',
      restored_from: null,
      created_on: '2026-11-06T09:00:00',
    },
    {
      number: 2,
      title: 'Resumen ejecutivo',
      origin: 'changed',
      restored_from: null,
      created_on: '2026-11-06T10:00:00',
    },
  ],
  ...fields,
});

function Harness({
  onRefresh = () => {},
  liveVersion,
  canAsk = true,
}: {
  onRefresh?: () => void;
  liveVersion?: number;
  canAsk?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ArtifactPanel
      artifactId="doc"
      liveVersion={liveVersion}
      anchor={null}
      dashboardId={3}
      busy={false}
      canAsk={canAsk}
      selected={selected}
      onSelect={setSelected}
      onRefresh={onRefresh}
      onClose={() => {}}
    />
  );
}

const show = (props = {}) =>
  render(<Harness {...props} />, { useRedux: true, useRouter: true });

beforeEach(() => {
  jest.resetAllMocks();
  fetched.mockResolvedValue(document_());
  request.mockResolvedValue([{ data: [{ total: 1500 }] }]);
  global.ResizeObserver = class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

test('shows the document with numbers read through the chart data API', async () => {
  show();

  expect(await screen.findByText('Resumen ejecutivo')).toBeInTheDocument();
  expect(
    await screen.findByTestId('auradata-artifact-value'),
  ).toHaveTextContent('1,500');
  expect(await screen.findByTestId('super-chart')).toBeInTheDocument();
  expect(screen.getByText('Detalle')).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[0][0].requestParams.dashboard_id).toBe(3);
  expect(screen.getAllByText(/ventas · /i).length).toBe(3);
});

test('a block the API refuses says so and the rest stay', async () => {
  request.mockImplementation(({ formData }) =>
    formData.viz_type === 'table' && formData.groupby?.length === 0
      ? Promise.reject(Object.assign(new Error(), { status: 403 }))
      : Promise.resolve([{ data: [{ region: 'Norte', total: 1 }] }]),
  );
  show();

  expect(
    await screen.findByText('You do not have access to this data.'),
  ).toBeInTheDocument();
  expect(await screen.findByTestId('super-chart')).toBeInTheDocument();
});

test('a dataset out of reach is refused without asking', async () => {
  fetched.mockResolvedValue(document_({ sources: {}, blocks: [FIGURE] }));
  show();

  expect(
    await screen.findByTestId('auradata-artifact-refused'),
  ).toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByText(/ventas · /i)).not.toBeInTheDocument();
});

test('a block that failed offers to try again', async () => {
  request.mockRejectedValueOnce(Object.assign(new Error(), { status: 500 }));
  fetched.mockResolvedValue(document_({ blocks: [FIGURE] }));
  show();

  fireEvent.click(await screen.findByText('Try again'));

  expect(
    await screen.findByTestId('auradata-artifact-value'),
  ).toBeInTheDocument();
});

test('text from the model stays inert', async () => {
  fetched.mockResolvedValue(
    document_({
      blocks: [
        {
          ...TEXT,
          text: '<img src=x onerror=alert(1)> ![a](https://otro.example/x.png) [b](https://otro.example/?d=1)',
        },
      ],
    }),
  );
  const { baseElement } = show();

  await screen.findByTestId('auradata-artifact-block');
  await waitFor(() =>
    expect(
      baseElement.querySelector('[data-test="auradata-artifact-block"] p'),
    ).toBeTruthy(),
  );
  expect(baseElement.querySelector('img')).not.toBeInTheDocument();
  expect(
    baseElement.querySelector('a[href*="otro.example"]'),
  ).not.toBeInTheDocument();
});

test('selecting a block marks it and a second click clears it', async () => {
  show();

  const [first] = await screen.findAllByTestId('auradata-artifact-pick');
  fireEvent.click(first);
  expect(first).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(first);
  expect(first).toHaveAttribute('aria-pressed', 'false');
});

test('the date of the text shows and refreshing it is a message', async () => {
  const onRefresh = jest.fn();
  show({ onRefresh });

  expect(
    await screen.findByTestId('auradata-artifact-written'),
  ).toHaveTextContent(/Text written on/);
  fireEvent.click(screen.getByTestId('auradata-artifact-refresh'));

  expect(onRefresh).toHaveBeenCalled();
});

test('a new version of the answer shows by itself', async () => {
  const { rerender } = render(<Harness liveVersion={2} />, {
    useRedux: true,
    useRouter: true,
  });
  await screen.findByText('Resumen ejecutivo');
  fetched.mockResolvedValue(document_({ title: 'Otro título', version: 3 }));

  await act(async () => {
    rerender(<Harness liveVersion={3} />);
  });

  expect(await screen.findByText('Otro título')).toBeInTheDocument();
});

test('an earlier version reads alone and going back adds a new one', async () => {
  show();
  await screen.findByText('Resumen ejecutivo');
  fetched.mockResolvedValue(document_({ title: 'Resumen', version: 1 }));
  fireEvent.click(screen.getByTestId('auradata-artifact-history'));
  const versions = screen.getAllByTestId('auradata-artifact-version');
  expect(versions).toHaveLength(2);

  fireEvent.click(versions[1]);

  expect(
    await screen.findByTestId('auradata-artifact-old'),
  ).toBeInTheDocument();
  expect(fetched).toHaveBeenLastCalledWith('doc', 1);
  expect(
    screen.queryByTestId('auradata-artifact-pick'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('auradata-artifact-refresh'),
  ).not.toBeInTheDocument();

  restored.mockResolvedValue(document_({ title: 'Resumen', version: 3 }));
  fireEvent.click(screen.getByTestId('auradata-artifact-restore'));

  await waitFor(() => expect(restored).toHaveBeenCalledWith('doc', 1));
  await waitFor(() =>
    expect(
      screen.queryByTestId('auradata-artifact-old'),
    ).not.toBeInTheDocument(),
  );
});

test('a document that cannot be opened says so', async () => {
  fetched.mockRejectedValue(new Error('404'));
  show();

  expect(
    await screen.findByTestId('auradata-artifact-problem'),
  ).toBeInTheDocument();
});
