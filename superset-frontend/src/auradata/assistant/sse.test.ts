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
import { sseParser } from './sse';

test('reads an event', () => {
  expect(sseParser()('event: text\ndata: {"text":"Hola"}\n\n')).toEqual([
    { event: 'text', data: '{"text":"Hola"}' },
  ]);
});

test('waits for the rest of an event cut across chunks', () => {
  const parse = sseParser();

  expect(parse('event: te')).toEqual([]);
  expect(parse('xt\ndata: {"a"')).toEqual([]);
  expect(parse(':1}\n')).toEqual([]);
  expect(parse('\nevent: done\ndata: {}\n\n')).toEqual([
    { event: 'text', data: '{"a":1}' },
    { event: 'done', data: '{}' },
  ]);
});

test('takes carriage returns, even with the pair cut between chunks', () => {
  const parse = sseParser();

  expect(parse('event: done\r\ndata: {}\r\n\r')).toEqual([]);
  expect(parse('\n')).toEqual([{ event: 'done', data: '{}' }]);
});

test('skips the comments that keep the connection open', () => {
  expect(sseParser()(': keep-alive\n\nevent: done\ndata: {}\n\n')).toEqual([
    { event: 'done', data: '{}' },
  ]);
});

test('joins the lines of a long data field', () => {
  expect(sseParser()('data: one\ndata: two\n\n')).toEqual([
    { event: 'message', data: 'one\ntwo' },
  ]);
});

test('keeps the number of an event', () => {
  expect(sseParser()('id: 7\nevent: text\ndata: {}\n\n')).toEqual([
    { event: 'text', data: '{}', id: 7 },
  ]);
});
