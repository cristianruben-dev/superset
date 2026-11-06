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
import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import { useParams } from 'react-router-dom';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { fetchDocument } from './client';
import DocumentPage from './DocumentPage';
import type { ArtifactBlock, ArtifactDocument } from './types';

jest.unmock('react-markdown');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
}));

jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: jest.fn(),
}));

jest.mock('./client', () => ({
  ...jest.requireActual('./client'),
  fetchDocument: jest.fn(),
}));

const fetched = fetchDocument as jest.Mock;
const request = requestChartDataResolved as jest.Mock;

const TEXT: ArtifactBlock = {
  id: 'text',
  type: 'text',
  text: 'Las ventas fueron de 1.000.',
  written_on: '2026-11-06T10:00:00',
};
const FIGURE: ArtifactBlock = {
  id: 'figure',
  type: 'figure',
  label: 'Ventas',
  query: { dataset_id: 7, metrics: ['total'] },
};
const REFUSED: ArtifactBlock = { id: 'hidden', type: 'refused' };

const shared = (blocks: ArtifactBlock[]): ArtifactDocument => ({
  id: 'doc',
  title: 'Resumen',
  version: 2,
  dashboard_id: 9,
  blocks,
  sources: { 7: 'ventas' },
  created_on: '2026-11-06T10:00:00',
  model_name: 'Claude Sonnet 5.5',
  reader: true,
  author: 'Ana López',
  written_on: '2026-11-06T10:00:00',
  shared_on: '2026-11-06T11:00:00',
});

beforeEach(() => {
  (useParams as jest.Mock).mockReturnValue({ id: 'doc' });
  request.mockResolvedValue([{ data: [{ total: 42 }] }]);
  fetched.mockReset();
  request.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  window.history.replaceState({}, '', '/');
});

test('a reader sees the mark, who wrote the text and their own figures', async () => {
  fetched.mockResolvedValue(shared([TEXT, FIGURE]));

  render(<DocumentPage />, { useRedux: true });

  expect(await screen.findByText('Resumen')).toBeInTheDocument();
  expect(screen.getByTestId('auradata-document-mark')).toHaveTextContent(
    'Made by the assistant (model Claude Sonnet 5.5)',
  );
  expect(screen.getByTestId('auradata-document-reader-note')).toHaveTextContent(
    'Written by Ana López',
  );
  expect(
    await screen.findByTestId('auradata-artifact-value'),
  ).toHaveTextContent('42');
});

test('a block out of reach says so and shows nothing of itself', async () => {
  fetched.mockResolvedValue(shared([TEXT, REFUSED]));

  render(<DocumentPage />, { useRedux: true });

  expect(
    await screen.findByTestId('auradata-artifact-withheld'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('auradata-document-reader-note')).toHaveTextContent(
    '1 part is hidden from you.',
  );
  expect(request).not.toHaveBeenCalled();
});

test('its owner reads no note about the access of someone else', async () => {
  fetched.mockResolvedValue({
    ...shared([TEXT]),
    reader: false,
    author: null,
  });

  render(<DocumentPage />, { useRedux: true });

  await screen.findByText('Resumen');
  expect(
    screen.queryByTestId('auradata-document-reader-note'),
  ).not.toBeInTheDocument();
});

test('a document nobody shared with this person reads the same as none', async () => {
  fetched.mockRejectedValue({ status: 404 });

  render(<DocumentPage />, { useRedux: true });

  expect(
    await screen.findByTestId('auradata-document-missing'),
  ).toBeInTheDocument();
});

test('a capture is ready only after every figure has settled', async () => {
  window.history.replaceState({}, '', '/?standalone=3');
  let answer: (data: unknown) => void = () => {};
  request.mockReturnValue(
    new Promise(resolve => {
      answer = resolve;
    }),
  );
  fetched.mockResolvedValue(shared([FIGURE]));

  render(<DocumentPage />, { useRedux: true });

  const page = await screen.findByTestId('auradata-document');
  expect(page).not.toHaveClass('auradata-document-ready');
  await act(async () => {
    answer([{ data: [{ total: 42 }] }]);
  });
  await waitFor(() => expect(page).toHaveClass('auradata-document-ready'), {
    timeout: 3000,
  });
});
