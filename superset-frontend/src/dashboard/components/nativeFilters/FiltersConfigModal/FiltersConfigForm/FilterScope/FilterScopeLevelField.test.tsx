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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { FilterScopeLevel } from '@superset-ui/core';
import { Form } from '@superset-ui/core/components';
import FilterScopeLevelField from './FilterScopeLevelField';

const renderField = (initialValue?: FilterScopeLevel) => {
  const onChange = jest.fn();
  render(
    <Form>
      <FilterScopeLevelField
        filterId="NATIVE_FILTER-1"
        initialValue={initialValue}
        onChange={onChange}
      />
    </Form>,
  );
  return onChange;
};

test('defaults to deriving the section automatically', () => {
  renderField();
  expect(screen.getByRole('radio', { name: 'Automatic' })).toBeChecked();
});

test('shows the saved section', () => {
  renderField(FilterScopeLevel.Page);
  expect(screen.getByRole('radio', { name: 'This page' })).toBeChecked();
});

test('notifies the form when the section changes', async () => {
  const onChange = renderField();
  await userEvent.click(screen.getByRole('radio', { name: 'All pages' }));
  expect(onChange).toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: 'All pages' })).toBeChecked();
});
