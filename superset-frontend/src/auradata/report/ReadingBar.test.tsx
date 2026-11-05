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
import { useAssistantModels } from '../assistant/useAssistant';
import { usePhoneScreen } from '../format/mobile';
import { ReadingBar } from './ReadingBar';

jest.mock('../assistant/useAssistant', () => ({
  useAssistantModels: jest.fn(),
}));

jest.mock('../assistant/AssistantPanel', () => ({
  AssistantPanel: ({ open }: { open: boolean }) => (
    <div data-test="panel">{open ? 'open' : 'closed'}</div>
  ),
}));

jest.mock('../format/mobile', () => ({
  ...jest.requireActual('../format/mobile'),
  usePhoneScreen: jest.fn(),
}));

const models = useAssistantModels as jest.Mock;
const phone = usePhoneScreen as jest.Mock;

const initialState = {
  dashboardLayout: { past: [], present: {}, future: [] },
};

const setup = () =>
  render(<ReadingBar onExport={jest.fn()} />, {
    useRedux: true,
    initialState,
  });

beforeEach(() => {
  phone.mockReturnValue(false);
  models.mockReturnValue([{ id: 'claude-sonnet-5-5' }]);
});

test('the assistant opens from the reading bar and closes with it', async () => {
  setup();
  expect(screen.queryByTestId('panel')).not.toBeInTheDocument();

  await userEvent.click(screen.getByTestId('auradata-assistant-button'));
  expect(screen.getByTestId('panel')).toHaveTextContent('open');

  await userEvent.click(screen.getByTestId('auradata-assistant-button'));
  expect(screen.getByTestId('panel')).toHaveTextContent('closed');
});

test('without models there is no assistant at all', () => {
  models.mockReturnValue([]);

  setup();

  expect(screen.getByTestId('auradata-reading-bar')).toBeInTheDocument();
  expect(
    screen.queryByTestId('auradata-assistant-button'),
  ).not.toBeInTheDocument();
});

test('a phone has no bar of commands but still reaches the assistant', async () => {
  phone.mockReturnValue(true);

  setup();

  expect(screen.queryByTestId('auradata-reading-bar')).not.toBeInTheDocument();
  await userEvent.click(screen.getByTestId('auradata-assistant-phone-button'));
  expect(screen.getByTestId('panel')).toHaveTextContent('open');
});

test('a phone shows nothing when the assistant is off', () => {
  phone.mockReturnValue(true);
  models.mockReturnValue([]);

  setup();

  expect(
    screen.queryByTestId('auradata-assistant-phone-button'),
  ).not.toBeInTheDocument();
});
