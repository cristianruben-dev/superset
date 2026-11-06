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
  isLongConversation,
  stepsOf,
  transcriptOf,
  withEvent,
} from './transcript';
import type {
  AssistantEvent,
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
      data: { code: 'history_refused', message: 'Updated' },
    }),
  ).toMatchObject({ problem: 'Updated', contextExceeded: true });
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

const lines = (message: ChatMessage) =>
  stepsOf(message, name => name.toUpperCase()).map(item =>
    item.kind === 'note' ? item.note.text : `[${item.label}]`,
  );

const step = (id: string, name: string) => ({
  id,
  name,
  running: false,
  failed: false,
});

test('a note grows with its text and each block opens another', () => {
  const events = [
    { text: 'Miro', starts: true },
    { text: ' las ventas.', starts: false },
    { text: 'Ya las tengo.', starts: true },
  ];

  const result = events.reduce(
    (current, data) => withEvent(current, { event: 'note', data }),
    answer({ tools: [step('t1', 'leer')] }),
  );

  expect(result.notes).toEqual([
    { text: 'Miro las ventas.', after: 1 },
    { text: 'Ya las tengo.', after: 1 },
  ]);
});

test('a note stays before the tool it introduces', () => {
  const result = [
    { event: 'note', data: { text: 'Primero leo.', starts: true } },
    { event: 'tool_start', data: { id: 't1', name: 'leer' } },
    { event: 'tool_end', data: { id: 't1', name: 'leer', is_error: false } },
    { event: 'note', data: { text: 'Ahora consulto.', starts: true } },
    { event: 'tool_start', data: { id: 't2', name: 'consultar' } },
    { event: 'note', data: { text: 'Listo.', starts: true } },
  ].reduce(
    (current, event) => withEvent(current, event as AssistantEvent),
    answer(),
  );

  expect(lines(result)).toEqual([
    'Primero leo.',
    '[LEER]',
    'Ahora consulto.',
    '[CONSULTAR]',
    'Listo.',
  ]);
});

test('a tool used again shows once, where it last ran', () => {
  const message = answer({
    tools: [step('t1', 'leer'), step('t2', 'consultar'), step('t3', 'leer')],
    notes: [{ text: 'Vuelvo a leer.', after: 2 }],
  });

  expect(lines(message)).toEqual(['[CONSULTAR]', 'Vuelvo a leer.', '[LEER]']);
});

test('what the API writes when a response is cut never shows as a note', () => {
  const message = answer({
    notes: [
      {
        text: 'This part of the response was interrupted before it finished.',
        after: 0,
      },
      { text: '  ', after: 0 },
    ],
  });

  expect(lines(message)).toEqual([]);
});

test('read later, an answer shows what its stored blocks hold of the notes', () => {
  const [, read] = transcriptOf(
    stored([
      row('user', [{ type: 'text', text: 'Hola' }]),
      row('assistant', [
        { type: 'thinking', thinking: '' },
        { type: 'thinking', thinking: 'Miro las ventas.' },
        { type: 'tool_use', id: 't1', name: 'leer' },
      ]),
      row('user', [{ type: 'tool_result', tool_use_id: 't1' }]),
      row('assistant', [
        { type: 'thinking', thinking: 'Ya las tengo.' },
        { type: 'text', text: 'Cien' },
      ]),
    ]),
  );

  expect(lines(read)).toEqual(['Miro las ventas.', '[LEER]', 'Ya las tengo.']);
  expect(read.text).toBe('Cien');
});

test('a conversation whose blocks hold no text shows no notes', () => {
  const [, read] = transcriptOf(
    stored([
      row('user', [{ type: 'text', text: 'Hola' }]),
      row('assistant', [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: 'Cien' },
      ]),
    ]),
  );

  expect(read.notes).toBeUndefined();
});

test('a message keeps its images, also one that holds nothing else', () => {
  const [withText, alone] = transcriptOf({
    id: 'c1',
    figures: {},
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: [
          { type: 'auradata_attachment', id: 'i1' },
          { type: 'text', text: '<page_context>{}</page_context>' },
          { type: 'text', text: '¿Qué ves?' },
        ],
      },
      {
        id: 'm2',
        role: 'user',
        content: [
          { type: 'auradata_attachment', id: 'i2' },
          { type: 'auradata_attachment', id: 'i3' },
          { type: 'text', text: '<page_context>{}</page_context>' },
        ],
      },
    ],
  } as unknown as StoredConversation);

  expect(withText).toMatchObject({
    text: '¿Qué ves?',
    attachments: ['i1'],
  });
  expect(alone).toMatchObject({ text: '', attachments: ['i2', 'i3'] });
});

test('a turn that stopped without an ending says so where its answer went', () => {
  const row = (seq: number, role: 'user' | 'assistant', value: string) => ({
    id: `m${seq}`,
    seq,
    role,
    stop_reason: null,
    content: [{ type: 'text', text: value }],
  });
  const stored = {
    id: 'c1',
    messages: [row(0, 'user', 'Hola'), row(3, 'user', 'Sigue')],
    figures: {},
    interrupted: [1, 4],
  } as unknown as StoredConversation;

  const messages = transcriptOf(stored);

  expect(messages.map(item => item.role)).toEqual([
    'user',
    'assistant',
    'user',
    'assistant',
  ]);
  expect(messages[1].problem).toContain('stopped before finishing');
  expect(messages[3].problem).toContain('stopped before finishing');
  expect(messages[3].storedId).toBeUndefined();
});

test('an answer knows the document it wrote, stored or streaming', () => {
  const artifact = { id: 'doc', title: 'Resumen', version: 2 };
  const conversation = {
    ...stored([row('assistant', [{ type: 'tool_use', id: 't', name: 'x' }])]),
    artifact_calls: { t: artifact },
  };

  expect(transcriptOf(conversation)[0].artifact).toBe(artifact);
  expect(
    withEvent(
      { id: 'x', role: 'assistant', text: '', tools: [] },
      {
        event: 'tool_end',
        data: { id: 't', name: 'create_artifact', is_error: false, artifact },
      },
    ).artifact,
  ).toBe(artifact);
});
