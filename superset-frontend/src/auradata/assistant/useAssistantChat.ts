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
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { askAssistant, AssistantError, fetchConversation } from './client';
import { transcriptOf, withEvent } from './transcript';
import type {
  AssistantContext,
  AssistantEvent,
  ChatMessage,
  StoredConversation,
} from './types';

const NOT_ANSWERED = () => t('The assistant could not answer. Try again.');

let nextId = 0;
const localId = () => {
  nextId += 1;
  return `local-${nextId}`;
};

/**
 * One conversation of the panel: what it shows, and sending to the server. A question
 * in the air is aborted by `stop`, and by leaving: closing the panel ends its stream.
 */
export function useAssistantChat(onAnswered: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationModel, setConversationModel] = useState<string | null>(
    null,
  );
  const [contextTokens, setContextTokens] = useState(0);
  const [cacheLost, setCacheLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const stop = useCallback(() => inFlight.current?.abort(), []);
  useEffect(() => stop, [stop]);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setConversationId(null);
    setConversationModel(null);
    setContextTokens(0);
    setCacheLost(false);
  }, [stop]);

  const show = useCallback((stored: StoredConversation) => {
    setMessages(transcriptOf(stored));
    setConversationId(stored.id);
    setConversationModel(stored.model);
    setContextTokens(stored.context_tokens);
    setCacheLost(false);
  }, []);

  const open = useCallback(
    async (id: string) => {
      stop();
      show(await fetchConversation(id));
    },
    [show, stop],
  );

  const send = useCallback(
    async (message: string, model: string, context: AssistantContext) => {
      const answerId = localId();
      const change = (update: (answer: ChatMessage) => ChatMessage) =>
        setMessages(current =>
          current.map(item => (item.id === answerId ? update(item) : item)),
        );
      const onEvent = (event: AssistantEvent) => {
        if (event.event === 'conversation') {
          setConversationId(event.data.id);
          setConversationModel(event.data.model);
          setCacheLost(false);
        } else if (event.event === 'model_changed') {
          setCacheLost(true);
        } else if (event.event === 'done') {
          setContextTokens(event.data.context_tokens);
        } else {
          change(answer => withEvent(answer, event));
        }
      };

      const controller = new AbortController();
      inFlight.current = controller;
      setBusy(true);
      setMessages(current => [
        ...current,
        { id: localId(), role: 'user', text: message, tools: [] },
        { id: answerId, role: 'assistant', text: '', tools: [] },
      ]);
      try {
        await askAssistant(
          {
            message,
            model,
            mode: 'read',
            conversation_id: conversationId,
            context,
          },
          onEvent,
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          change(answer => ({ ...answer, stopped: true }));
        } else {
          if (!(error instanceof AssistantError)) logging.error(error);
          const problem =
            error instanceof AssistantError ? error.message : NOT_ANSWERED();
          change(answer => ({ ...answer, problem }));
        }
      } finally {
        change(answer => ({
          ...answer,
          tools: answer.tools.map(step => ({ ...step, running: false })),
        }));
        if (inFlight.current === controller) inFlight.current = null;
        setBusy(false);
        onAnswered();
      }
    },
    [conversationId, onAnswered],
  );

  return {
    messages,
    conversationId,
    conversationModel,
    contextTokens,
    cacheLost,
    busy,
    send,
    stop,
    open,
    reset,
  };
}
