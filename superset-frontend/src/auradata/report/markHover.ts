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
import type { DrillthroughField } from './drillthroughScope';

/** Sent by a chart when the pointer enters a mark, and when it leaves. */
export const MARK_HOVER_EVENT = 'auradata:mark-hover';
export const MARK_LEAVE_EVENT = 'auradata:mark-leave';

export interface MarkHover {
  chartId: number;
  /** The tooltip page of the chart */
  pageId: string;
  fields: DrillthroughField[];
  x: number;
  y: number;
}
