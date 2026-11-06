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
/**
 * What this tab remembers of the panel, so a reload comes back to it. Answers and
 * permissions stay on the server: this is only which conversation was open, and it can
 * be gone at any time.
 */
const conversationKey = (dashboardId: number, mode: string) =>
  `auradata.assistant.conversation.${dashboardId}.${mode}`;
const panelKey = (dashboardId: number) =>
  `auradata.assistant.panel.${dashboardId}`;

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Without storage a reload simply starts with an empty panel
  }
}

export const rememberedConversation = (dashboardId: number, mode: string) =>
  read(conversationKey(dashboardId, mode));

export const rememberConversation = (
  dashboardId: number,
  mode: string,
  conversationId: string,
) => write(conversationKey(dashboardId, mode), conversationId);

export const forgetConversation = (dashboardId: number, mode: string) =>
  write(conversationKey(dashboardId, mode), null);

export const rememberedPanel = (dashboardId: number) =>
  read(panelKey(dashboardId)) === 'open';

export const rememberPanel = (dashboardId: number, open: boolean) =>
  write(panelKey(dashboardId), open ? 'open' : null);
