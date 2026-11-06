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
  clearFeedback,
  decideCall,
  fetchConversation,
  readTurn,
  saveFeedback,
  stopTurn,
  undoTurn,
} from './client';
import { transcriptOf, wasStopped, withEvent } from './transcript';
import type {
  ArtifactRef,
  AssistantContext,
  AssistantBudget,
  AssistantEvent,
  ChatMessage,
  ChatMode,
  Confirmation,
  Feedback,
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
 * One conversation of the panel: what it shows, and sending to the server. An answer
 * runs on the server: leaving only stops reading it, and opening its conversation reads
 * it from where it is, also after a reload. Only `stop` stops it, and its stream then
 * ends as any other. `onChanged` runs when an answer ended after changing the report.
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
  // Fresher than what the panel read when it opened
  const [budget, setBudget] = useState<AssistantBudget | null>(null);
  // The document this conversation wrote last, which follows the answer as it goes
  const [artifact, setArtifact] = useState<ArtifactRef | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const currentId = useRef<string | null>(null);
  const stopWanted = useRef(false);
  const leftAnswer = useRef(false);

  const select = useCallback((id: string | null) => {
    currentId.current = id;
    setConversationId(id);
  }, []);

  /** Stops reading. The answer goes on, and it can be read again. */
  const leave = useCallback(() => {
    if (inFlight.current) leftAnswer.current = true;
    inFlight.current?.abort();
  }, []);
  useEffect(() => leave, [leave]);

  const stop = useCallback(() => {
    if (!inFlight.current) return;
    if (currentId.current) {
      stopTurn(currentId.current).catch(logging.error);
    } else {
      // The server has not said which conversation this is yet
      stopWanted.current = true;
    }
  }, []);

  const reset = useCallback(() => {
    leave();
    leftAnswer.current = false;
    setMessages([]);
    select(null);
    setConversationModel(null);
    setContextTokens(0);
    setCacheLost(false);
    setConfirmations([]);
    setCanUndo(false);
    setArtifact(null);
  }, [leave, select]);

  const show = useCallback(
    (stored: StoredConversation) => {
      const transcript = transcriptOf(stored);
      setMessages(transcript);
      select(stored.id);
      setConversationModel(stored.model);
      setContextTokens(stored.context_tokens);
      setCacheLost(false);
      setConfirmations(stored.pending ?? []);
      setCanUndo(stored.can_undo ?? false);
      setArtifact(stored.artifacts?.[stored.artifacts.length - 1] ?? null);
      return transcript;
    },
    [select],
  );

  /** Reads a stream into one answer, from its first event to its last. */
  const follow = useCallback(
    async (answerId: string, start: StreamStart) => {
      let changed = false;
      let readStored = false;
      const change = (update: (answer: ChatMessage) => ChatMessage) =>
        setMessages(current =>
          current.map(item => (item.id === answerId ? update(item) : item)),
        );
      const onEvent = (event: AssistantEvent) => {
        if (event.event === 'conversation') {
          select(event.data.id);
          setConversationModel(event.data.model);
          setCacheLost(false);
          if (stopWanted.current) {
            stopWanted.current = false;
            stopTurn(event.data.id).catch(logging.error);
          }
        } else if (event.event === 'model_changed') {
          setCacheLost(true);
        } else if (event.event === 'confirm') {
          // Reading a turn again brings its cards again
          setConfirmations(current =>
            current.some(item => item.id === event.data.id)
              ? current
              : [...current, event.data],
          );
        } else if (event.event === 'done') {
          setContextTokens(event.data.context_tokens);
          setCanUndo(event.data.can_undo ?? false);
          if (event.data.budget) setBudget(event.data.budget);
          // A turn resumed from a card keeps the id of the answer that asked
          const storedId = event.data.message_id;
          const stopped = wasStopped(event.data.stop_reason);
          change(answer => ({
            ...answer,
            storedId: answer.storedId ?? storedId ?? undefined,
            stopped: answer.stopped || stopped,
          }));
        } else if (event.event === 'turn_end') {
          readStored = readStored || !!event.data.gone;
        } else if (event.event === 'trimmed') {
          readStored = true;
        } else {
          changed =
            changed || (event.event === 'tool_end' && !!event.data.changed);
          if (event.event === 'tool_end' && event.data.artifact) {
            setArtifact(event.data.artifact);
          }
          change(answer => withEvent(answer, event));
        }
      };

      const controller = new AbortController();
      inFlight.current = controller;
      leftAnswer.current = false;
      setBusy(true);
      try {
        await start(onEvent, controller.signal);
        // Its stream left something out: what it stored has it all
        if (readStored && currentId.current) {
          show(await fetchConversation(currentId.current));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
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
        if (inFlight.current === controller) {
          inFlight.current = null;
          stopWanted.current = false;
          setBusy(false);
        }
        onAnswered();
        if (changed) onChanged?.();
      }
    },
    [onAnswered, onChanged, select, show],
  );

  const open = useCallback(
    async (id: string) => {
      leave();
      const stored = await fetchConversation(id);
      leftAnswer.current = false;
      const transcript = show(stored);
      if (!stored.running) return;
      const { after } = stored.running;
      const last = transcript[transcript.length - 1];
      const answerId = last?.role === 'assistant' ? last.id : localId();
      if (last?.role !== 'assistant') {
        setMessages(current => [
          ...current,
          { id: answerId, role: 'assistant', text: '', tools: [] },
        ]);
      }
      follow(answerId, (onEvent, signal) =>
        readTurn(id, after, onEvent, signal),
      );
    },
    [follow, leave, show],
  );

  /** Reads again the answer the panel left when it closed, if any. */
  const rejoin = useCallback(() => {
    if (leftAnswer.current && currentId.current) {
      leftAnswer.current = false;
      open(currentId.current).catch(logging.error);
    }
  }, [open]);

  const send = useCallback(
    (
      message: string,
      model: string,
      context: AssistantContext,
      attachments: string[] = [],
    ) => {
      const answerId = localId();
      // Writing instead of answering a card drops its calls, on the server too
      setConfirmations([]);
      setCanUndo(false);
      setMessages(current => [
        ...current,
        {
          id: localId(),
          role: 'user',
          text: message,
          tools: [],
          ...(attachments.length ? { attachments } : {}),
        },
        { id: answerId, role: 'assistant', text: '', tools: [] },
      ]);
      return follow(answerId, (onEvent, signal) =>
        askAssistant(
          {
            message,
            attachments,
            model,
            mode,
            conversation_id: conversationId,
            context,
          },
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

  /**
   * Changes the vote on an answer, or takes it back with null. It shows at once and
   * goes back if the server refuses.
   */
  const vote = useCallback(
    async ({ id, storedId, feedback }: ChatMessage, next: Feedback | null) => {
      if (!conversationId || !storedId) return;
      const show = (value?: Feedback | null) =>
        setMessages(current =>
          current.map(item =>
            item.id === id ? { ...item, feedback: value } : item,
          ),
        );
      show(next);
      try {
        await (next
          ? saveFeedback(conversationId, storedId, next)
          : clearFeedback(conversationId, storedId));
      } catch (error) {
        show(feedback);
        throw error;
      }
    },
    [conversationId],
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
    budget,
    artifact,
    send,
    decide,
    undo,
    vote,
    stop,
    leave,
    rejoin,
    open,
    reset,
  };
}
