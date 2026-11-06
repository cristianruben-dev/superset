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
import { SupersetClient } from '@superset-ui/core';
import {
  askAssistant,
  AssistantError,
  clearFeedback,
  decideCall,
  deleteConversation,
  renameConversation,
  saveFeedback,
  undoTurn,
} from './client';
import type { AssistantEvent } from './types';

const QUESTION = {
  message: 'Hola',
  conversation_id: null,
  model: 'claude-sonnet-5-5',
  mode: 'read' as const,
  context: { dashboard_id: 1 },
};

const encoder = new TextEncoder();

/** A response whose body gives these chunks, as `fetch` does. */
const stream = (...chunks: string[]) => {
  const left = chunks.map(chunk => encoder.encode(chunk));
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () =>
          left.length
            ? { done: false, value: left.shift() }
            : { done: true, value: undefined },
      }),
    },
  };
};

const refused = (status: number, body: unknown) => ({
  ok: false,
  status,
  body: null,
  json: async () => body,
});

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  jest.spyOn(SupersetClient, 'getCSRFToken').mockResolvedValue('the-token');
  jest
    .spyOn(SupersetClient, 'getUrl')
    .mockImplementation(request => `http://app${request?.endpoint}`);
  jest.spyOn(SupersetClient, 'reAuthenticate').mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

const ask = async () => {
  const events: AssistantEvent[] = [];
  const signal = new AbortController().signal;
  await askAssistant(QUESTION, event => events.push(event), signal);
  return events;
};

test('posts with the token and the session, and passes events on as they come', async () => {
  fetchMock.mockResolvedValue(
    stream(
      'event: text\ndata: {"text":"Ho',
      'la"}\n\n: keep-alive\n\n',
      'event: done\ndata: {"context_tokens":5,"model":"m"}\n\n',
    ),
  );

  const events = await ask();

  expect(events).toEqual([
    { event: 'text', data: { text: 'Hola' } },
    { event: 'done', data: { context_tokens: 5, model: 'm' } },
  ]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://app/api/v1/auradata/assistant/');
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('same-origin');
  expect(init.headers['X-CSRFToken']).toBe('the-token');
  expect(JSON.parse(init.body)).toEqual(QUESTION);
});

test('a stream that ends without its answer is an error', async () => {
  fetchMock.mockResolvedValue(stream('event: text\ndata: {"text":"Ho"}\n\n'));

  await expect(ask()).rejects.toThrow(AssistantError);
});

test('an error of the service ends the stream without a done', async () => {
  fetchMock.mockResolvedValue(
    stream('event: error\ndata: {"code":"failed","message":"Falló"}\n\n'),
  );

  const events = await ask();

  expect(events).toEqual([
    { event: 'error', data: { code: 'failed', message: 'Falló' } },
  ]);
});

test('a refused message says why', async () => {
  fetchMock.mockResolvedValue(refused(409, { message: 'Ocupada' }));

  await expect(ask()).rejects.toThrow('Ocupada');
});

test('a stale token gets one new try', async () => {
  fetchMock
    .mockResolvedValueOnce(refused(400, { message: 'CSRF' }))
    .mockResolvedValueOnce(stream('event: done\ndata: {}\n\n'));

  await ask();

  expect(SupersetClient.reAuthenticate).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('a refusal without a body has a message of its own', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 500,
    body: null,
    json: async () => {
      throw new Error('not json');
    },
  });

  await expect(ask()).rejects.toThrow('The assistant could not answer');
});

test('a decision names the call and goes to its conversation', async () => {
  fetchMock.mockResolvedValue(
    stream('event: done\ndata: {"context_tokens": 1}\n\n'),
  );
  const events: unknown[] = [];

  await decideCall(
    'c1',
    { tool_use_id: 'toolu_1', approved: true, model: 'm' },
    event => events.push(event),
    new AbortController().signal,
  );

  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain('/conversations/c1/decide/');
  expect(JSON.parse(init.body)).toEqual({
    tool_use_id: 'toolu_1',
    approved: true,
    model: 'm',
  });
  expect(events).toHaveLength(1);
});

test('a vote goes to the answer, and taking it back too', async () => {
  const put = jest.spyOn(SupersetClient, 'put').mockResolvedValue({} as never);
  const remove = jest
    .spyOn(SupersetClient, 'delete')
    .mockResolvedValue({} as never);
  const url = '/api/v1/auradata/assistant/conversations/c/messages/m/feedback/';

  await saveFeedback('c', 'm', { vote: 'down', reason: 'other' });
  await clearFeedback('c', 'm');

  expect(put).toHaveBeenCalledWith({
    endpoint: url,
    jsonPayload: { vote: 'down', reason: 'other' },
  });
  expect(remove).toHaveBeenCalledWith({ endpoint: url });
});

test('a rename sends the title, and a delete only the conversation', async () => {
  const put = jest
    .spyOn(SupersetClient, 'put')
    .mockResolvedValue({ json: { result: { id: 'c' } } } as never);
  const remove = jest
    .spyOn(SupersetClient, 'delete')
    .mockResolvedValue({} as never);
  const url = '/api/v1/auradata/assistant/conversations/c/';

  await renameConversation('c', 'Marzo');
  await deleteConversation('c');

  expect(put).toHaveBeenCalledWith({
    endpoint: url,
    jsonPayload: { title: 'Marzo' },
  });
  expect(remove).toHaveBeenCalledWith({ endpoint: url });
});

test('a refused delete brings the reason of the server', async () => {
  jest.spyOn(SupersetClient, 'delete').mockRejectedValue(
    new Response(JSON.stringify({ message: 'Está respondiendo' }), {
      status: 409,
    }),
  );

  await expect(deleteConversation('c')).rejects.toThrow('Está respondiendo');
});

test('a refused undo brings the reason of the server', async () => {
  jest.spyOn(SupersetClient, 'post').mockRejectedValue(
    new Response(JSON.stringify({ message: 'Cambió después' }), {
      status: 409,
    }),
  );

  await expect(undoTurn('c1')).rejects.toThrow('Cambió después');
});
