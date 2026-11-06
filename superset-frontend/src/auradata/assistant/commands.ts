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

export type CommandId = 'new' | 'model' | 'summary' | 'undo';

export interface AssistantCommand {
  id: CommandId;
  /** Shown in the language of the app; both names of `names` always work. */
  label: () => string;
  description: () => string;
  names: readonly string[];
}

const COMMANDS: readonly AssistantCommand[] = [
  {
    id: 'new',
    label: () => t('/new'),
    description: () => t('Start a new conversation'),
    names: ['new', 'nuevo'],
  },
  {
    id: 'model',
    label: () => t('/model'),
    description: () => t('Choose the model'),
    names: ['model', 'modelo'],
  },
  {
    id: 'summary',
    label: () => t('/summary'),
    description: () => t('Ask for a summary of this page'),
    names: ['summary', 'resumen'],
  },
  {
    id: 'undo',
    label: () => t('/undo'),
    description: () => t('Undo the assistant’s changes'),
    names: ['undo', 'deshacer'],
  },
];

/** The commands that can run now and start with what is typed after the slash. */
export function commandsFor(
  draft: string,
  available: readonly CommandId[],
): AssistantCommand[] {
  if (!/^\/\S*$/.test(draft)) return [];
  const typed = draft.slice(1).toLowerCase();
  return COMMANDS.filter(
    command =>
      available.includes(command.id) &&
      command.names.some(name => name.startsWith(typed)),
  );
}

/**
 * The command a whole message names, whether or not it can run now. Anything else is
 * a question: a message may well start with a slash.
 */
export function commandNamed(draft: string): CommandId | undefined {
  const typed = draft.trim().toLowerCase();
  return COMMANDS.find(command =>
    command.names.some(name => `/${name}` === typed),
  )?.id;
}
