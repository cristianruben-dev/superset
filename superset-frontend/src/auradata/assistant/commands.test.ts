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
import { commandNamed, commandsFor, type CommandId } from './commands';

const ALL: CommandId[] = ['new', 'model', 'summary', 'undo'];

const idsOf = (draft: string, available = ALL) =>
  commandsFor(draft, available).map(command => command.id);

test('a slash alone offers everything that can run, in a fixed order', () => {
  expect(idsOf('/')).toEqual(ALL);
  expect(idsOf('/', ['undo', 'new'])).toEqual(['new', 'undo']);
});

test('the menu narrows by the name in either language', () => {
  expect(idsOf('/nue')).toEqual(['new']);
  expect(idsOf('/ne')).toEqual(['new']);
  expect(idsOf('/res')).toEqual(['summary']);
  expect(idsOf('/su')).toEqual(['summary']);
  expect(idsOf('/DES')).toEqual(['undo']);
});

test('the menu stays closed for anything that is not a name being typed', () => {
  expect(idsOf('')).toEqual([]);
  expect(idsOf('hola /nuevo')).toEqual([]);
  expect(idsOf('/nuevo tablero')).toEqual([]);
  expect(idsOf('/ventas')).toEqual([]);
  expect(idsOf('/\n')).toEqual([]);
});

test('a command that cannot run stays out of the menu', () => {
  expect(idsOf('/des', ['new', 'model', 'summary'])).toEqual([]);
});

test.each([
  ['/nuevo', 'new'],
  ['/new', 'new'],
  ['/modelo', 'model'],
  ['/model', 'model'],
  ['/resumen', 'summary'],
  ['/summary', 'summary'],
  ['/deshacer', 'undo'],
  ['/undo', 'undo'],
  ['  /Nuevo\n', 'new'],
])('%s names a command in either language', (draft, id) => {
  expect(commandNamed(draft)).toBe(id);
});

test.each(['/', '/nue', '/nuevo tablero', 'nuevo', '/ventas del mes'])(
  '%s names no command, so it goes as a question',
  draft => {
    expect(commandNamed(draft)).toBeUndefined();
  },
);
