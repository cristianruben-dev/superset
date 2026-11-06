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
import { actionLabel, ASSISTANT_ACTION, DOCUMENT_ACTION } from './actionMark';

test('a call of the assistant names its model', () => {
  expect(actionLabel(ASSISTANT_ACTION, '{"model": "claude-sonnet-5-5"}')).toBe(
    'Done by the assistant (claude-sonnet-5-5)',
  );
});

test('a row without a readable model still says it was the assistant', () => {
  expect(actionLabel(ASSISTANT_ACTION, 'not json')).toBe('The assistant');
  expect(actionLabel(ASSISTANT_ACTION, null)).toBe('The assistant');
});

test('what a person did with a document names the model that wrote it', () => {
  expect(
    actionLabel(
      DOCUMENT_ACTION,
      '{"model": "claude-haiku-5-5", "action": "share"}',
    ),
  ).toBe('Shared a document · Made by the assistant (model claude-haiku-5-5)');
  expect(actionLabel(DOCUMENT_ACTION, '{"action": "export_pdf"}')).toContain(
    'Exported a document to PDF',
  );
});

test('every other action keeps its name', () => {
  expect(actionLabel('DashboardRestApi.put', '{"model": "x"}')).toBe(
    'DashboardRestApi.put',
  );
});
