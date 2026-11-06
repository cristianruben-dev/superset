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
import { ensureAppRoot } from 'src/utils/pathUtils';
import { sseParser } from './sse';
import type {
  Artifact,
  ArtifactDocument,
  AssistantContext,
  AssistantEvent,
  AssistantModels,
  AttachedImage,
  ChatMode,
  Conversation,
  Feedback,
  ListedConversation,
  ShareCardData,
  SharedDocument,
  StoredConversation,
  UndoResult,
} from './types';

const CHAT_URL = '/api/v1/auradata/assistant/';
/** Tries in a row, each one waiting a step longer, before saying the line is down. */
const RECONNECTS = 6;
const RECONNECT_MS = 1000;

export const fetchModels = (dashboardId: number): Promise<AssistantModels> =>
  SupersetClient.get({
    endpoint: `${CHAT_URL}models/?dashboard_id=${dashboardId}`,
  }).then(({ json }) => json.result);

/** Stores on the server that this person read the privacy notice. */
export const acceptPrivacy = (): Promise<unknown> =>
  SupersetClient.post({ endpoint: `${CHAT_URL}privacy/` });

export const fetchConversations = (
  dashboardId: number,
): Promise<ListedConversation[]> =>
  SupersetClient.get({
    endpoint: `${CHAT_URL}conversations/?dashboard_id=${dashboardId}`,
  }).then(({ json }) => json.result);

export const fetchConversation = (id: string): Promise<StoredConversation> =>
  SupersetClient.get({ endpoint: `${CHAT_URL}conversations/${id}/` }).then(
    ({ json }) => json.result,
  );

/** Why the server refused, in its words when it gave them. */
async function refusedWith(
  response: unknown,
  fallback: string,
): Promise<AssistantError> {
  const { message, error } = await getClientErrorObject(
    response as Parameters<typeof getClientErrorObject>[0],
  );
  return new AssistantError(
    typeof message === 'string' ? message : (error ?? fallback),
  );
}

/** Changes the title of a conversation, and nothing it holds. */
export async function renameConversation(
  id: string,
  title: string,
): Promise<Conversation> {
  try {
    const { json } = await SupersetClient.put({
      endpoint: `${CHAT_URL}conversations/${id}/`,
      jsonPayload: { title },
    });
    return json.result;
  } catch (response) {
    throw await refusedWith(response, t('The title could not be changed.'));
  }
}

/** Deletes a conversation and all it holds. */
export async function deleteConversation(id: string): Promise<void> {
  try {
    await SupersetClient.delete({
      endpoint: `${CHAT_URL}conversations/${id}/`,
    });
  } catch (response) {
    throw await refusedWith(
      response,
      t('This conversation could not be deleted.'),
    );
  }
}

/** A document of this person, as it stands or at a version of its history. */
export const fetchArtifact = (
  id: string,
  version?: number,
): Promise<Artifact> =>
  SupersetClient.get({
    endpoint: `${CHAT_URL}artifacts/${id}/${
      version === undefined ? '' : `versions/${version}/`
    }`,
  }).then(({ json }) => json.result);

/** Goes back to a version, which adds a new one. */
export async function restoreArtifact(
  id: string,
  version: number,
): Promise<Artifact> {
  try {
    const { json } = await SupersetClient.post({
      endpoint: `${CHAT_URL}artifacts/${id}/restore/`,
      jsonPayload: { version },
    });
    return json.result;
  } catch (response) {
    throw await refusedWith(response, t('This version could not be restored.'));
  }
}

/** A document as it reads on its page. Whoever may not read it gets a 404. */
export const fetchDocument = (id: string): Promise<ArtifactDocument> =>
  SupersetClient.get({ endpoint: `${CHAT_URL}documents/${id}/` }).then(
    ({ json }) => json.result,
  );

/** What a workspace has shared for this person. */
export const fetchSharedDocuments = (
  workspaceId: number,
): Promise<SharedDocument[]> =>
  SupersetClient.get({
    endpoint: `${CHAT_URL}documents/?workspace_id=${workspaceId}`,
  }).then(({ json }) => json.result);

export const fetchShareCard = (id: string): Promise<ShareCardData> =>
  SupersetClient.get({ endpoint: `${CHAT_URL}artifacts/${id}/share/` }).then(
    ({ json }) => json.result,
  );

/** Shares the version the card showed. */
export async function shareArtifact(
  id: string,
  version: number,
): Promise<Artifact> {
  try {
    const { json } = await SupersetClient.post({
      endpoint: `${CHAT_URL}artifacts/${id}/share/`,
      jsonPayload: { version },
    });
    return json.result;
  } catch (response) {
    throw await refusedWith(response, t('This document could not be shared.'));
  }
}

export const unshareArtifact = (id: string): Promise<Artifact> =>
  SupersetClient.delete({
    endpoint: `${CHAT_URL}artifacts/${id}/share/`,
  }).then(({ json }) => json.result);

const EXPORT_WAIT_MS = 2000;
const EXPORT_TRIES = 180;

const fileNameOf = (response: Response) =>
  /filename="([^"]+)"/.exec(
    response.headers.get('Content-Disposition') ?? '',
  )?.[1] ?? 'document.pdf';

/**
 * A document as a PDF: the workers take its picture, so this asks until it is ready.
 * Says the file and the name to save it with.
 */
export async function exportArtifact(
  id: string,
): Promise<{ blob: Blob; name: string }> {
  const url = `${CHAT_URL}artifacts/${id}/export/`;
  try {
    const { json } = await SupersetClient.post({ endpoint: url });
    for (let attempt = 0; attempt < EXPORT_TRIES; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(done => {
        setTimeout(done, EXPORT_WAIT_MS);
      });
      // eslint-disable-next-line no-await-in-loop
      const response = await SupersetClient.get({
        endpoint: `${url}${json.result.job_id}/`,
        parseMethod: 'raw',
      });
      if (response.status === 200) {
        // eslint-disable-next-line no-await-in-loop
        return { blob: await response.blob(), name: fileNameOf(response) };
      }
    }
  } catch (response) {
    throw await refusedWith(response, t('The PDF could not be made.'));
  }
  throw new AssistantError(t('The PDF could not be made.'));
}

const feedbackUrl = (conversationId: string, messageId: string) =>
  `${CHAT_URL}conversations/${conversationId}/messages/${messageId}/feedback/`;

/** Stores a vote on an answer, in place of the one this person had. */
export const saveFeedback = (
  conversationId: string,
  messageId: string,
  feedback: Feedback,
): Promise<unknown> =>
  SupersetClient.put({
    endpoint: feedbackUrl(conversationId, messageId),
    jsonPayload: feedback,
  });

/** Takes back the vote of this person on an answer. */
export const clearFeedback = (
  conversationId: string,
  messageId: string,
): Promise<unknown> =>
  SupersetClient.delete({ endpoint: feedbackUrl(conversationId, messageId) });

/** Where a page reads an image the person attached, with their session. */
export const attachmentUrl = (id: string) =>
  ensureAppRoot(`${CHAT_URL}attachments/${id}/`);

/** Hands an image to the server, which refuses it or keeps a clean copy. */
export async function uploadAttachment(file: File): Promise<AttachedImage> {
  const postPayload = new FormData();
  postPayload.append('image', file);
  try {
    const { json } = await SupersetClient.post({
      endpoint: `${CHAT_URL}attachments/`,
      postPayload,
    });
    return json.result;
  } catch (response) {
    throw await refusedWith(response, t('This image could not be attached.'));
  }
}

/** Drops an image that no message sent. */
export const deleteAttachment = (id: string): Promise<unknown> =>
  SupersetClient.delete({ endpoint: `${CHAT_URL}attachments/${id}/` });

/** A question for the assistant. */
export interface AssistantQuestion {
  message: string;
  attachments: string[];
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

/** Reads one connection. Says whether it reached the end of its turn. */
async function readEvents(
  response: Response,
  onEvent: (event: AssistantEvent, id?: number) => void,
): Promise<boolean> {
  if (!response.body) return false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parse = sseParser();
  let ended = false;
  const emit = (text: string) =>
    parse(text).forEach(({ event, data, id }) => {
      ended = ended || event === 'turn_end';
      onEvent({ event, data: JSON.parse(data) } as AssistantEvent, id);
    });

  let chunk = await reader.read();
  while (!chunk.done) {
    emit(decoder.decode(chunk.value, { stream: true }));
    // eslint-disable-next-line no-await-in-loop
    chunk = await reader.read();
  }
  return ended;
}

const pause = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const isRefused = (status: number) => status >= 400 && status < 500;

/**
 * Reads the turn of a conversation from the event after `after` until it ends. A
 * connection lasts under a minute and then the next goes on from the last number, so
 * this is also what a dropped one does. Only a refusal or a long silence stop it.
 */
export async function readTurn(
  conversationId: string,
  after: number,
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let last = after;
  let failures = 0;
  const onNumbered = (event: AssistantEvent, id?: number) => {
    if (id !== undefined) {
      last = id;
      failures = 0;
    }
    onEvent(event);
  };
  /* eslint-disable no-await-in-loop */
  while (!signal.aborted) {
    try {
      const response = await fetch(
        SupersetClient.getUrl({
          endpoint: `${CHAT_URL}conversations/${conversationId}/stream/?after=${last}`,
        }),
        {
          credentials: 'same-origin',
          headers: { Accept: 'text/event-stream' },
          signal,
        },
      );
      if (isRefused(response.status)) {
        throw new AssistantError(await refusalOf(response));
      }
      if (response.ok && (await readEvents(response, onNumbered))) return;
      if (!response.ok) failures += 1;
    } catch (error) {
      if (signal.aborted || error instanceof AssistantError) throw error;
      failures += 1;
    }
    if (failures > RECONNECTS) {
      throw new AssistantError(
        t(
          'The connection was lost. Open this conversation again to see the answer.',
        ),
      );
    }
    await pause(Math.min(failures, RECONNECTS) * RECONNECT_MS, signal);
  }
  /* eslint-enable no-await-in-loop */
}

/**
 * Sends a request and hands over each event as it arrives. `SupersetClient` waits
 * for whole responses, so this reads the body of a `fetch` with the same token. A
 * token that went stale gets one new try. The answer runs in a worker, so a connection
 * that ends early only means reading it from another. `known` is the conversation, when
 * it does not come in the answer.
 */
async function streamAnswer(
  endpoint: string,
  body: AssistantQuestion | AssistantDecision,
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
  known: string | null,
): Promise<void> {
  let response = await post(endpoint, body, signal);
  if (response.status === 400) {
    await SupersetClient.reAuthenticate();
    response = await post(endpoint, body, signal);
  }
  if (!response.ok || !response.body) {
    throw new AssistantError(await refusalOf(response));
  }

  let conversationId = known;
  let last = 0;
  let ended = false;
  try {
    ended = await readEvents(response, (event, id) => {
      if (id !== undefined) last = id;
      if (event.event === 'conversation') conversationId = event.data.id;
      onEvent(event);
    });
  } catch (error) {
    if (signal.aborted || !conversationId) throw error;
  }
  if (ended) return;
  if (!conversationId) {
    throw new AssistantError(t('The answer was cut off. Try again.'));
  }
  await readTurn(conversationId, last, onEvent, signal);
}

export const askAssistant = (
  question: AssistantQuestion,
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> =>
  streamAnswer(CHAT_URL, question, onEvent, signal, question.conversation_id);

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
    conversationId,
  );

/** Asks the server to stop the turn of a conversation. Its stream says when it did. */
export const stopTurn = (conversationId: string): Promise<unknown> =>
  SupersetClient.post({
    endpoint: `${CHAT_URL}conversations/${conversationId}/stop/`,
  });

/** Goes back to before the last turn that changed the report. */
export async function undoTurn(conversationId: string): Promise<UndoResult> {
  try {
    const { json } = await SupersetClient.post({
      endpoint: `${CHAT_URL}conversations/${conversationId}/undo/`,
    });
    return json.result;
  } catch (response) {
    throw await refusedWith(response, t('This could not be undone.'));
  }
}
