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

/** Answer of `GET /api/v1/auradata/assistant/models/`. */
export interface AssistantModels {
  available: boolean;
  models: OfferedModel[];
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
  metrics: string[];
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
  filters?: Record<string, unknown>;
}

/** A conversation as the list gives it. */
export interface Conversation {
  id: string;
  dashboard_id: number;
  mode: 'read' | 'edit';
  model: string;
  title: string;
  changed_on: string;
}

/** A block of a stored message, as the API of Anthropic gave it. */
export interface StoredBlock {
  type: string;
  id?: string;
  name?: string;
  text?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

/** A row of a stored conversation. */
export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: StoredBlock[];
  stop_reason: string | null;
}

/** Answer of `GET /api/v1/auradata/assistant/conversations/<id>/`. */
export interface StoredConversation extends Conversation {
  messages: StoredMessage[];
  figures: Record<string, Figure>;
  context_tokens: number;
}

/** A tool the assistant used for a message. */
export interface ToolStep {
  id: string;
  name: string;
  running: boolean;
  failed: boolean;
}

/** A message of the panel. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tools: ToolStep[];
  figure?: Figure;
  /** A notice of the service in place of the rest of the answer. */
  problem?: string;
  refused?: boolean;
  stopped?: boolean;
  /** A tool ran since the last text: the next text starts a paragraph. */
  pause?: boolean;
}

/** What the stream of the assistant says, event by event. */
export type AssistantEvent =
  | { event: 'conversation'; data: { id: string; model: string; mode: string } }
  | { event: 'model_changed'; data: { from: string; to: string } }
  | { event: 'text'; data: { text: string } }
  | { event: 'tool_start'; data: { id: string; name: string } }
  | {
      event: 'tool_end';
      data: { id: string; name: string; is_error: boolean; figure?: Figure };
    }
  | { event: 'refusal'; data: { message: string } }
  | { event: 'error'; data: { code: string; message: string } }
  | { event: 'done'; data: { model: string; context_tokens: number } };
