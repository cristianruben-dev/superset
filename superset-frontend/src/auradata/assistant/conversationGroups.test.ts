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
import { groupByDate, matchesTitle } from './conversationGroups';
import type { ListedConversation } from './types';

const NOW = new Date(2026, 10, 20, 12, 0, 0);

const listed = (id: string, daysAgo: number): ListedConversation => {
  const date = new Date(2026, 10, 20 - daysAgo, 12, 0, 0);
  return {
    id,
    dashboard_id: 1,
    mode: 'read',
    model: 'm',
    title: id,
    changed_on: '',
    last_message_on: date.toISOString().replace('Z', ''),
  };
};

const labelled = (conversations: ListedConversation[]) =>
  groupByDate(conversations, NOW).map(({ label, conversations: items }) => [
    label,
    items.map(item => item.id),
  ]);

test('groups conversations by how long ago they grew, keeping their order', () => {
  expect(
    labelled([
      listed('today', 0),
      listed('also-today', 0),
      listed('yesterday', 1),
      listed('week', 7),
      listed('month', 30),
      listed('old', 31),
    ]),
  ).toEqual([
    ['Today', ['today', 'also-today']],
    ['Yesterday', ['yesterday']],
    ['Last 7 days', ['week']],
    ['Last 30 days', ['month']],
    ['Older', ['old']],
  ]);
});

test('leaves out the groups with nothing in them', () => {
  expect(labelled([listed('old', 100)])).toEqual([['Older', ['old']]]);
});

test('reads a date of the server as UTC', () => {
  const [{ label }] = groupByDate(
    [{ ...listed('a', 0), last_message_on: '2026-11-20T11:00:00.123456' }],
    new Date(Date.UTC(2026, 10, 20, 11, 30)),
  );
  expect(label).toBe('Today');
});

test('a conversation without a date goes last instead of breaking the list', () => {
  const [{ label }] = groupByDate(
    [{ ...listed('a', 0), last_message_on: '' }],
    NOW,
  );
  expect(label).toBe('Older');
});

test('finds a title without minding case or accents', () => {
  expect(matchesTitle('Región Norte', 'region')).toBe(true);
  expect(matchesTitle('Ventas de marzo', ' MARZO ')).toBe(true);
  expect(matchesTitle('Ventas de marzo', 'abril')).toBe(false);
  expect(matchesTitle('Lo que sea', '')).toBe(true);
});
