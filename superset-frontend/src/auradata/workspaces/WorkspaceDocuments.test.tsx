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
import {
  fetchSharedDocuments,
  unshareArtifact,
} from 'src/auradata/assistant/client';
import { WorkspaceDocuments } from './WorkspaceDocuments';

jest.mock('src/auradata/assistant/client', () => ({
  fetchSharedDocuments: jest.fn(),
  unshareArtifact: jest.fn(),
}));

const listed = fetchSharedDocuments as jest.Mock;
const unshare = unshareArtifact as jest.Mock;

const DOCUMENT = {
  id: 'doc',
  title: 'Resumen',
  author: 'Ana',
  dashboard_id: 1,
  shared_on: '2026-11-06T10:00:00',
  opens: true,
};

const show = () =>
  render(
    <WorkspaceDocuments workspaceId={6} title={() => <h2>Compartidos</h2>} />,
    { useRedux: true },
  );

test('a document that opens is a link', async () => {
  listed.mockResolvedValue([DOCUMENT]);
  show();

  expect(await screen.findByRole('link', { name: 'Resumen' })).toHaveAttribute(
    'href',
    expect.stringContaining('/assistant/document/doc/'),
  );
  expect(
    screen.queryByTestId('auradata-workspace-document-stop'),
  ).not.toBeInTheDocument();
});

test('an author who lost the report gets no link and can stop sharing', async () => {
  listed.mockResolvedValue([{ ...DOCUMENT, opens: false }]);
  unshare.mockResolvedValue({});
  show();

  fireEvent.click(
    await screen.findByTestId('auradata-workspace-document-stop'),
  );

  await waitFor(() => expect(unshare).toHaveBeenCalledWith('doc'));
  await waitFor(() =>
    expect(screen.queryByText('Resumen')).not.toBeInTheDocument(),
  );
});
