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
import FontControl from '.';

test('renders the header and all font inputs', () => {
  render(<FontControl label="Title font" defaultFontSize={16} />);
  expect(screen.getByText('Title font')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toHaveAttribute('placeholder', '16');
  expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
  expect(screen.getByText('Theme font')).toBeInTheDocument();
});

test('toggles bold starting from the element default', async () => {
  const onChange = jest.fn();
  render(<FontControl label="Title font" defaultBold onChange={onChange} />);
  const bold = screen.getByRole('button', { name: 'Bold' });
  expect(bold).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(bold);
  expect(onChange).toHaveBeenCalledWith({ bold: false });
});

test('keeps existing values when toggling italic', async () => {
  const onChange = jest.fn();
  render(
    <FontControl
      label="Legend font"
      value={{ fontSize: 14, color: '#ff0000' }}
      onChange={onChange}
    />,
  );
  expect(screen.getByRole('spinbutton')).toHaveValue('14');
  await userEvent.click(screen.getByRole('button', { name: 'Italic' }));
  expect(onChange).toHaveBeenCalledWith({
    fontSize: 14,
    color: '#ff0000',
    italic: true,
  });
});

test('drops empty values when the size is cleared', async () => {
  const onChange = jest.fn();
  render(
    <FontControl label="Font" value={{ fontSize: 14 }} onChange={onChange} />,
  );
  await userEvent.clear(screen.getByRole('spinbutton'));
  expect(onChange).toHaveBeenLastCalledWith({});
});

test('can hide the family, weight and color inputs', () => {
  render(
    <FontControl
      label="Font"
      showFontFamily={false}
      showFontWeight={false}
      showColor={false}
    />,
  );
  expect(screen.queryByText('Theme font')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Bold' }),
  ).not.toBeInTheDocument();
});
