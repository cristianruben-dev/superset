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
import {
  askAssistant,
  AssistantError,
  decideCall,
  fetchConversation,
  undoTurn,
} from './client';
import { transcriptOf, withEvent } from './transcript';
import type {
  AssistantContext,
  AssistantEvent,
  ChatMessage,
  ChatMode,
  Confirmation,
  StoredConversation,
  UndoResult,
} from './types';

const NOT_ANSWERED = () => t('The assistant could not answer. Try again.');

let nextId = 0;
const localId = () => {
  nextId += 1;
  return `local-${nextId}`;
};

type StreamStart = (
  onEvent: (event: AssistantEvent) => void,
  signal: AbortSignal,
) => Promise<void>;

/**
 * One conversation of the panel: what it shows, and sending to the server. A question
 * in the air is aborted by `stop`, and by leaving: closing the panel ends its stream.
 * `onChanged` runs when an answer ended after changing the report.
 */
export function useAssistantChat(
  mode: ChatMode,
  onAnswered: () => void,
  onChanged?: () => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationModel, setConversationModel] = useState<string | null>(
    null,
  );
  const [contextTokens, setContextTokens] = useState(0);
  const [cacheLost, setCacheLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [canUndo, setCanUndo] = useState(false);
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
    setConfirmations([]);
    setCanUndo(false);
  }, [stop]);

  const show = useCallback((stored: StoredConversation) => {
    setMessages(transcriptOf(stored));
    setConversationId(stored.id);
    setConversationModel(stored.model);
    setContextTokens(stored.context_tokens);
    setCacheLost(false);
    setConfirmations(stored.pending ?? []);
    setCanUndo(stored.can_undo ?? false);
  }, []);

  const open = useCallback(
    async (id: string) => {
      stop();
      show(await fetchConversation(id));
    },
    [show, stop],
  );

  /** Reads a stream into one answer, from its first event to its last. */
  const follow = useCallback(
    async (answerId: string, start: StreamStart) => {
      let changed = false;
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
        } else if (event.event === 'confirm') {
          setConfirmations(current => [...current, event.data]);
        } else if (event.event === 'done') {
          setContextTokens(event.data.context_tokens);
          setCanUndo(event.data.can_undo ?? false);
        } else {
          changed =
            changed || (event.event === 'tool_end' && !!event.data.changed);
          change(answer => withEvent(answer, event));
        }
      };

      const controller = new AbortController();
      inFlight.current = controller;
      setBusy(true);
      try {
        await start(onEvent, controller.signal);
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
        if (changed) onChanged?.();
      }
    },
    [onAnswered, onChanged],
  );

  const send = useCallback(
    (message: string, model: string, context: AssistantContext) => {
      const answerId = localId();
      // Writing instead of answering a card drops its calls, on the server too
      setConfirmations([]);
      setCanUndo(false);
      setMessages(current => [
        ...current,
        { id: localId(), role: 'user', text: message, tools: [] },
        { id: answerId, role: 'assistant', text: '', tools: [] },
      ]);
      return follow(answerId, (onEvent, signal) =>
        askAssistant(
          { message, model, mode, conversation_id: conversationId, context },
          onEvent,
          signal,
        ),
      );
    },
    [conversationId, follow, mode],
  );

  /** Answers one card. What follows joins the answer that asked. */
  const decide = useCallback(
    (toolUseId: string, approved: boolean, model: string) => {
      if (!conversationId) return Promise.resolve();
      const asking = [...messages]
        .reverse()
        .find(item => item.role === 'assistant');
      const answerId = asking?.id ?? localId();
      if (!asking) {
        setMessages(current => [
          ...current,
          { id: answerId, role: 'assistant', text: '', tools: [] },
        ]);
      }
      setConfirmations(current =>
        current.filter(item => item.id !== toolUseId),
      );
      return follow(answerId, (onEvent, signal) =>
        decideCall(
          conversationId,
          { tool_use_id: toolUseId, approved, model },
          onEvent,
          signal,
        ),
      );
    },
    [conversationId, follow, messages],
  );

  /** Goes back to before the last turn that changed the report. */
  const undo = useCallback(async (): Promise<UndoResult | null> => {
    if (!conversationId) return null;
    const result = await undoTurn(conversationId);
    setCanUndo(result.can_undo);
    onChanged?.();
    return result;
  }, [conversationId, onChanged]);

  return {
    messages,
    conversationId,
    conversationModel,
    contextTokens,
    cacheLost,
    busy,
    confirmations,
    canUndo,
    send,
    decide,
    undo,
    stop,
    open,
    reset,
  };
}
