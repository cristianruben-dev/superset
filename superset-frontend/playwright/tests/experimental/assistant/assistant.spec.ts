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
  DATASET,
  expect,
  lastMessageOf,
  openPanel,
  say,
  test,
} from './fakeAnthropic';

/**
 * The panel of each mode. Anthropic is simulated and the rest is real: see
 * `fakeAnthropic.ts`, and `docs/auradata/asistente/evaluacion.md` for how to run these.
 */

test('read mode answers with a figure and offers no way to change anything', async ({
  page,
  anthropic,
}) => {
  anthropic.script(
    call('query_dataset', {
      dataset_id: DATASET,
      metrics: ['count'],
      columns: ['region'],
    }),
    say('La región Sur tiene **36** registros.'),
  );

  await openPanel(page);
  await ask(page, '¿Cuántos registros?');

  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    '36',
  );
  await expect(page.getByTestId('auradata-assistant-step')).toHaveCount(1);
  await expect(page.getByTestId('auradata-assistant-figure')).toContainText(
    'qa_referencia',
  );
  expect(JSON.stringify(lastMessageOf(anthropic.requests[0]))).toContain(
    `dashboard_id`,
  );
  expect(anthropic.requests[0].model).toBeTruthy();
  await expect(page.getByTestId('auradata-assistant-confirmation')).toHaveCount(
    0,
  );
  await expect(page.getByTestId('auradata-assistant-undo')).toHaveCount(0);
});

test('edit mode waits for the card, runs on approval and can be undone', async ({
  page,
  anthropic,
  dashboards,
}) => {
  const copy = await copyReport(page, 'Evaluación Playwright edición');
  dashboards.push(copy);
  anthropic.script(
    call('add_page', { dashboard: copy, name: 'Se queda' }),
    call('add_page', { dashboard: copy, name: 'Se va' }),
    call('delete_page', { dashboard: copy, page: 'Se va' }),
    say('Listo, la borré.'),
  );

  await page.goto(`dashboard/${copy}/`);
  await page.getByTestId('edit-dashboard-button').click();
  await page.getByRole('tab', { name: /Asistente|Assistant/ }).click();
  await ask(page, 'Prueba una página y bórrala');

  const card = page.getByTestId('auradata-assistant-confirmation');
  await expect(card).toBeVisible();
  expect(anthropic.requests).toHaveLength(3);

  await page.getByTestId('auradata-assistant-approve').click();

  await expect(
    page.getByTestId('auradata-assistant-answer').last(),
  ).toContainText('Listo, la borré.');
  await expect(card).toHaveCount(0);

  await expect(page.getByRole('tab', { name: 'Se queda' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Se va' })).toHaveCount(0);

  await page.getByTestId('auradata-assistant-undo').click();
  await expect(page.getByTestId('auradata-assistant-undo')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Se queda' })).toHaveCount(0);
});
