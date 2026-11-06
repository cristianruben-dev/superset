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
import { t } from '@apache-superset/core/translation';
import type {
  AnswerStep,
  AssistantEvent,
  ChatMessage,
  Feedback,
  StoredBlock,
  StoredConversation,
  ToolStep,
} from './types';

/** From this share of the model's context on, the panel asks for a new conversation. */
const LONG_CONVERSATION = 0.8;
const FALLBACK_CONTEXT_TOKENS = 200_000;
const PAGE_CONTEXT = '<page_context>';
const ATTACHMENT_BLOCK = 'auradata_attachment';
const CONTEXT_EXCEEDED = 'context_exceeded';
/** What the API writes in place of a note when a response is cut: not for the person. */
const CUT_NOTE =
  'This part of the response was interrupted before it finished.';
const STOPPED_BY_THE_SERVER = 'interrupted';

const INCOMPLETE = () =>
  t(
    'The assistant stopped before finishing, and this answer is incomplete. If it was changing the report, check it before asking again.',
  );

const emptyAnswer = (id: string, feedback?: Feedback): ChatMessage => ({
  id,
  role: 'assistant',
  text: '',
  tools: [],
  storedId: id,
  feedback,
});

/** What the user wrote, without what the app added to the message. */
function questionOf(blocks: StoredBlock[]) {
  return blocks
    .filter(block => block.type === 'text' && block.text)
    .map(block => block.text as string)
    .filter(text => !text.startsWith(PAGE_CONTEXT))
    .join('\n\n');
}

const attachmentsOf = (blocks: StoredBlock[]) =>
  blocks
    .filter(block => block.type === ATTACHMENT_BLOCK && block.id)
    .map(block => block.id as string);

const failedTools = (blocks: StoredBlock[]) =>
  blocks.filter(block => block.is_error).map(block => block.tool_use_id);

/**
 * A stored conversation as the panel shows it. The answer to a question spans several
 * rows: each call to the model, and the results of its tools in rows of their own.
 * Only text, tools and what thinking blocks hold show, whatever else the API returned.
 */
export function transcriptOf(stored: StoredConversation): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const steps = new Map<string, ToolStep>();
  const lost = [...(stored.interrupted ?? [])];
  let answer: ChatMessage | null = null;
  /** A turn lost before this position says so where its answer went. */
  const markLost = (before: number) => {
    while (lost.length && lost[0] < before) {
      const seq = lost.shift();
      if (!answer) {
        answer = { id: `lost-${seq}`, role: 'assistant', text: '', tools: [] };
        messages.push(answer);
      }
      answer.problem = INCOMPLETE();
    }
  };
  stored.messages.forEach(row => {
    markLost(row.seq);
    if (row.role === 'user') {
      const failed = failedTools(row.content);
      failed.forEach(id => {
        const step = id ? steps.get(id) : undefined;
        if (step) step.failed = true;
      });
      const question = questionOf(row.content);
      const attachments = attachmentsOf(row.content);
      if (question || attachments.length) {
        answer = null;
        messages.push({
          id: row.id,
          role: 'user',
          text: question,
          tools: [],
          ...(attachments.length ? { attachments } : {}),
        });
      }
      return;
    }
    if (!answer) {
      answer = emptyAnswer(row.id, stored.feedback?.[row.id]);
      messages.push(answer);
    }
    if (row.stop_reason === 'refusal') {
      answer.refused = true;
      answer.problem = t('The AI declined to answer this.');
      return;
    }
    if (row.stop_reason === STOPPED_BY_THE_SERVER) answer.stopped = true;
    const current = answer;
    row.content.forEach(block => {
      if (block.type === 'text' && block.text) {
        current.text = current.text
          ? `${current.text}\n\n${block.text}`
          : block.text;
      }
      if (block.type === 'thinking' && block.thinking) {
        current.notes = [
          ...(current.notes ?? []),
          { text: block.thinking, after: current.tools.length },
        ];
      }
      if (block.type === 'tool_use' && block.id) {
        const step = {
          id: block.id,
          name: block.name ?? '',
          running: false,
          failed: false,
          rejected: stored.rejected?.includes(block.id),
        };
        steps.set(block.id, step);
        current.tools.push(step);
        current.figure = stored.figures[block.id] ?? current.figure;
      }
    });
  });
  markLost(Number.POSITIVE_INFINITY);
  return messages;
}

/** Whether a conversation has used most of what a model can read. */
export const isLongConversation = (
  contextTokens: number,
  maxInputTokens: number | null | undefined,
) =>
  contextTokens >=
  (maxInputTokens || FALLBACK_CONTEXT_TOKENS) * LONG_CONVERSATION;

/**
 * The lines of the steps of an answer, in the order they happened. Each tool shows
 * once, where it last ran, and a note stays before the tool it introduced.
 */
export function stepsOf(
  { tools, notes = [] }: ChatMessage,
  labelOf: (name: string) => string,
): AnswerStep[] {
  const steps: AnswerStep[] = [];
  const addNotes = (after: number) =>
    notes
      .filter(note => note.after === after)
      .filter(note => note.text.trim() && note.text !== CUT_NOTE)
      .forEach(note => steps.push({ kind: 'note', note }));
  tools.forEach((step, index) => {
    addNotes(index);
    const label = labelOf(step.name);
    const earlier = steps.findIndex(
      item => item.kind === 'tool' && item.label === label,
    );
    if (earlier >= 0) steps.splice(earlier, 1);
    steps.push({ kind: 'tool', label, step });
  });
  addNotes(tools.length);
  return steps;
}

/** Whether a turn ended because someone asked it to stop. */
export const wasStopped = (stopReason?: string | null) =>
  stopReason === STOPPED_BY_THE_SERVER;

/** What an event changes in the answer being written. */
export function withEvent(
  answer: ChatMessage,
  { event, data }: AssistantEvent,
): ChatMessage {
  switch (event) {
    case 'text': {
      const gap = answer.pause && answer.text ? '\n\n' : '';
      return {
        ...answer,
        text: `${answer.text}${gap}${data.text}`,
        pause: false,
      };
    }
    case 'note': {
      const notes = answer.notes ?? [];
      const last = notes[notes.length - 1];
      return {
        ...answer,
        notes:
          data.starts || !last
            ? [...notes, { text: data.text, after: answer.tools.length }]
            : [...notes.slice(0, -1), { ...last, text: last.text + data.text }],
      };
    }
    case 'tool_start':
      return {
        ...answer,
        pause: true,
        tools: [
          ...answer.tools,
          { id: data.id, name: data.name, running: true, failed: false },
        ],
      };
    case 'tool_end':
      return {
        ...answer,
        figure: data.figure ?? answer.figure,
        tools: answer.tools.map(step =>
          step.id === data.id
            ? {
                ...step,
                running: false,
                failed: data.is_error,
                rejected: data.rejected,
              }
            : step,
        ),
      };
    case 'refusal':
      return { ...answer, refused: true, problem: data.message };
    case 'error':
      return {
        ...answer,
        problem: data.message,
        contextExceeded: data.code === CONTEXT_EXCEEDED,
      };
    default:
      return answer;
  }
}
