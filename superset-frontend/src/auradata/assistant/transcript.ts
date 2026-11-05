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
  AssistantEvent,
  ChatMessage,
  StoredBlock,
  StoredConversation,
  ToolStep,
} from './types';

/** From this share of the model's context on, the panel asks for a new conversation. */
const LONG_CONVERSATION = 0.8;
const FALLBACK_CONTEXT_TOKENS = 200_000;
const PAGE_CONTEXT = '<page_context>';

const emptyAnswer = (id: string): ChatMessage => ({
  id,
  role: 'assistant',
  text: '',
  tools: [],
});

/** What the user wrote, without what the app added to the message. */
function questionOf(blocks: StoredBlock[]) {
  return blocks
    .filter(block => block.type === 'text' && block.text)
    .map(block => block.text as string)
    .filter(text => !text.startsWith(PAGE_CONTEXT))
    .join('\n\n');
}

const failedTools = (blocks: StoredBlock[]) =>
  blocks.filter(block => block.is_error).map(block => block.tool_use_id);

/**
 * A stored conversation as the panel shows it. The answer to a question spans several
 * rows: each call to the model, and the results of its tools in rows of their own.
 * Only text and tools show, whatever else the API returned.
 */
export function transcriptOf(stored: StoredConversation): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const steps = new Map<string, ToolStep>();
  let answer: ChatMessage | null = null;
  stored.messages.forEach(row => {
    if (row.role === 'user') {
      const failed = failedTools(row.content);
      failed.forEach(id => {
        const step = id ? steps.get(id) : undefined;
        if (step) step.failed = true;
      });
      const question = questionOf(row.content);
      if (question) {
        answer = null;
        messages.push({
          id: row.id,
          role: 'user',
          text: question,
          tools: [],
        });
      }
      return;
    }
    if (!answer) {
      answer = emptyAnswer(row.id);
      messages.push(answer);
    }
    if (row.stop_reason === 'refusal') {
      answer.refused = true;
      answer.problem = t('The AI declined to answer this.');
      return;
    }
    const current = answer;
    row.content.forEach(block => {
      if (block.type === 'text' && block.text) {
        current.text = current.text
          ? `${current.text}\n\n${block.text}`
          : block.text;
      }
      if (block.type === 'tool_use' && block.id) {
        const step = {
          id: block.id,
          name: block.name ?? '',
          running: false,
          failed: false,
        };
        steps.set(block.id, step);
        current.tools.push(step);
        current.figure = stored.figures[block.id] ?? current.figure;
      }
    });
  });
  return messages;
}

/** Whether a conversation has used most of what a model can read. */
export const isLongConversation = (
  contextTokens: number,
  maxInputTokens: number | null | undefined,
) =>
  contextTokens >=
  (maxInputTokens || FALLBACK_CONTEXT_TOKENS) * LONG_CONVERSATION;

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
            ? { ...step, running: false, failed: data.is_error }
            : step,
        ),
      };
    case 'refusal':
      return { ...answer, refused: true, problem: data.message };
    case 'error':
      return { ...answer, problem: data.message };
    default:
      return answer;
  }
}
