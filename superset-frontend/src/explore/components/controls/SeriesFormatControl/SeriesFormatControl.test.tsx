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
  fireEvent,
  render,
  screen,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import SeriesFormatControl from '.';

test('keeps only what a series changes', async () => {
  const onChange = jest.fn();
  render(
    <SeriesFormatControl
      name="series_format"
      seriesNames={['A', 'B']}
      fields={['lines']}
      onChange={onChange}
    />,
  );
  await selectOption('A', 'Series');
  const width = await screen.findByRole('spinbutton', { name: 'Line width' });
  fireEvent.change(width, { target: { value: '4' } });
  fireEvent.blur(width);
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({ A: { lineWidth: 4 } }),
  );
});

test('forgets a series when its last option is cleared', async () => {
  const onChange = jest.fn();
  render(
    <SeriesFormatControl
      name="series_format"
      value={{ A: { lineWidth: 4 } }}
      seriesNames={['A']}
      fields={['lines']}
      onChange={onChange}
    />,
  );
  await selectOption('A •', 'Series');
  const width = await screen.findByRole('spinbutton', { name: 'Line width' });
  fireEvent.change(width, { target: { value: '' } });
  fireEvent.blur(width);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({}));
});

test('asks to run the chart when it has no series', () => {
  render(<SeriesFormatControl name="series_format" />);
  expect(
    screen.getByText('Run the chart to list its series'),
  ).toBeInTheDocument();
});
