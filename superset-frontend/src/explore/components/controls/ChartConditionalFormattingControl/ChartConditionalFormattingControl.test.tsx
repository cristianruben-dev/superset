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
import ChartConditionalFormattingControl from '.';

test('adds a chart rule with sensible defaults', async () => {
  const onChange = jest.fn();
  render(
    <ChartConditionalFormattingControl label="Rules" onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /add rule/i }));
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      operator: '>',
      value: null,
      target: 'mark',
      series: null,
    }),
  ]);
});

test('adds an icon rule in the icon variant', async () => {
  const onChange = jest.fn();
  render(
    <ChartConditionalFormattingControl
      label="Icon rules"
      variant="icon"
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /add rule/i }));
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({ operator: '>', icon: '▲' }),
  ]);
});

test('edits and removes existing rules', async () => {
  const onChange = jest.fn();
  render(
    <ChartConditionalFormattingControl
      label="Rules"
      value={[{ operator: 'between', value: 1, value2: 5, color: '#ff0000' }]}
      onChange={onChange}
    />,
  );
  expect(
    screen.getAllByTestId('chart-conditional-formatting-rule'),
  ).toHaveLength(1);
  // "between" shows the upper bound input.
  expect(screen.getByLabelText('Upper value')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Remove rule' }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});
