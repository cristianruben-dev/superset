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
import { layOutSheets, sheetPushes } from './sheets';

test('a piece that would fall across two sheets starts the next one', () => {
  const pushes = sheetPushes(
    [
      { top: 0, height: 80 },
      { top: 80, height: 40 },
      { top: 120, height: 30 },
    ],
    100,
  );

  expect([...pushes]).toEqual([[1, 20]]);
});

test('what follows a moved piece counts from where it landed', () => {
  const pushes = sheetPushes(
    [
      { top: 90, height: 20 },
      { top: 110, height: 85 },
      { top: 195, height: 20 },
    ],
    100,
  );

  expect([...pushes]).toEqual([
    [0, 10],
    [1, 80],
    [2, 15],
  ]);
});

test('a margin stays free at both ends of a sheet', () => {
  const pushes = sheetPushes([{ top: 60, height: 35 }], 100, 10);

  expect([...pushes]).toEqual([[0, 50]]);
});

test('a piece taller than a sheet stays: it can only be cut', () => {
  expect(sheetPushes([{ top: 50, height: 300 }], 100).size).toBe(0);
});

test('a block of data and the paragraphs of a text are the pieces', () => {
  const page = document.createElement('div');
  page.innerHTML = `
    <section data-sheet-unit></section>
    <div data-sheet-text><div><p></p><ul><li></li></ul></div></div>
    <section></section>`;
  const tops = new Map<Element, number>();
  [...page.querySelectorAll('[data-sheet-unit], p, li')].forEach(
    (item, index) => tops.set(item, index * 60),
  );
  jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function rect(this: Element) {
      return { top: tops.get(this) ?? 0, height: 60 } as DOMRect;
    });

  layOutSheets(page, 100);

  expect((page.querySelector('p') as HTMLElement).style.marginTop).toBe('40px');
  expect((page.querySelector('li') as HTMLElement).style.marginTop).toBe(
    '40px',
  );
  expect((page.querySelector('section') as HTMLElement).style.marginTop).toBe(
    '',
  );
});
