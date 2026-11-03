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
import { fireEvent, render, act } from 'spec/helpers/testing-library';
import ControlForm, { ControlFormRow, ControlFormItem } from './index';

test('quick edits to separate fields survive the same debounce window', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { getAllByRole, unmount } = render(
    <ControlForm value={{}} onChange={onChange}>
      <ControlFormRow>
        <ControlFormItem
          name="units"
          controlType="Input"
          label="Units"
          description=""
        />
        <ControlFormItem
          name="decimals"
          controlType="Input"
          label="Decimals"
          description=""
        />
      </ControlFormRow>
    </ControlForm>,
  );
  const inputs = getAllByRole('textbox');
  fireEvent.change(inputs[0], { target: { value: 'thousand' } });
  fireEvent.change(inputs[1], { target: { value: '0' } });
  act(() => jest.runOnlyPendingTimers());
  expect(onChange).toHaveBeenLastCalledWith({
    units: 'thousand',
    decimals: '0',
  });
  unmount();
  jest.useRealTimers();
});
