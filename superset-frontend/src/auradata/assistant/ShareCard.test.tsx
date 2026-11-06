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
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { fetchShareCard, shareArtifact, unshareArtifact } from './client';
import { ShareCard } from './ShareCard';
import type { Artifact, ShareCardData } from './types';

jest.mock('./client', () => ({
  ...jest.requireActual('./client'),
  fetchShareCard: jest.fn(),
  shareArtifact: jest.fn(),
  unshareArtifact: jest.fn(),
}));

const card = fetchShareCard as jest.Mock;
const share = shareArtifact as jest.Mock;
const unshare = unshareArtifact as jest.Mock;

const ARTIFACT: Artifact = {
  id: 'doc',
  title: 'Resumen',
  version: 3,
  conversation_id: 'c',
  dashboard_id: 9,
  blocks: [],
  sources: {},
  created_on: '2026-11-06T10:00:00',
  versions: [],
  share: null,
};

const CARD: ShareCardData = {
  version: 3,
  title: 'Resumen',
  workspace: 'Ventas',
  members: 4,
  draft: false,
  text_blocks: 1,
  numbers: 2,
  passages: ['Vendimos 1.000 en marzo.'],
  more_passages: 0,
  filters: [{ column: 'region', values: ['Norte'] }],
  datasets: [{ name: 'margen', for_every_member: false }],
  problem: null,
};

const open = (artifact: Artifact = ARTIFACT) => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  render(
    <ShareCard artifact={artifact} onChange={onChange} onClose={onClose} />,
    {
      useRedux: true,
    },
  );
  return { onChange, onClose };
};

beforeEach(() => {
  card.mockResolvedValue(CARD);
  share.mockResolvedValue({ ...ARTIFACT, share: {} });
  unshare.mockResolvedValue(ARTIFACT);
});

test('it warns plainly and lists what the text holds', async () => {
  open();

  expect(await screen.findByTestId('auradata-share-warning')).toHaveTextContent(
    'row level security does not reach it',
  );
  expect(screen.getByTestId('auradata-share-passages')).toHaveTextContent(
    'Vendimos 1.000 en marzo.',
  );
  expect(screen.getByText('Norte', { exact: false })).toBeInTheDocument();
  expect(screen.getByText(/may not reach margen/)).toBeInTheDocument();
});

test('it shares the version the card showed', async () => {
  const { onChange, onClose } = open();

  fireEvent.click(await screen.findByTestId('auradata-share-confirm'));

  await waitFor(() => expect(share).toHaveBeenCalledWith('doc', 3));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
});

test('a report that cannot be shared says why and offers nothing', async () => {
  card.mockResolvedValue({ ...CARD, problem: 'no_workspace' });
  open();

  expect(await screen.findByTestId('auradata-share-problem')).toHaveTextContent(
    'no workspace',
  );
  expect(
    screen.queryByTestId('auradata-share-confirm'),
  ).not.toBeInTheDocument();
});

test('a shared document can stop being shared', async () => {
  open({
    ...ARTIFACT,
    share: { version: 3, shared_on: '2026-11-06', workspace: 'Ventas' },
  });

  fireEvent.click(await screen.findByTestId('auradata-share-stop'));

  await waitFor(() => expect(unshare).toHaveBeenCalledWith('doc'));
  expect(
    screen.queryByTestId('auradata-share-confirm'),
  ).not.toBeInTheDocument();
});

test('a newer version offers to share it, and says readers stay on the old one', async () => {
  open({
    ...ARTIFACT,
    share: { version: 2, shared_on: '2026-11-06', workspace: 'Ventas' },
  });

  expect(await screen.findByText(/still see version 2/)).toBeInTheDocument();
  expect(screen.getByTestId('auradata-share-confirm')).toBeInTheDocument();
  expect(screen.getByTestId('auradata-share-warning')).toBeInTheDocument();
});
