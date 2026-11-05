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
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { AssistantPanel } from './AssistantPanel';
import {
  askAssistant,
  AssistantError,
  fetchConversation,
  fetchConversations,
} from './client';
import type { AssistantEvent, Figure, OfferedModel } from './types';

jest.unmock('react-markdown');

jest.mock('./client', () => ({
  ...jest.requireActual('./client'),
  askAssistant: jest.fn(),
  fetchConversation: jest.fn(),
  fetchConversations: jest.fn(),
}));

jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: jest.fn(() => Promise.reject(new Error('403'))),
}));

const ask = askAssistant as jest.Mock;
const conversations = fetchConversations as jest.Mock;
const conversation = fetchConversation as jest.Mock;

const SONNET: OfferedModel = {
  id: 'claude-sonnet-5-5',
  name: 'Claude Sonnet 5.5',
  family: 'sonnet',
  price: 'balanced',
  default: true,
  tool_search: true,
  max_input_tokens: 1000,
};
const HAIKU: OfferedModel = {
  ...SONNET,
  id: 'claude-haiku-5-5',
  name: 'Claude Haiku 5.5',
  price: 'economy',
  default: false,
};

const FIGURE: Figure = {
  dataset_id: 7,
  dataset_name: 'ventas',
  metrics: ['total'],
  columns: ['region'],
  filters: [],
  order_by: [],
  order_desc: true,
  rows: [
    { region: 'Norte', total: 10 },
    { region: 'Sur', total: 4 },
  ],
  row_count: 2,
  from_dttm: null,
  to_dttm: null,
};

const initialState = {
  dashboardInfo: { id: 3 },
  dashboardLayout: {
    past: [],
    present: { 'TAB-1': { meta: { text: 'Ventas' } } },
    future: [],
  },
  dashboardState: { activeTabs: ['TAB-1'] },
  nativeFilters: {
    filters: {
      F: {
        name: 'Región',
        targets: [{ column: { name: 'region' }, datasetId: 7 }],
      },
    },
  },
  dataMask: { F: { filterState: { value: ['Norte'] } } },
};

const setup = (onClose = jest.fn()) =>
  render(<AssistantPanel open onClose={onClose} models={[SONNET, HAIKU]} />, {
    useRedux: true,
    initialState,
  });

const sendQuestion = async (text = '¿Cuánto vendimos?') => {
  await userEvent.type(screen.getByRole('textbox'), `${text}{enter}`);
};

/** A stream the test feeds by hand. */
const heldStream = () => {
  let emit: (event: AssistantEvent) => void = () => {};
  let signal: AbortSignal | undefined;
  let finish: () => void = () => {};
  ask.mockImplementation(
    (_question, onEvent, abortSignal) =>
      new Promise<void>((resolve, reject) => {
        emit = onEvent;
        signal = abortSignal;
        finish = resolve;
        abortSignal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }),
  );
  return {
    emit: (event: AssistantEvent) => act(() => emit(event)),
    end: () => act(async () => finish()),
    signal: () => signal,
  };
};

beforeEach(() => {
  ask.mockReset();
  conversation.mockReset();
  conversations.mockReset().mockResolvedValue([]);
});

test('sends the question with the page, the filters and the default model', async () => {
  ask.mockResolvedValue(undefined);
  setup();

  await sendQuestion();

  expect(screen.getByText('¿Cuánto vendimos?')).toBeInTheDocument();
  const [question] = ask.mock.calls[0];
  expect(question.message).toBe('¿Cuánto vendimos?');
  expect(question.model).toBe(SONNET.id);
  expect(question.mode).toBe('read');
  expect(question.conversation_id).toBeNull();
  expect(question.context).toEqual({
    dashboard_id: 3,
    page: 'Ventas',
    filters: {
      Región: { column: 'region', dataset_id: 7, value: ['Norte'] },
    },
  });
});

test('shows the tool in use, the text as it arrives and the figure', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  stream.emit({
    event: 'tool_start',
    data: { id: 't1', name: 'query_dataset' },
  });
  expect(screen.getByText('Querying the data…')).toBeInTheDocument();

  stream.emit({
    event: 'tool_end',
    data: { id: 't1', name: 'query_dataset', is_error: false, figure: FIGURE },
  });
  stream.emit({ event: 'text', data: { text: 'Ganó el Norte' } });

  expect(screen.getByText('Querying the data')).toBeInTheDocument();
  expect(await screen.findByText('Ganó el Norte')).toBeInTheDocument();
  expect(screen.getByText(/Dataset: ventas/)).toBeInTheDocument();
  await stream.end();
});

test('the next question goes on in the same conversation', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'read' },
  });
  await stream.end();

  await sendQuestion('¿Y ayer?');

  expect(ask.mock.calls[1][0].conversation_id).toBe('c1');
  await stream.end();
});

test('stopping aborts the stream, and so does closing the panel', async () => {
  const stream = heldStream();
  const { rerender } = setup();
  await sendQuestion();

  await userEvent.click(screen.getByTestId('auradata-assistant-stop'));

  expect(stream.signal()?.aborted).toBe(true);
  expect(
    await screen.findByText('You stopped this answer.'),
  ).toBeInTheDocument();

  await sendQuestion();
  rerender(
    <AssistantPanel open={false} onClose={jest.fn()} models={[SONNET]} />,
  );

  await waitFor(() => expect(stream.signal()?.aborted).toBe(true));
});

test('a stream that ends early shows why', async () => {
  ask.mockRejectedValue(new AssistantError('The answer was cut off.'));
  setup();

  await sendQuestion();

  expect(
    await screen.findByText('The answer was cut off.'),
  ).toBeInTheDocument();
});

test('warns when a change of model loses the cache', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  stream.emit({
    event: 'model_changed',
    data: { from: SONNET.id, to: HAIKU.id },
  });

  expect(
    screen.getByTestId('auradata-assistant-model-changed'),
  ).toBeInTheDocument();
  await stream.end();
});

test('asks for a new conversation when this one gets long', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  stream.emit({
    event: 'done',
    data: { model: SONNET.id, context_tokens: 900 },
  });
  await stream.end();

  expect(screen.getByTestId('auradata-assistant-long')).toBeInTheDocument();
});

test('lists only the read conversations and opens one', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'read', title: 'Ventas de marzo', model: SONNET.id },
    { id: 'c2', mode: 'edit', title: 'Del editor', model: SONNET.id },
  ]);
  conversation.mockResolvedValue({
    id: 'c1',
    model: HAIKU.id,
    figures: {},
    context_tokens: 10,
    messages: [
      {
        id: 'm1',
        role: 'user',
        stop_reason: null,
        content: [{ type: 'text', text: 'Hola' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Buenas' }],
      },
    ],
  });
  setup();

  const history = await screen.findByRole('combobox', {
    name: 'Conversations of this report',
  });
  await userEvent.click(history);
  expect(await screen.findByText('Ventas de marzo')).toBeInTheDocument();
  expect(screen.queryByText('Del editor')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('Ventas de marzo'));

  expect(await screen.findByText('Buenas')).toBeInTheDocument();
  expect(conversation).toHaveBeenCalledWith('c1');
});

test('the model selector marks the price and the default', async () => {
  setup();

  await userEvent.click(screen.getByRole('combobox', { name: 'Model' }));

  expect(
    await screen.findAllByText('Claude Sonnet 5.5 · Balanced · default'),
  ).not.toHaveLength(0);
  expect(screen.getByText('Claude Haiku 5.5 · Economical')).toBeInTheDocument();
});
