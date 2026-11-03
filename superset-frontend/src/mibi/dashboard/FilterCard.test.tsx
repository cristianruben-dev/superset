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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { FilterCard } from './FilterCard';

beforeEach(() => window.localStorage.clear());

const card = (props: Partial<Parameters<typeof FilterCard>[0]> = {}) =>
  render(
    <FilterCard
      id="NATIVE_FILTER-1"
      name="Region"
      summary="is North"
      active
      actions={<button type="button">Clear</button>}
      {...props}
    >
      <div>control</div>
    </FilterCard>,
    { useTheme: true },
  );

test('a card shows its filter folded, with what it selects', () => {
  card();
  expect(screen.getByText('Region')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-filter-card-summary')).toHaveTextContent(
    'is North',
  );
  expect(screen.queryByText('control')).not.toBeInTheDocument();
  expect(screen.getByTestId('mibi-filter-card')).toHaveClass('is-on');
});

test('the head opens the card and the browser remembers it', () => {
  const { unmount } = card();
  fireEvent.click(screen.getByRole('button', { name: /Region/ }));
  expect(screen.getByText('control')).toBeInTheDocument();
  unmount();
  card();
  expect(screen.getByText('control')).toBeInTheDocument();
});

test('the actions of the head do not fold the card', () => {
  card();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.queryByText('control')).not.toBeInTheDocument();
});

test('a required filter without a value stays open', () => {
  card({ forceOpen: true, active: false });
  expect(screen.getByText('control')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-filter-card')).not.toHaveClass('is-on');
});
