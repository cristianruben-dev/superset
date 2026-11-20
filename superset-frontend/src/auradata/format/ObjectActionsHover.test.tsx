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
import { act, fireEvent, render } from 'spec/helpers/testing-library';
import { ObjectActions } from './ObjectActions';

/** Two objects stacked with no gap, as they sit on the report grid. */
function renderPair() {
  const view = render(
    <>
      <div className="dashboard-component-chart-holder" data-test="holder-a">
        <ObjectActions id="A" onFormat={() => {}} formatTestId="format-a" />
      </div>
      <div className="dashboard-component-chart-holder" data-test="holder-b">
        <ObjectActions id="B" onFormat={() => {}} formatTestId="format-b" />
      </div>
    </>,
  );
  const rects: Record<string, Partial<DOMRect>> = {
    'holder-a': { top: 300, left: 100, right: 500, bottom: 500 },
    'holder-b': { top: 100, left: 100, right: 500, bottom: 300 },
  };
  Object.entries(rects).forEach(([testId, rect]) => {
    const holder = view.getByTestId(testId);
    holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  });
  return view;
}

const barOf = (view: ReturnType<typeof render>, id: 'a' | 'b') =>
  view.getByTestId(`format-${id}`).closest('.auradata-object-actions')!;

const visible = (bar: Element) => (bar as HTMLElement).style.visibility;

const flush = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('hovering an object shows its buttons', () => {
  const view = renderPair();
  fireEvent.pointerEnter(view.getByTestId('holder-a'));
  flush(20);
  expect(visible(barOf(view, 'a'))).toBe('visible');
  expect(visible(barOf(view, 'b'))).toBe('hidden');
});

test('crossing the object next to it on the way to the buttons keeps them', () => {
  const view = renderPair();
  const a = view.getByTestId('holder-a');
  const b = view.getByTestId('holder-b');
  fireEvent.pointerEnter(a);
  flush(20);
  // The bar sits above A, over B: the pointer passes through B to reach it
  fireEvent.pointerLeave(a);
  fireEvent.pointerEnter(b);
  // Slower than the time a bar waits after its object is left
  flush(300);
  expect(visible(barOf(view, 'a'))).toBe('visible');
  fireEvent.pointerLeave(b);
  fireEvent.pointerEnter(barOf(view, 'a'));
  flush(1000);
  expect(visible(barOf(view, 'a'))).toBe('visible');
  expect(visible(barOf(view, 'b'))).toBe('hidden');
});

test('crossing the next object into empty space hides the buttons', () => {
  const view = renderPair();
  const a = view.getByTestId('holder-a');
  const b = view.getByTestId('holder-b');
  fireEvent.pointerEnter(a);
  flush(20);
  fireEvent.pointerLeave(a);
  fireEvent.pointerEnter(b);
  flush(100);
  fireEvent.pointerLeave(b);
  flush(1000);
  expect(visible(barOf(view, 'a'))).toBe('hidden');
  expect(visible(barOf(view, 'b'))).toBe('hidden');
});

test('resting on the next object moves the buttons to it', () => {
  const view = renderPair();
  const a = view.getByTestId('holder-a');
  const b = view.getByTestId('holder-b');
  fireEvent.pointerEnter(a);
  flush(20);
  fireEvent.pointerLeave(a);
  fireEvent.pointerEnter(b);
  flush(1000);
  expect(visible(barOf(view, 'a'))).toBe('hidden');
  expect(visible(barOf(view, 'b'))).toBe('visible');
});

test('an open menu of the bar keeps it over any other object', () => {
  const view = renderPair();
  const a = view.getByTestId('holder-a');
  const b = view.getByTestId('holder-b');
  fireEvent.pointerEnter(a);
  flush(20);
  const menu = document.createElement('span');
  menu.className = 'ant-dropdown-open';
  barOf(view, 'a').appendChild(menu);
  fireEvent.pointerLeave(a);
  fireEvent.pointerEnter(b);
  flush(2000);
  expect(visible(barOf(view, 'a'))).toBe('visible');
  expect(visible(barOf(view, 'b'))).toBe('hidden');
  // Once the menu closes, the object under the pointer takes the buttons
  menu.remove();
  flush(1000);
  expect(visible(barOf(view, 'a'))).toBe('hidden');
  expect(visible(barOf(view, 'b'))).toBe('visible');
});

test('leaving every object hides the buttons', () => {
  const view = renderPair();
  const a = view.getByTestId('holder-a');
  fireEvent.pointerEnter(a);
  flush(20);
  fireEvent.pointerLeave(a);
  flush(1000);
  expect(visible(barOf(view, 'a'))).toBe('hidden');
});
