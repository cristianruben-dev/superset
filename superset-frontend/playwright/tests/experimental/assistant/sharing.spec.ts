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

import { apiGet, apiPost, apiPut } from '../../../helpers/api/requests';
import {
  ask,
  call,
  expect,
  openPanel,
  panelAfterReload,
  say,
  test,
} from './fakeAnthropic';

test('a document is shared with its workspace and stops being shared', async ({
  page,
  anthropic,
  dashboards,
  workspaces,
}) => {
  const suffix = Date.now();
  const created = await apiPost(page, 'api/v1/workspace/', {
    name: `Evaluación Playwright ${suffix}`,
  });
  const workspace = (await created.json()).result.id;
  workspaces.push(workspace);
  const report = await apiPost(page, 'api/v1/dashboard/', {
    dashboard_title: `Evaluación Playwright compartir ${suffix}`,
    published: true,
  });
  const dashboard = (await report.json()).id;
  await apiPut(page, `api/v1/workspace/${workspace}/dashboards/`, {
    add: [dashboard],
  });
  dashboards.push(dashboard);
  anthropic.script(
    call('create_artifact', {
      title: 'Nota para el equipo',
      blocks: [{ type: 'text', text: 'Las ventas fueron de 1,234 en Norte.' }],
    }),
    say('Listo.'),
  );

  await openPanel(page, dashboard);
  await ask(page, 'Escribe una nota');
  await expect(page.getByTestId('auradata-artifact-panel')).toBeVisible();

  const opened = page.waitForRequest(/artifacts\/[0-9a-f-]+\/share\//);
  await page.getByTestId('auradata-artifact-share').click();
  const id = /artifacts\/([0-9a-f-]+)\//.exec((await opened).url())?.[1];
  await expect(page.getByTestId('auradata-share-card')).toBeVisible();
  await expect(page.getByTestId('auradata-share-passages')).toContainText(
    '1,234',
  );
  await page.getByTestId('auradata-share-confirm').click();
  await expect(page.getByTestId('auradata-share-card')).toHaveCount(0);
  const shared = await apiGet(
    page,
    `api/v1/auradata/assistant/documents/?workspace_id=${workspace}`,
  );
  expect((await shared.json()).result).toHaveLength(1);

  await page.goto(`assistant/document/${id}/`);
  await expect(page.getByTestId('auradata-document')).toContainText(
    'Nota para el equipo',
  );

  await page.goBack();
  await panelAfterReload(page);
  await page.getByTestId('auradata-artifact-share').click();
  await page.getByTestId('auradata-share-stop').click();
  await expect(page.getByTestId('auradata-share-card')).toHaveCount(0);

  const listed = await apiGet(
    page,
    `api/v1/auradata/assistant/documents/?workspace_id=${workspace}`,
  );
  expect((await listed.json()).result).toEqual([]);
});
