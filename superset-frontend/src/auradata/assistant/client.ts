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
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { sseParser } from './sse';
import type {
  AssistantContext,
  AssistantEvent,
  AssistantModels,
  ChatMode,
  Conversation,
  StoredConversation,
  UndoResult,
} from './types';

const CHAT_URL = '/api/v1/auradata/assistant/';

export const fetchModels = (): Promise<AssistantModels> =>
  SupersetClient.get({ endpoint: `${CHAT_URL}models/` }).then(
    ({ json }) => json.result,
  );

export const fetchConversations = (
  dashboardId: number,
): Promise<Conversation[]> =>
  SupersetClient.get({
    endpoint: `${CHAT_URL}conversations/?dashboard_id=${dashboardId}`,
  }).then(({ json }) => json.result);

export const fetchConversation = (id: string): Promise<StoredConversation> =>
  SupersetClient.get({ endpoint: `${CHAT_URL}conversations/${id}/` }).then(
    ({ json }) => json.result,
  );

/** A question for the assistant. */
export interface AssistantQuestion {
  message: string;
  conversation_id: string | null;
  model: string;
  mode: ChatMode;
  context: AssistantContext;
}

/** An answer to the card of a call. The call itself stays as the server stored it. */
export interface AssistantDecision {
  tool_use_id: string;
  approved: boolean;
  model: string;
}

/** The server refused the message, or the stream ended before its answer. */
export class AssistantError extends Error {}

async function post(
  endpoint: string,
  body: AssistantQuestion | AssistantDecision,
  signal: AbortSignal,
): Promise<Response> {
  const token = await SupersetClient.getCSRFToken();
  return fetch(SupersetClient.getUrl({ endpoint }), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      'X-CSRFToken': token ?? '',
    },
    body: JSON.stringify(body),
    signal,
  });
}

/** The message of a refused request, which comes back as JSON. */
async function refusalOf(response: Response): Promise<string> {
  const fallback = t('The assistant could not answer. Try again.');
  try {
    const { message } = await response.json();
    return typeof message === 'string' ? message : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Sends a request and hands over each event as it arrives. `SupersetClient` waits
 * for whole responses, so this reads the body of a `fetch` with the same token. A
 * token that went stale gets one new try. It rejects when the answer never came.
 */
async function streamAnswer(
  endpoint: string,
  body: AssistantQuestion | AssistantDecision,
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let response = await post(endpoint, body, signal);
  if (response.status === 400) {
    await SupersetClient.reAuthenticate();
    response = await post(endpoint, body, signal);
  }
  if (!response.ok || !response.body) {
    throw new AssistantError(await refusalOf(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parse = sseParser();
  let finished = false;
  const emit = (text: string) =>
    parse(text).forEach(({ event, data }) => {
      finished = finished || event === 'done' || event === 'error';
      onEvent({ event, data: JSON.parse(data) } as AssistantEvent);
    });

  let chunk = await reader.read();
  while (!chunk.done) {
    emit(decoder.decode(chunk.value, { stream: true }));
    // eslint-disable-next-line no-await-in-loop
    chunk = await reader.read();
  }
  if (!finished) {
    throw new AssistantError(t('The answer was cut off. Try again.'));
  }
}

export const askAssistant = (
  question: AssistantQuestion,
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> => streamAnswer(CHAT_URL, question, onEvent, signal);

/** Approves or rejects a pending call, and reads what the assistant does next. */
export const decideCall = (
  conversationId: string,
  decision: AssistantDecision,
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> =>
  streamAnswer(
    `${CHAT_URL}conversations/${conversationId}/decide/`,
    decision,
    onEvent,
    signal,
  );

/** Goes back to before the last turn that changed the report. */
export async function undoTurn(conversationId: string): Promise<UndoResult> {
  try {
    const { json } = await SupersetClient.post({
      endpoint: `${CHAT_URL}conversations/${conversationId}/undo/`,
    });
    return json.result;
  } catch (response) {
    const { message, error } = await getClientErrorObject(
      response as Parameters<typeof getClientErrorObject>[0],
    );
    throw new AssistantError(
      message ?? error ?? t('This could not be undone.'),
    );
  }
}
