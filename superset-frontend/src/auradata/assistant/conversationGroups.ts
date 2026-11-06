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
import type { ListedConversation } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
// The most calendar days ago each group reaches. A conversation falls in the first it fits
const GROUP_DAYS = [0, 1, 7, 30];

/** One label for each of those groups, and one for everything older. */
const groupLabels = () => [
  t('Today'),
  t('Yesterday'),
  t('Last 7 days'),
  t('Last 30 days'),
  t('Older'),
];

/** The server stamps dates without a zone, in UTC. */
const parseServerDate = (value: string) =>
  new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysAgo = (date: Date, now: Date) =>
  Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);

/** A title as people look for it: no case and no accents. */
const searchable = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const matchesTitle = (title: string, query: string) =>
  searchable(title).includes(searchable(query.trim()));

export interface ConversationGroup {
  label: string;
  conversations: ListedConversation[];
}

/**
 * Conversations by how long ago they last grew, in the order they came. Groups with
 * nothing in them are left out. An undated one goes in the last group.
 */
export function groupByDate(
  conversations: ListedConversation[],
  now: Date = new Date(),
): ConversationGroup[] {
  const labels = groupLabels();
  const groups = labels.map(label => ({
    label,
    conversations: [] as ListedConversation[],
  }));
  conversations.forEach(conversation => {
    const age = daysAgo(parseServerDate(conversation.last_message_on), now);
    const index = GROUP_DAYS.findIndex(days => age <= days);
    groups[index < 0 ? labels.length - 1 : index].conversations.push(
      conversation,
    );
  });
  return groups.filter(group => group.conversations.length > 0);
}
