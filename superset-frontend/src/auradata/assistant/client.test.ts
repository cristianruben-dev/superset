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
import { askAssistant, AssistantError } from './client';
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
