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

/** The action of the log for a tool the assistant ran. */
export const ASSISTANT_ACTION = 'assistant_tool_call';

/** The action of the log for what a person did with a document of the assistant. */
export const DOCUMENT_ACTION = 'assistant_document';

/** The JSON of a row of the log. */
function detailsOf(json: string | null | undefined): {
  model?: string;
  action?: string;
} {
  try {
    return JSON.parse(json ?? '') ?? {};
  } catch {
    return {};
  }
}

const documentAction = (action?: string) => {
  if (action === 'share') return t('Shared a document');
  if (action === 'unshare') return t('Stopped sharing a document');
  return t('Exported a document to PDF');
};

/**
 * How the action log names an action. A call of the assistant says its model, and so
 * does what a person did with a document, which is the model that wrote it.
 */
export function actionLabel(
  action: string,
  json: string | null | undefined,
): string {
  const { model, action: done } = detailsOf(json);
  if (action === DOCUMENT_ACTION) {
    return `${documentAction(done)} · ${t('Made by the assistant (model %s)', model ?? '-')}`;
  }
  if (action !== ASSISTANT_ACTION) {
    return action;
  }
  return model ? t('Done by the assistant (%s)', model) : t('The assistant');
}
