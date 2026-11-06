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
import { isLongConversation, transcriptOf, withEvent } from './transcript';
import type {
  ChatMessage,
  Figure,
  StoredBlock,
  StoredConversation,
  StoredMessage,
} from './types';

const FIGURE = { dataset_name: 'ventas' } as Figure;

const answer = (changes: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'a',
  role: 'assistant',
  text: '',
  tools: [],
  ...changes,
});

let rowId = 0;
const row = (
  role: StoredMessage['role'],
  content: StoredBlock[],
  stop_reason: string | null = null,
): StoredMessage => {
  rowId += 1;
  return { id: `row-${rowId}`, role, content, stop_reason };
};

const stored = (
  messages: StoredMessage[],
  figures: Record<string, Figure> = {},
) => ({ messages, figures }) as StoredConversation;

const question = (text: string) =>
  row('user', [
    { type: 'text', text: '<page_context>{}</page_context>' },
    { type: 'text', text },
  ]);

test('a question shows without what the app added', () => {
  const [message] = transcriptOf(stored([question('¿Cuánto?')]));

  expect(message.role).toBe('user');
  expect(message.text).toBe('¿Cuánto?');
});

test('an answer joins its calls, tools and figure in one message', () => {
  const messages = transcriptOf(
    stored(
      [
        question('¿Cuánto?'),
        row('assistant', [
          { type: 'thinking' },
          { type: 'text', text: 'Miro' },
          { type: 'tool_use', id: 't1', name: 'query_dataset' },
        ]),
        row('user', [{ type: 'tool_result', tool_use_id: 't1' }]),
        row('assistant', [{ type: 'text', text: 'Fueron 10' }]),
      ],
      { t1: FIGURE },
    ),
  );

  expect(messages).toHaveLength(2);
  expect(messages[1].text).toBe('Miro\n\nFueron 10');
  expect(messages[1].tools.map(step => step.name)).toEqual(['query_dataset']);
  expect(messages[1].figure).toBe(FIGURE);
});

test('the last query of an answer gives its figure', () => {
  const other = { dataset_name: 'otro' } as Figure;

  const messages = transcriptOf(
    stored(
      [
        question('¿Cuánto?'),
        row('assistant', [
          { type: 'tool_use', id: 't1', name: 'query_dataset' },
        ]),
        row('user', [{ type: 'tool_result', tool_use_id: 't1' }]),
        row('assistant', [
          { type: 'tool_use', id: 't2', name: 'query_dataset' },
        ]),
        row('user', [{ type: 'tool_result', tool_use_id: 't2' }]),
      ],
      { t1: FIGURE, t2: other },
    ),
  );

  expect(messages[1].figure).toBe(other);
});

test('a tool that failed says so', () => {
  const messages = transcriptOf(
    stored([
      row('assistant', [{ type: 'tool_use', id: 't1', name: 'query_dataset' }]),
      row('user', [{ type: 'tool_result', tool_use_id: 't1', is_error: true }]),
    ]),
  );

  expect(messages[0].tools[0].failed).toBe(true);
});

test('a refused turn shows the notice, never what it wrote', () => {
  const messages = transcriptOf(
    stored([
      question('Algo'),
      row('assistant', [{ type: 'text', text: 'Parcial' }], 'refusal'),
    ]),
  );

  expect(messages[1].refused).toBe(true);
  expect(messages[1].text).toBe('');
  expect(messages[1].problem).toBeTruthy();
});

test('text after a tool starts a paragraph', () => {
  let message = withEvent(answer(), {
    event: 'text',
    data: { text: 'Miro' },
  });
  message = withEvent(message, {
    event: 'tool_start',
    data: { id: 't', name: 'query_dataset' },
  });
  expect(message.tools[0].running).toBe(true);
  message = withEvent(message, {
    event: 'tool_end',
    data: { id: 't', name: 'query_dataset', is_error: false, figure: FIGURE },
  });
  message = withEvent(message, { event: 'text', data: { text: 'Son' } });
  message = withEvent(message, { event: 'text', data: { text: ' 10' } });

  expect(message.text).toBe('Miro\n\nSon 10');
  expect(message.tools[0].running).toBe(false);
  expect(message.figure).toBe(FIGURE);
});

test('a refusal and an error become its notice', () => {
  expect(
    withEvent(answer(), { event: 'refusal', data: { message: 'No' } }),
  ).toMatchObject({ refused: true, problem: 'No' });
  expect(
    withEvent(answer(), {
      event: 'error',
      data: { code: 'failed', message: 'Falló' },
    }).problem,
  ).toBe('Falló');
});

test('a conversation is long near what the model can read', () => {
  expect(isLongConversation(790, 1000)).toBe(false);
  expect(isLongConversation(800, 1000)).toBe(true);
  expect(isLongConversation(170_000, null)).toBe(true);
});

test('a rejected call says so, live and when read later', () => {
  const answer = withEvent(
    withEvent(
      { id: 'a', role: 'assistant', text: '', tools: [] },
      { event: 'tool_start', data: { id: 't', name: 'delete_page' } },
    ),
    {
      event: 'tool_end',
      data: { id: 't', name: 'delete_page', is_error: true, rejected: true },
    },
  );
  const [stored] = transcriptOf({
    id: 'c',
    dashboard_id: 1,
    mode: 'edit',
    model: 'm',
    title: 't',
    changed_on: '',
    context_tokens: 0,
    figures: {},
    pending: [],
    can_undo: false,
    rejected: ['t'],
    messages: [
      {
        id: 'r',
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 't', name: 'delete_page' }],
      },
    ],
  });

  expect(answer.tools[0].rejected).toBe(true);
  expect(stored.tools[0].rejected).toBe(true);
});

test('an answer stopped in the middle says so when read later', () => {
  const [, stopped] = transcriptOf(
    stored([
      row('user', [{ type: 'text', text: 'Hola' }]),
      row('assistant', [], 'interrupted'),
    ]),
  );

  expect(stopped.stopped).toBe(true);
});

test('an answer that no longer fits says so, and no other failure does', () => {
  expect(
    withEvent(answer(), {
      event: 'error',
      data: { code: 'context_exceeded', message: 'Too long' },
    }),
  ).toMatchObject({ problem: 'Too long', contextExceeded: true });
  expect(
    withEvent(answer(), {
      event: 'error',
      data: { code: 'failed', message: 'Failed' },
    }),
  ).toMatchObject({ problem: 'Failed', contextExceeded: false });
});

test('an answer keeps the id of its first row and the vote stored on it', () => {
  const first = row('assistant', [{ type: 'text', text: 'Primero' }]);
  const second = row('assistant', [{ type: 'text', text: 'Segundo' }]);

  const [, shown] = transcriptOf({
    ...stored([question('¿Cuánto?'), first, second]),
    feedback: { [first.id]: { vote: 'down', reason: 'other' } },
  });

  expect(shown).toMatchObject({
    storedId: first.id,
    feedback: { vote: 'down', reason: 'other' },
  });
});
