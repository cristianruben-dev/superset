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
  ask,
  call,
  copyReport,
  expect,
  lastMessageOf,
  openPanel,
  salesQuery,
  say,
  test,
} from './fakeAnthropic';

const summary = () =>
  call('create_artifact', {
    title: 'Resumen de ventas',
    blocks: [
      { type: 'text', text: '## Resumen\n\nLas ventas de 2025.' },
      { type: 'figure', label: 'Ventas', query: salesQuery() },
      {
        type: 'chart',
        title: 'Ventas por región',
        chart: 'bar',
        query: salesQuery(['region']),
      },
      {
        type: 'table',
        title: 'Por producto',
        query: salesQuery(['producto']),
      },
    ],
  });

/** What the tool answered when the document was written. */
const writtenIn = (request: Record<string, unknown>) => {
  const text = JSON.stringify(request.messages);
  const [, id] = /artifact_id\\+":\s*\\+"([0-9a-f-]{36})/.exec(text) ?? [];
  return id;
};

test('a document opens beside the chat, reads its figures and takes a change', async ({
  page,
  anthropic,
}) => {
  anthropic.script(
    summary(),
    say('Te dejé el resumen al lado.'),
    request => {
      const context = JSON.stringify(lastMessageOf(request));
      const [, block] = /selected_block.*?id\\*":\s*\\*"([0-9a-f]{8})/.exec(
        context,
      ) ?? [undefined, ''];
      return call('change_artifact', {
        artifact_id: writtenIn(request),
        version: 1,
        changes: [
          {
            action: 'replace',
            block_id: block,
            block: {
              type: 'chart',
              title: 'Ventas por región',
              chart: 'line',
              query: salesQuery(['region']),
            },
          },
        ],
      });
    },
    say('Cambié el gráfico a líneas.'),
  );

  await openPanel(page);
  await ask(page, 'Hazme un resumen');

  const document = page.getByTestId('auradata-artifact-panel');
  await expect(document).toBeVisible();
  await expect(document).toContainText('Resumen de ventas');
  await expect(page.getByTestId('auradata-artifact-value')).toContainText(
    /41[.,\s]?328|41\.3k/i,
  );
  await expect(page.getByTestId('auradata-artifact-refused')).toHaveCount(0);

  await page.getByTestId('auradata-artifact-pick').nth(2).click();
  await expect(page.getByTestId('auradata-assistant-aimed')).toBeVisible();
  await ask(page, 'Cambia este gráfico a líneas');
  await expect(
    page.getByTestId('auradata-assistant-answer').last(),
  ).toContainText('líneas');

  await page.getByTestId('auradata-artifact-history').click();
  await expect(page.getByTestId('auradata-artifact-version')).toHaveCount(2);

  await page.getByTestId('auradata-artifact-version').last().click();
  await expect(page.getByTestId('auradata-artifact-old')).toBeVisible();
  await page.getByTestId('auradata-artifact-restore').click();
  await expect(page.getByTestId('auradata-artifact-version')).toHaveCount(3);
});

test('a document exports to PDF', async ({ page, anthropic }) => {
  test.setTimeout(120000);
  anthropic.script(summary(), say('Listo.'));
  await openPanel(page);
  await ask(page, 'Hazme un resumen');
  await expect(page.getByTestId('auradata-artifact-value')).toBeVisible();

  const download = page.waitForEvent('download', { timeout: 100000 });
  await page.getByTestId('auradata-artifact-export').click();

  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});

test('a document becomes a page of the report, and that can be undone', async ({
  page,
  anthropic,
  dashboards,
}) => {
  test.setTimeout(60000);
  const copy = await copyReport(page, 'Evaluación Playwright documento');
  dashboards.push(copy);
  anthropic.script(
    summary(),
    say('Listo.'),
    request =>
      call('save_artifact_as_page', {
        artifact_id: writtenIn(request),
        version: 1,
      }),
    say('Guardada.'),
  );

  await page.goto(`dashboard/${copy}/`);
  await page.getByTestId('edit-dashboard-button').click();
  await page.getByRole('tab', { name: /Asistente|Assistant/ }).click();
  await ask(page, 'Hazme un resumen');
  await expect(page.getByTestId('auradata-artifact-panel')).toBeVisible();

  await page.getByTestId('auradata-artifact-save-page').click();
  await page.getByTestId('auradata-assistant-approve').click();
  await expect(
    page.getByTestId('auradata-assistant-answer').last(),
  ).toContainText('Guardada.');
  // Whatever does not fit in a page goes on to the next
  await expect(
    page.getByRole('tab', { name: /Resumen de ventas/ }).first(),
  ).toBeVisible();

  await page.getByTestId('auradata-assistant-undo').click();
  await expect(
    page.getByRole('tab', { name: /Resumen de ventas/ }),
  ).toHaveCount(0);
});
