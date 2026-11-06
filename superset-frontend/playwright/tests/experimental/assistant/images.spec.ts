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

import { resolve } from 'node:path';
import {
  ask,
  expect,
  lastMessageOf,
  openPanel,
  say,
  test,
} from './fakeAnthropic';

const CAPTURE = resolve(
  __dirname,
  '../../../../../tests/assistant_eval/images/captura-ventas.jpg',
);

test('an image goes with its message, stays in it and travels again', async ({
  page,
  anthropic,
}) => {
  anthropic.script(say('Veo tres tarjetas.'), say('Y una tabla abajo.'));
  await openPanel(page);

  await page.getByTestId('auradata-assistant-file').setInputFiles(CAPTURE);
  await expect(page.getByTestId('auradata-assistant-image')).toHaveCount(1);
  await ask(page, '¿Qué ves?');

  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'tres tarjetas',
  );
  await expect(
    page.getByTestId('auradata-assistant-sent-images'),
  ).toBeVisible();
  await expect(page.getByTestId('auradata-assistant-image')).toHaveCount(0);
  const kinds = lastMessageOf(anthropic.requests[0]).map(block => block.type);
  expect(kinds).toContain('image');

  await ask(page, '¿Y abajo?');
  await expect(
    page.getByTestId('auradata-assistant-answer').last(),
  ).toContainText('tabla');
  expect(JSON.stringify(anthropic.requests[1].messages)).toContain(
    '"type":"image"',
  );
});

test('a file that is not an image is refused', async ({ page }) => {
  await openPanel(page);
  await page.getByTestId('auradata-assistant-file').setInputFiles({
    name: 'nota.png',
    mimeType: 'image/png',
    buffer: Buffer.from('this is not a picture'),
  });
  await expect(page.getByText(/PNG, JPEG/).first()).toBeVisible();
  await expect(page.getByTestId('auradata-assistant-image')).toHaveCount(0);
});
