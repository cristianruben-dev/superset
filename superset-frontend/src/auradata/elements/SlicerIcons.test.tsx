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
import {
  createStore,
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { DataMaskStateWithId } from '@superset-ui/core';
import { SlicerIcons } from './SlicerIcons';

const maskOf = (store: { getState: () => unknown }) =>
  (store.getState() as { dataMask: DataMaskStateWithId }).dataMask.F1;

const renderIcons = (props: Partial<Parameters<typeof SlicerIcons>[0]>) => {
  const store = createStore(
    {
      dataMask: {
        F1: {
          id: 'F1',
          extraFormData: { filters: [{ col: 'a', op: 'IN', val: ['x'] }] },
          filterState: { value: ['x'] },
        },
      },
    },
    reducerIndex,
  );
  render(
    <SlicerIcons
      filterId="F1"
      config={{ kind: 'filter' }}
      format={undefined}
      {...props}
    />,
    { store },
  );
  return store;
};

test('the eraser clears what is chosen', () => {
  const store = renderIcons({});
  fireEvent.click(screen.getByRole('button', { name: 'Clear selections' }));
  expect(maskOf(store)?.extraFormData).toEqual({});
  expect(maskOf(store)?.filterState?.value).toBeNull();
});

test('the eraser can be turned off and the help text shown', () => {
  renderIcons({
    config: { kind: 'filter', showClear: false },
    format: { header: { tooltipIcon: true, tooltip: { text: 'Ayuda' } } },
  });
  expect(
    screen.queryByRole('button', { name: 'Clear selections' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Ayuda' })).toBeInTheDocument();
});
