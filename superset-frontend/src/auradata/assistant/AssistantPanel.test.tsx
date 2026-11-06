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
import reducerIndex from 'spec/helpers/reducerIndex';
import {
  act,
  createStore,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { setUnsavedChanges } from 'src/dashboard/actions/dashboardState';
import { AssistantChat, AssistantPanel } from './AssistantPanel';
import {
  askAssistant,
  AssistantError,
  clearFeedback,
  decideCall,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  renameConversation,
  saveFeedback,
  undoTurn,
} from './client';
import { reloadReport, saveReport } from './editorActions';
import type {
  AssistantAccess,
  AssistantEvent,
  Figure,
  OfferedModel,
} from './types';

jest.unmock('react-markdown');

jest.mock('./client', () => ({
  ...jest.requireActual('./client'),
  askAssistant: jest.fn(),
  decideCall: jest.fn(),
  fetchConversation: jest.fn(),
  fetchConversations: jest.fn(),
  renameConversation: jest.fn(),
  deleteConversation: jest.fn(),
  saveFeedback: jest.fn(),
  clearFeedback: jest.fn(),
  undoTurn: jest.fn(),
}));

jest.mock('./editorActions', () => ({
  reloadReport: jest.fn(() => () => Promise.resolve()),
  saveReport: jest.fn(() => () => undefined),
}));

jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: jest.fn(() => Promise.reject(new Error('403'))),
}));

const openFromList = async (title: string) => {
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Conversations of this report',
    }),
  );
  await userEvent.click(await screen.findByRole('button', { name: title }));
};

const ask = askAssistant as jest.Mock;
const decide = decideCall as jest.Mock;
const undo = undoTurn as jest.Mock;
const conversations = fetchConversations as jest.Mock;
const conversation = fetchConversation as jest.Mock;
const feedback = saveFeedback as jest.Mock;
const clearVote = clearFeedback as jest.Mock;

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

const accessOf = (
  models: OfferedModel[],
  overrides: Partial<AssistantAccess> = {},
): AssistantAccess => ({
  models,
  editModels: models,
  privacyAccepted: true,
  budget: { level: 'ok', scope: null },
  acceptPrivacy: jest.fn(() => Promise.resolve()),
  ...overrides,
});

const FIGURE: Figure = {
  dataset_id: 7,
  dataset_name: 'ventas',
  metrics: ['total'],
  columns: ['region'],
  filters: [],
  order_by: [],
  order_desc: true,
  row_limit: 1000,
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
  render(
    <AssistantPanel
      open
      onClose={onClose}
      access={accessOf([SONNET, HAIKU])}
    />,
    {
      useRedux: true,
      initialState,
    },
  );

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
  decide.mockReset().mockResolvedValue(undefined);
  undo.mockReset();
  feedback.mockReset().mockResolvedValue(undefined);
  clearVote.mockReset().mockResolvedValue(undefined);
  (reloadReport as jest.Mock).mockClear();
  (saveReport as jest.Mock).mockClear();
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
    <AssistantPanel
      open={false}
      onClose={jest.fn()}
      access={accessOf([SONNET])}
    />,
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

test('a conversation too long for the model names the cause and offers a new one', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  stream.emit({
    event: 'error',
    data: {
      code: 'context_exceeded',
      message: 'This conversation is too long for the model.',
    },
  });
  await stream.end();

  expect(
    screen.getByText('This conversation is too long for the model.'),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('auradata-assistant-context-new'));
  expect(screen.getByText('Ask about your data')).toBeInTheDocument();
});

test('the actions wait for the answer to end', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  stream.emit({ event: 'text', data: { text: 'Vendimos' } });
  expect(
    screen.queryByTestId('auradata-assistant-actions'),
  ).not.toBeInTheDocument();

  stream.emit({
    event: 'done',
    data: { context_tokens: 10, message_id: 'stored-1' },
  });
  await stream.end();

  expect(screen.getByTestId('auradata-assistant-actions')).toBeInTheDocument();
});

test('a card pending under an answer keeps its actions away', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  stream.emit({ event: 'text', data: { text: 'Voy a borrar' } });
  stream.emit({
    event: 'confirm',
    data: { id: 't1', name: 'delete_chart', title: 'Borrar', input: {} },
  });
  stream.emit({
    event: 'done',
    data: { context_tokens: 10, message_id: 'stored-1' },
  });
  await stream.end();

  expect(
    screen.queryByTestId('auradata-assistant-actions'),
  ).not.toBeInTheDocument();
});

test('a vote goes on the stored answer, and a refused one goes back', async () => {
  const stream = heldStream();
  feedback.mockRejectedValueOnce(new Error('500'));
  setup();
  await sendQuestion();
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'read' },
  });
  stream.emit({ event: 'text', data: { text: 'Vendimos' } });
  stream.emit({
    event: 'done',
    data: { context_tokens: 10, message_id: 'stored-1' },
  });
  await stream.end();

  const up = screen.getByRole('button', { name: 'Helpful' });
  await userEvent.click(up);

  expect(feedback).toHaveBeenCalledWith('c1', 'stored-1', { vote: 'up' });
  await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'false'));

  await userEvent.click(up);

  await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'));
  await userEvent.click(up);
  expect(clearVote).toHaveBeenCalledWith('c1', 'stored-1');
});

test('voting leaves the conversation where it was scrolled', async () => {
  const stream = heldStream();
  const scroll = jest.fn();
  Element.prototype.scrollIntoView = scroll;
  setup();
  await sendQuestion();
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'read' },
  });
  stream.emit({ event: 'text', data: { text: 'Vendimos' } });
  stream.emit({
    event: 'done',
    data: { context_tokens: 10, message_id: 'stored-1' },
  });
  await stream.end();
  expect(scroll).toHaveBeenCalled();
  scroll.mockClear();

  const up = screen.getByRole('button', { name: 'Helpful' });
  await userEvent.click(up);
  await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'));

  expect(scroll).not.toHaveBeenCalled();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

test('a stored vote comes back with its conversation', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'read', title: 'Ventas de marzo', model: SONNET.id },
  ]);
  conversation.mockResolvedValue({
    id: 'c1',
    model: SONNET.id,
    figures: {},
    context_tokens: 10,
    feedback: { m2: { vote: 'up', reason: null } },
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

  await openFromList('Ventas de marzo');

  expect(
    await screen.findByRole('button', { name: 'Helpful' }),
  ).toHaveAttribute('aria-pressed', 'true');
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

  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Conversations of this report',
    }),
  );
  expect(await screen.findByText('Ventas de marzo')).toBeInTheDocument();
  expect(screen.queryByText('Del editor')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('Ventas de marzo'));

  expect(await screen.findByText('Buenas')).toBeInTheDocument();
  expect(conversation).toHaveBeenCalledWith('c1');
});

test('deleting the open conversation goes back to an empty one', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'read', title: 'Ventas de marzo', model: SONNET.id },
    { id: 'c3', mode: 'read', title: 'Otra', model: SONNET.id },
  ]);
  conversation.mockResolvedValue({
    id: 'c1',
    model: SONNET.id,
    figures: {},
    context_tokens: 10,
    messages: [
      {
        id: 'm1',
        role: 'user',
        stop_reason: null,
        content: [{ type: 'text', text: 'Hola' }],
      },
    ],
  });
  (deleteConversation as jest.Mock).mockResolvedValue(undefined);
  setup();
  await openFromList('Ventas de marzo');
  expect(await screen.findByText('Hola')).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: 'Conversations of this report' }),
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'Delete «Ventas de marzo»' }),
  );
  await userEvent.click(
    await screen.findByTestId('auradata-assistant-delete-confirm'),
  );

  await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith('c1'));
  expect(
    await screen.findByRole('button', { name: 'Otra' }),
  ).toBeInTheDocument();
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Search conversations' }),
    '{esc}',
  );
  expect(screen.queryByText('Hola')).not.toBeInTheDocument();
  expect(screen.getByText('Ask about your data')).toBeInTheDocument();
});

test('a rename shows in the list and over the open conversation', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'read', title: 'Ventas de marzo', model: SONNET.id },
  ]);
  (renameConversation as jest.Mock).mockResolvedValue({});
  setup();
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Conversations of this report',
    }),
  );

  await userEvent.click(
    await screen.findByRole('button', { name: 'Rename «Ventas de marzo»' }),
  );
  const title = screen.getByRole('textbox', { name: 'Conversation title' });
  await userEvent.clear(title);
  await userEvent.type(title, 'Abril{enter}');

  expect(
    await screen.findByRole('button', { name: 'Abril' }),
  ).toBeInTheDocument();
  expect(renameConversation).toHaveBeenCalledWith('c1', 'Abril');
});

test('a conversation that no longer opens says so and leaves the list', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'read', title: 'Ventas de marzo', model: SONNET.id },
  ]);
  conversation.mockRejectedValue(new Response(null, { status: 404 }));
  setup();

  await openFromList('Ventas de marzo');

  await waitFor(() =>
    expect(conversations.mock.calls.length).toBeGreaterThan(1),
  );
});

test('the model selector marks the price and the default', async () => {
  setup();

  await userEvent.click(screen.getByRole('combobox', { name: 'Model' }));

  expect(
    await screen.findAllByText('Claude Sonnet 5.5 · Balanced · default'),
  ).not.toHaveLength(0);
  expect(screen.getByText('Claude Haiku 5.5 · Economical')).toBeInTheDocument();
});

const editorState = (unsaved = false) => ({
  ...initialState,
  dashboardState: {
    ...initialState.dashboardState,
    hasUnsavedChanges: unsaved,
  },
});

const setupEditor = (unsaved = false) =>
  render(<AssistantChat mode="edit" access={accessOf([SONNET])} active />, {
    useRedux: true,
    initialState: editorState(unsaved),
  });

const CONFIRMATION = {
  id: 'toolu_1',
  name: 'delete_page',
  title: 'Delete page',
  input: { request: { page: '<b>Ventas</b>' } },
};

const askAndGetCard = async () => {
  setupEditor();
  const stream = heldStream();
  await sendQuestion('Borra la página');
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'edit' },
  });
  stream.emit({ event: 'confirm', data: CONFIRMATION });
  stream.emit({
    event: 'done',
    data: { context_tokens: 10, can_undo: false },
  });
  await stream.end();
};

test('the editor sends the page, the selection and the edit mode', async () => {
  setupEditor();
  ask.mockResolvedValue(undefined);

  await sendQuestion('Ponle borde a este gráfico');

  await waitFor(() => expect(ask).toHaveBeenCalled());
  const [question] = ask.mock.calls[0];
  expect(question.mode).toBe('edit');
  expect(question.context.page_id).toBeDefined();
});

test('a card shows the call as plain text and runs nothing by itself', async () => {
  await askAndGetCard();

  const card = await screen.findByTestId('auradata-assistant-confirmation');
  expect(card).toHaveTextContent('Delete a page');
  expect(
    screen.getByTestId('auradata-assistant-confirmation-details'),
  ).toHaveTextContent('<b>Ventas</b>');
  expect(card.querySelector('b')).toBeNull();
  expect(decide).not.toHaveBeenCalled();
});

test('approving sends the id of the call and nothing about what it does', async () => {
  await askAndGetCard();

  await userEvent.click(
    await screen.findByTestId('auradata-assistant-approve'),
  );

  await waitFor(() => expect(decide).toHaveBeenCalled());
  expect(decide.mock.calls[0].slice(0, 2)).toEqual([
    'c1',
    { tool_use_id: 'toolu_1', approved: true, model: SONNET.id },
  ]);
  expect(
    screen.queryByTestId('auradata-assistant-confirmation'),
  ).not.toBeInTheDocument();
});

test('rejecting says so to the server', async () => {
  await askAndGetCard();

  await userEvent.click(await screen.findByTestId('auradata-assistant-reject'));

  await waitFor(() => expect(decide).toHaveBeenCalled());
  expect(decide.mock.calls[0][1].approved).toBe(false);
});

test('a card of a stored conversation comes back', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'edit', title: 'Del editor', model: SONNET.id },
  ]);
  conversation.mockResolvedValue({
    id: 'c1',
    mode: 'edit',
    model: SONNET.id,
    title: 'Del editor',
    messages: [],
    figures: {},
    context_tokens: 0,
    pending: [CONFIRMATION],
    rejected: [],
    can_undo: false,
  });
  setupEditor();

  await openFromList('Del editor');

  expect(
    await screen.findByTestId('auradata-assistant-confirmation'),
  ).toBeInTheDocument();
});

test('with unsaved changes it asks to save or discard and sends nothing', async () => {
  setupEditor(true);

  expect(screen.getByTestId('auradata-assistant-unsaved')).toBeInTheDocument();
  await sendQuestion('Hazlo');
  expect(ask).not.toHaveBeenCalled();

  await userEvent.click(screen.getByTestId('auradata-assistant-save'));
  expect(saveReport).toHaveBeenCalled();
  await userEvent.click(screen.getByTestId('auradata-assistant-discard'));
  expect(reloadReport).toHaveBeenCalled();
});

test('a card waits for the changes to be saved too', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'edit', title: 'Del editor', model: SONNET.id },
  ]);
  conversation.mockResolvedValue({
    id: 'c1',
    mode: 'edit',
    model: SONNET.id,
    title: 'Del editor',
    messages: [],
    figures: {},
    context_tokens: 0,
    pending: [CONFIRMATION],
    rejected: [],
    can_undo: false,
  });
  setupEditor(true);

  await openFromList('Del editor');

  expect(
    await screen.findByTestId('auradata-assistant-approve'),
  ).toBeDisabled();
});

test('the editor reloads when an answer changed the report, and offers undo', async () => {
  setupEditor();
  const stream = heldStream();
  await sendQuestion('Agrega una página');
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'edit' },
  });
  stream.emit({ event: 'tool_start', data: { id: 't', name: 'add_page' } });
  stream.emit({
    event: 'tool_end',
    data: { id: 't', name: 'add_page', is_error: false, changed: true },
  });
  stream.emit({ event: 'done', data: { context_tokens: 10, can_undo: true } });
  expect(reloadReport).not.toHaveBeenCalled();
  await stream.end();

  await waitFor(() => expect(reloadReport).toHaveBeenCalledTimes(1));

  undo.mockResolvedValue({ skipped_charts: 0, can_undo: false });
  await userEvent.click(screen.getByTestId('auradata-assistant-undo'));

  await waitFor(() => expect(undo).toHaveBeenCalledWith('c1'));
  await waitFor(() => expect(reloadReport).toHaveBeenCalledTimes(2));
  expect(
    screen.queryByTestId('auradata-assistant-undo'),
  ).not.toBeInTheDocument();
});

test('changes made on the canvas during an answer are not thrown away', async () => {
  const store = createStore(editorState(), reducerIndex);
  render(<AssistantChat mode="edit" access={accessOf([SONNET])} active />, {
    store,
  });
  const stream = heldStream();
  await sendQuestion('Agrega una página');
  stream.emit({
    event: 'tool_end',
    data: { id: 't', name: 'add_page', is_error: false, changed: true },
  });
  act(() => {
    store.dispatch(setUnsavedChanges(true));
  });
  await stream.end();

  await waitFor(() => expect(ask).toHaveBeenCalled());
  expect(reloadReport).not.toHaveBeenCalled();
  expect(
    await screen.findByTestId('auradata-assistant-unsaved'),
  ).toBeInTheDocument();
});

test('an answer that changed nothing does not reload the editor', async () => {
  setupEditor();
  const stream = heldStream();
  await sendQuestion('¿Qué hay aquí?');
  stream.emit({ event: 'text', data: { text: 'Un gráfico' } });
  stream.emit({ event: 'done', data: { context_tokens: 10 } });
  await stream.end();

  await waitFor(() => expect(ask).toHaveBeenCalled());
  expect(reloadReport).not.toHaveBeenCalled();
});

test('a refused undo shows why', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'edit', title: 'Del editor', model: SONNET.id },
  ]);
  conversation.mockResolvedValue({
    id: 'c1',
    mode: 'edit',
    model: SONNET.id,
    title: 'Del editor',
    messages: [],
    figures: {},
    context_tokens: 0,
    pending: [],
    rejected: [],
    can_undo: true,
  });
  undo.mockRejectedValue(new AssistantError('Cambió después'));
  setupEditor();
  await openFromList('Del editor');

  await userEvent.click(await screen.findByTestId('auradata-assistant-undo'));

  await waitFor(() => expect(undo).toHaveBeenCalled());
  expect(reloadReport).not.toHaveBeenCalled();
});

test('the first time it says what is sent and sends nothing until accepted', async () => {
  const acceptPrivacy = jest.fn(() => Promise.resolve());
  render(
    <AssistantChat
      mode="read"
      access={accessOf([SONNET], { privacyAccepted: false, acceptPrivacy })}
      active
    />,
    { useRedux: true, useRouter: true, initialState },
  );

  expect(screen.getByTestId('auradata-assistant-privacy')).toHaveTextContent(
    'data rows included',
  );
  expect(screen.queryByTestId('auradata-assistant-input')).toBeNull();
  expect(conversations).not.toHaveBeenCalled();

  await userEvent.click(screen.getByTestId('auradata-assistant-accept'));

  expect(acceptPrivacy).toHaveBeenCalledTimes(1);
  expect(ask).not.toHaveBeenCalled();
});

test('near the limit it warns and still answers', async () => {
  render(
    <AssistantChat
      mode="read"
      access={accessOf([SONNET], {
        budget: { level: 'warning', scope: 'workspace' },
      })}
      active
    />,
    { useRedux: true, useRouter: true, initialState },
  );

  expect(
    await screen.findByTestId('auradata-assistant-budget'),
  ).toHaveTextContent('This workspace is close to its assistant budget');
  expect(screen.getByTestId('auradata-assistant-input')).toBeEnabled();
});

test('at the limit it says so and takes no new message', async () => {
  render(
    <AssistantChat
      mode="read"
      access={accessOf([SONNET], {
        budget: { level: 'stopped', scope: 'global' },
      })}
      active
    />,
    { useRedux: true, useRouter: true, initialState },
  );

  expect(
    await screen.findByTestId('auradata-assistant-budget'),
  ).toHaveTextContent('The assistant used up its budget for the month');
  expect(screen.getByTestId('auradata-assistant-input')).toBeDisabled();
  expect(screen.getByTestId('auradata-assistant-send')).toBeDisabled();
});

test('the end of an answer updates the notice of the month', async () => {
  ask.mockImplementation(async (_question, onEvent) => {
    onEvent({
      event: 'done',
      data: {
        context_tokens: 1,
        budget: { level: 'stopped', scope: 'global' },
      },
    });
  });
  render(<AssistantChat mode="read" access={accessOf([SONNET])} active />, {
    useRedux: true,
    useRouter: true,
    initialState,
  });

  await sendQuestion();

  expect(
    await screen.findByTestId('auradata-assistant-budget'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('auradata-assistant-input')).toBeDisabled();
});

test('the notes of the model show among its steps and fold when it ends', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();
  expect(screen.getByText('Thinking…')).toBeInTheDocument();

  stream.emit({ event: 'note', data: { text: 'Miro', starts: true } });
  stream.emit({ event: 'note', data: { text: ' las ventas.', starts: false } });

  expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
  const note = screen.getByTestId('auradata-assistant-note');
  expect(note).toHaveTextContent('Miro las ventas.');
  expect(note.closest('details')).toBeNull();

  stream.emit({
    event: 'tool_start',
    data: { id: 't1', name: 'query_dataset' },
  });
  stream.emit({
    event: 'tool_end',
    data: { id: 't1', name: 'query_dataset', is_error: false },
  });
  stream.emit({ event: 'text', data: { text: 'Cien' } });
  await stream.end();

  const fold = (await screen.findByText('2 steps')).closest('details');
  expect(fold).not.toHaveAttribute('open');
  expect(fold).toContainElement(screen.getByTestId('auradata-assistant-note'));
});

test('an answer with notes and no tools folds them too', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  stream.emit({ event: 'note', data: { text: 'Lo pienso.', starts: true } });
  stream.emit({ event: 'text', data: { text: 'Cien' } });
  await stream.end();

  expect(await screen.findByText('1 step')).toBeInTheDocument();
});

test('what the model writes in a note stays plain text', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();

  const markup =
    '<img src="https://example.com/x.png"> **negrita** [a](https://example.com)';
  stream.emit({ event: 'note', data: { text: markup, starts: true } });

  const note = screen.getByTestId('auradata-assistant-note');
  expect(note.textContent).toBe(markup);
  expect(note.children).toHaveLength(0);
});
