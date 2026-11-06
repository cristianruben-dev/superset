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

import { ask, expect, openPanel, say, test } from './fakeAnthropic';

test('a conversation near the limit warns, and one over it offers a new one', async ({
  page,
  anthropic,
}) => {
  anthropic.script(
    { ...say('Sigo aquí.'), cached_tokens: 900000 },
    { ...say(''), too_long: true },
    say('Empezamos de nuevo.'),
  );
  await openPanel(page);

  await ask(page, 'Primera pregunta');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'Sigo aquí.',
  );
  await expect(page.getByTestId('auradata-assistant-long')).toBeVisible();

  await ask(page, 'Segunda pregunta');
  const offer = page.getByTestId('auradata-assistant-context-new');
  await expect(offer).toBeVisible();

  await offer.click();
  await expect(page.getByTestId('auradata-assistant-answer')).toHaveCount(0);
  await expect(page.getByTestId('auradata-assistant-long')).toHaveCount(0);
  await ask(page, 'Tercera pregunta');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'Empezamos de nuevo.',
  );
});
