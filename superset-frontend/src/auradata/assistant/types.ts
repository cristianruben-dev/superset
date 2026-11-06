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
import type { QueryFormMetric } from '@superset-ui/core';
/** What a conversation can do: answer about a report, or change it too. */
export type ChatMode = 'read' | 'edit';

/** The relative price of a model, for someone choosing one. */
export type ModelPrice = 'economy' | 'balanced' | 'top';

/** A model a user can pick. */
export interface OfferedModel {
  id: string;
  name: string;
  family: string;
  price: ModelPrice;
  default: boolean;
  tool_search: boolean;
  max_input_tokens: number | null;
}

/** Where this month stands against a limit. It never holds an amount. */
export interface AssistantBudget {
  level: 'ok' | 'warning' | 'stopped';
  scope: 'global' | 'workspace' | null;
}

/** Answer of `GET /api/v1/auradata/assistant/models/`. */
export interface AssistantModels {
  available: boolean;
  models: OfferedModel[];
  edit_available?: boolean;
  privacy_accepted?: boolean;
  budget?: AssistantBudget;
}

/** What a person can do with the assistant on one report. */
export interface AssistantAccess {
  models: OfferedModel[];
  /** The same models when the copilot runs here, none when it does not. */
  editModels: OfferedModel[];
  privacyAccepted: boolean;
  budget: AssistantBudget;
  acceptPrivacy: () => Promise<void>;
}

/** A filter that ran in a query. */
export interface FigureFilter {
  col: string;
  op: string;
  val?: unknown;
}

/** What the server says about a query: where it comes from and its first rows. */
export interface Figure {
  dataset_id: number;
  dataset_name: string;
  metrics: QueryFormMetric[];
  columns: string[];
  filters: FigureFilter[];
  order_by: string[];
  order_desc: boolean;
  row_limit: number;
  rows: Record<string, unknown>[];
  row_count: number;
  from_dttm: string | null;
  to_dttm: string | null;
}

/** Where the user is, sent with each message. */
export interface AssistantContext {
  dashboard_id: number;
  page?: string;
  page_id?: string;
  selection?: SelectedObject[];
  filters?: Record<string, unknown>;
  /** The document open beside the chat, by name: the server reads what it holds. */
  artifact?: { id: string; block_id?: string };
}

/** What a block of data asks for, in the words of `query_dataset`. */
export interface ArtifactQuery {
  dataset_id: number;
  columns?: string[];
  metrics?: string[];
  aggregates?: { column: string; aggregate: string }[];
  filters?: FigureFilter[];
  time_range?: string;
  time_column?: string;
  order_by?: string[];
  order_desc?: boolean;
  row_limit?: number;
}

/** Paragraphs in Markdown, stamped by the server with when they were written. */
export interface TextBlock {
  id: string;
  type: 'text';
  text: string;
  written_on: string;
}

export type FigureFormat = 'number' | 'compact' | 'percent' | 'currency';

/** One number that stands out, read from its query. */
export interface FigureBlock {
  id: string;
  type: 'figure';
  label: string;
  format?: FigureFormat;
  query: ArtifactQuery;
}

export type ChartKind = 'bar' | 'line' | 'area' | 'pie';

/** A chart drawn from its query. */
export interface ChartBlock {
  id: string;
  type: 'chart';
  title: string;
  chart: ChartKind;
  query: ArtifactQuery;
}

/** Rows read from its query. */
export interface TableBlock {
  id: string;
  type: 'table';
  title: string;
  query: ArtifactQuery;
}

export type DataBlock = FigureBlock | ChartBlock | TableBlock;
export type ArtifactBlock = TextBlock | DataBlock;

/** What the chat says about a document. */
export interface ArtifactRef {
  id: string;
  title: string;
  version: number;
}

/** A line of the history of a document. */
export interface ArtifactVersion {
  number: number;
  title: string;
  origin: 'created' | 'changed' | 'restored';
  restored_from: number | null;
  created_on: string;
}

/** A version of a document, as its owner reads it. */
export interface Artifact extends ArtifactRef {
  conversation_id: string;
  dashboard_id: number;
  blocks: ArtifactBlock[];
  /** The names of the datasets this reader reaches, by id. */
  sources: Record<string, string>;
  created_on: string;
  versions: ArtifactVersion[];
}

/** An object the user has selected in the editor, for the assistant to read. */
export interface SelectedObject {
  id: string;
  type?: string;
  chart_id?: number;
  name?: string;
  format?: Record<string, unknown>;
}

/** A call that waits for the approval of the person. */
export interface Confirmation {
  id: string;
  name: string;
  title: string;
  input: Record<string, unknown>;
}

/** An image the server took: it joins a message by its id. */
export interface AttachedImage {
  id: string;
  media_type: string;
  width: number;
  height: number;
}

/** A conversation as the list gives it. */
export interface Conversation {
  id: string;
  dashboard_id: number;
  mode: ChatMode;
  model: string;
  title: string;
  changed_on: string;
}

/** A row of the list of conversations of a report. */
export interface ListedConversation extends Conversation {
  /** When it last grew: a rename does not move it. */
  last_message_on: string;
}

/** Why an answer got a thumbs down. The server only takes these. */
export type FeedbackReason =
  | 'wrong_data'
  | 'off_topic'
  | 'incomplete'
  | 'other';

/** What a person thought of an answer. */
export interface Feedback {
  vote: 'up' | 'down';
  reason?: FeedbackReason | null;
}

/** A block of a stored message, as the API of Anthropic gave it. */
export interface StoredBlock {
  type: string;
  id?: string;
  name?: string;
  text?: string;
  thinking?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

/** A row of a stored conversation. */
export interface StoredMessage {
  id: string;
  /** Its position in the conversation. */
  seq: number;
  role: 'user' | 'assistant';
  content: StoredBlock[];
  stop_reason: string | null;
}

/** Answer of `GET /api/v1/auradata/assistant/conversations/<id>/`. */
export interface StoredConversation extends Conversation {
  messages: StoredMessage[];
  figures: Record<string, Figure>;
  /** What each call wrote, by the id of the call. */
  artifact_calls?: Record<string, ArtifactRef>;
  /** The documents of this conversation, the oldest first. */
  artifacts?: ArtifactRef[];
  context_tokens: number;
  pending: Confirmation[];
  rejected: string[];
  can_undo: boolean;
  /** The votes of this person, by the id of the answer. */
  feedback: Record<string, Feedback>;
  /** Where a turn stopped without an ending, by position. */
  interrupted?: number[];
  /** A turn running now: `messages` stop before it, and its stream from `after` has it. */
  running?: { after: number } | null;
}

/** Answer of the undo of a conversation. */
export interface UndoResult {
  skipped_charts: number;
  can_undo: boolean;
}

/** A tool the assistant used for a message. */
export interface ToolStep {
  id: string;
  name: string;
  running: boolean;
  failed: boolean;
  /** The person said no on its card. */
  rejected?: boolean;
}

/** What the model shows of its thinking. Its text is plain, whatever it holds. */
export interface StepNote {
  text: string;
  /** How many tools of the answer came before it. */
  after: number;
}

/** A line of the steps of an answer. */
export type AnswerStep =
  | { kind: 'tool'; label: string; step: ToolStep }
  | { kind: 'note'; note: StepNote };

/** A message of the panel. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tools: ToolStep[];
  /** The images a person sent with this message, by their id on the server. */
  attachments?: string[];
  notes?: StepNote[];
  /** The id on the server of an answer, what a vote goes on. */
  storedId?: string;
  feedback?: Feedback | null;
  figure?: Figure;
  /** The document this answer wrote. */
  artifact?: ArtifactRef;
  /** A notice of the service in place of the rest of the answer. */
  problem?: string;
  refused?: boolean;
  stopped?: boolean;
  /** The conversation no longer fits in what the model can read. */
  contextExceeded?: boolean;
  /** A tool ran since the last text: the next text starts a paragraph. */
  pause?: boolean;
}

/** What the stream of the assistant says, event by event. */
export type AssistantEvent =
  | { event: 'conversation'; data: { id: string; model: string; mode: string } }
  | { event: 'model_changed'; data: { from: string; to: string } }
  | { event: 'text'; data: { text: string } }
  /** `starts` opens a new note; otherwise the text joins the last one. */
  | { event: 'note'; data: { text: string; starts: boolean } }
  | { event: 'tool_start'; data: { id: string; name: string } }
  | {
      event: 'tool_end';
      data: {
        id: string;
        name: string;
        is_error: boolean;
        figure?: Figure;
        artifact?: ArtifactRef;
        changed?: boolean;
        rejected?: boolean;
      };
    }
  | { event: 'confirm'; data: Confirmation }
  | { event: 'refusal'; data: { message: string } }
  | { event: 'error'; data: { code: string; message: string } }
  | {
      event: 'done';
      data: {
        model?: string;
        stop_reason?: string | null;
        context_tokens: number;
        can_undo?: boolean;
        budget?: AssistantBudget;
        message_id?: string | null;
      };
    }
  /** The last event of a turn. `gone` says there was nothing left to read. */
  | { event: 'turn_end'; data: { gone?: boolean } }
  /** The stream no longer keeps what this reader missed: the stored rows have it. */
  | { event: 'trimmed'; data: Record<string, never> };
