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
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { setUnsavedChanges } from 'src/dashboard/actions/dashboardState';
import * as mobile from '../format/mobile';
import { AssistantChat, AssistantPanel } from './AssistantPanel';
import {
  askAssistant,
  AssistantError,
  clearFeedback,
  decideCall,
  fetchArtifact,
  readTurn,
  stopTurn,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  renameConversation,
  saveFeedback,
  undoTurn,
  uploadAttachment,
  deleteAttachment,
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
  readTurn: jest.fn(),
  stopTurn: jest.fn(() => Promise.resolve()),
  fetchConversation: jest.fn(),
  fetchConversations: jest.fn(),
  renameConversation: jest.fn(),
  deleteConversation: jest.fn(),
  saveFeedback: jest.fn(),
  clearFeedback: jest.fn(),
  undoTurn: jest.fn(),
  uploadAttachment: jest.fn(),
  deleteAttachment: jest.fn(() => Promise.resolve()),
  fetchArtifact: jest.fn(),
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
const upload = uploadAttachment as jest.Mock;
const removeUpload = deleteAttachment as jest.Mock;

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
const storedConversation = (id: string, running: { after: number } | null) => ({
  id,
  dashboard_id: 3,
  mode: 'read',
  model: SONNET.id,
  title: 'Hola',
  changed_on: '2026-11-06',
  messages: [
    {
      id: 'm1',
      seq: 0,
      role: 'user',
      content: [{ type: 'text', text: 'Hola' }],
      stop_reason: null,
    },
  ],
  figures: {},
  context_tokens: 0,
  pending: [],
  rejected: [],
  can_undo: false,
  feedback: {},
  running,
});

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
  window.sessionStorage.clear();
  (readTurn as jest.Mock).mockReset().mockResolvedValue(undefined);
  (stopTurn as jest.Mock).mockClear();
  ask.mockReset();
  decide.mockReset().mockResolvedValue(undefined);
  undo.mockReset();
  feedback.mockReset().mockResolvedValue(undefined);
  clearVote.mockReset().mockResolvedValue(undefined);
  (reloadReport as jest.Mock).mockClear();
  (saveReport as jest.Mock).mockClear();
  conversation.mockReset();
  conversations.mockReset().mockResolvedValue([]);
  upload.mockReset();
  removeUpload.mockClear();
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

test('stopping asks the server and keeps reading until the answer says so', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'read' },
  });

  await userEvent.click(screen.getByTestId('auradata-assistant-stop'));

  expect(stopTurn).toHaveBeenCalledWith('c1');
  expect(stream.signal()?.aborted).toBe(false);

  stream.emit({
    event: 'done',
    data: { context_tokens: 0, stop_reason: 'interrupted' },
  });
  stream.emit({ event: 'turn_end', data: {} });
  await stream.end();

  expect(
    await screen.findByText('You stopped this answer.'),
  ).toBeInTheDocument();
});

test('closing the panel only stops reading, and opening it reads on', async () => {
  const stream = heldStream();
  const { rerender } = setup();
  await sendQuestion();
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'read' },
  });
  conversation.mockResolvedValue(storedConversation('c1', { after: 2 }));

  rerender(
    <AssistantPanel
      open={false}
      onClose={jest.fn()}
      access={accessOf([SONNET])}
    />,
  );

  await waitFor(() => expect(stream.signal()?.aborted).toBe(true));
  expect(stopTurn).not.toHaveBeenCalled();

  rerender(
    <AssistantPanel open onClose={jest.fn()} access={accessOf([SONNET])} />,
  );

  await waitFor(() =>
    expect(readTurn).toHaveBeenCalledWith(
      'c1',
      2,
      expect.any(Function),
      expect.any(AbortSignal),
    ),
  );
});

test('a reader the stream left behind ends with what the server stored', async () => {
  const stream = heldStream();
  setup();
  await sendQuestion();
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'read' },
  });
  conversation.mockResolvedValue(storedConversation('c1', null));

  stream.emit({ event: 'trimmed', data: {} });
  stream.emit({ event: 'turn_end', data: {} });
  await stream.end();

  await waitFor(() => expect(conversation).toHaveBeenCalledWith('c1'));
});

test('a reload comes back to the conversation that was open', async () => {
  window.sessionStorage.setItem('auradata.assistant.conversation.3.read', 'c7');
  conversation.mockResolvedValue(storedConversation('c7', null));

  setup();

  await waitFor(() => expect(conversation).toHaveBeenCalledWith('c7'));
  expect(readTurn).not.toHaveBeenCalled();
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

  stream.emit({
    event: 'note',
    data: { text: 'Lo pienso.\n\n', starts: true },
  });
  stream.emit({ event: 'text', data: { text: 'Cien' } });
  await stream.end();

  expect(await screen.findByText('1 step')).toBeInTheDocument();
  expect(screen.getByTestId('auradata-assistant-note').textContent).toBe(
    'Lo pienso.',
  );
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

const image = (name = 'captura.png', type = 'image/png') =>
  new File(['pixels'], name, { type });

const uploaded = (id: string) => ({
  id,
  media_type: 'image/png',
  width: 10,
  height: 10,
});

const composer = async () =>
  (await screen.findByTestId('auradata-assistant-input')).closest(
    'form',
  ) as HTMLFormElement;

const paste = async (files: File[], text = '') =>
  fireEvent.paste(await composer(), {
    clipboardData: { files, getData: () => text },
  });

test('a pasted image shows from the server and goes with the message', async () => {
  upload.mockResolvedValue(uploaded('i1'));
  ask.mockImplementation(async (_question, onEvent) => {
    onEvent({ event: 'text', data: { text: 'Es azul' } });
    onEvent({ event: 'done', data: { context_tokens: 1 } });
  });
  setup();

  await paste([image()]);

  const thumbnail = await screen.findByRole('img', { name: 'captura.png' });
  expect(thumbnail.getAttribute('src')).toContain(
    '/api/v1/auradata/assistant/attachments/i1/',
  );

  await userEvent.type(
    screen.getByTestId('auradata-assistant-input'),
    '¿Qué ves?',
  );
  await userEvent.click(screen.getByTestId('auradata-assistant-send'));

  expect(ask.mock.calls[0][0]).toMatchObject({
    message: '¿Qué ves?',
    attachments: ['i1'],
  });
  expect(screen.queryByTestId('auradata-assistant-image')).toBeNull();
  const sent = await screen.findByRole('img', { name: 'Attached image' });
  expect(sent.getAttribute('src')).toContain('/attachments/i1/');
});

test('text pasted with a picture of it stays text', async () => {
  setup();

  await paste([image()], 'Norte\t10');

  expect(upload).not.toHaveBeenCalled();
});

test('an image dropped on the panel uploads, and other drags are left alone', async () => {
  upload.mockResolvedValue(uploaded('i2'));
  setup();
  const form = await composer();

  fireEvent.drop(form, {
    dataTransfer: { types: ['text/plain'], files: [] },
  });
  expect(upload).not.toHaveBeenCalled();

  fireEvent.dragOver(form, {
    dataTransfer: { types: ['Files'], files: [] },
  });
  expect(form).toHaveAttribute('data-dropping', 'true');
  fireEvent.drop(form, {
    dataTransfer: { types: ['Files'], files: [image()] },
  });

  expect(form).toHaveAttribute('data-dropping', 'false');
  expect(upload).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByRole('img', { name: 'captura.png' }),
  ).toBeInTheDocument();
});

test('a chosen file uploads', async () => {
  upload.mockResolvedValue(uploaded('i3'));
  setup();

  await userEvent.upload(
    await screen.findByTestId('auradata-assistant-file'),
    image(),
  );

  expect(
    await screen.findByRole('img', { name: 'captura.png' }),
  ).toBeInTheDocument();
});

test('removing an image takes it out of the message and off the server', async () => {
  upload.mockResolvedValue(uploaded('i4'));
  setup();
  await paste([image()]);

  await userEvent.click(
    await screen.findByRole('button', { name: 'Remove image captura.png' }),
  );

  expect(screen.queryByTestId('auradata-assistant-image')).toBeNull();
  expect(removeUpload).toHaveBeenCalledWith('i4');
  expect(screen.getByTestId('auradata-assistant-send')).toBeDisabled();
});

test('an image alone can be sent, but not while it uploads', async () => {
  let finish: (value: ReturnType<typeof uploaded>) => void = () => undefined;
  upload.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  ask.mockImplementation(async (_question, onEvent) => {
    onEvent({ event: 'done', data: { context_tokens: 1 } });
  });
  setup();
  await paste([image()]);

  expect(
    await screen.findByLabelText('Uploading captura.png'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('auradata-assistant-send')).toBeDisabled();

  await act(async () => finish(uploaded('i5')));
  await userEvent.click(screen.getByTestId('auradata-assistant-send'));

  expect(ask.mock.calls[0][0]).toMatchObject({
    message: '',
    attachments: ['i5'],
  });
});

test('a conversation read later shows its images', async () => {
  conversations.mockResolvedValue([
    { id: 'c1', mode: 'read', title: 'Ventas', model: SONNET.id },
  ]);
  conversation.mockResolvedValue({
    id: 'c1',
    model: SONNET.id,
    figures: {},
    context_tokens: 10,
    messages: [
      {
        id: 'u1',
        role: 'user',
        content: [
          { type: 'auradata_attachment', id: 'i6' },
          { type: 'text', text: '<page_context>{}</page_context>' },
        ],
      },
    ],
  });
  setup();

  await openFromList('Ventas');

  const sent = await screen.findByRole('img', { name: 'Attached image' });
  expect(sent.getAttribute('src')).toContain('/attachments/i6/');
});

const questionBox = () => screen.getByTestId('auradata-assistant-input');
const commandMenu = () => screen.queryByRole('listbox', { name: 'Commands' });
const finishedAnswer = () => {
  ask.mockImplementation(async (_question, onEvent) => {
    onEvent({ event: 'text', data: { text: 'Listo' } });
    onEvent({ event: 'done', data: { context_tokens: 1 } });
  });
};

test('a slash opens a list the keyboard can use', async () => {
  setup();

  await userEvent.type(questionBox(), '/');

  const options = screen.getAllByRole('option');
  expect(options.map(option => option.textContent)).toEqual([
    '/modelChoose the model',
    '/summaryAsk for a summary of this page',
  ]);
  expect(questionBox()).toHaveAttribute('aria-controls', commandMenu()?.id);
  expect(questionBox()).toHaveAttribute('aria-activedescendant', options[0].id);
  expect(options[0]).toHaveAttribute('aria-selected', 'true');

  await userEvent.type(questionBox(), '{arrowdown}');
  expect(questionBox()).toHaveAttribute('aria-activedescendant', options[1].id);
  await userEvent.type(questionBox(), '{arrowdown}');
  expect(questionBox()).toHaveAttribute('aria-activedescendant', options[0].id);
  await userEvent.type(questionBox(), '{arrowup}');
  expect(questionBox()).toHaveAttribute('aria-activedescendant', options[1].id);
});

test('/summary and /resumen send a plain question, never a command', async () => {
  finishedAnswer();
  setup();

  await userEvent.type(questionBox(), '/resumen{enter}');

  await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
  expect(ask.mock.calls[0][0].message).toBe('Summarize this page');
  expect(questionBox()).toHaveValue('');
  expect(commandMenu()).toBeNull();
});

test('Escape closes the list and leaves the panel and the text alone', async () => {
  finishedAnswer();
  const onClose = jest.fn();
  setup(onClose);

  await userEvent.type(questionBox(), '/res');
  await userEvent.type(questionBox(), '{esc}');

  expect(commandMenu()).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  expect(questionBox()).toHaveValue('/res');

  await userEvent.type(questionBox(), 'ultado{enter}');
  await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
  expect(ask.mock.calls[0][0].message).toBe('/resultado');
});

test('a message that only starts with a slash goes as a question', async () => {
  finishedAnswer();
  setup();

  await sendQuestion('/ventas del mes');

  await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
  expect(ask.mock.calls[0][0].message).toBe('/ventas del mes');
});

test('a command after Escape still does not reach the model', async () => {
  finishedAnswer();
  setup();

  await userEvent.type(questionBox(), '/resumen{esc}{enter}');

  await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
  expect(ask.mock.calls[0][0].message).toBe('Summarize this page');
});

test('a command that cannot run here stays out of the list and of the model', async () => {
  setup();

  await userEvent.type(questionBox(), '/deshacer');
  expect(commandMenu()).toBeNull();
  await userEvent.type(questionBox(), '{enter}');

  expect(ask).not.toHaveBeenCalled();
  expect(questionBox()).toHaveValue('/deshacer');
});

test('/nuevo leaves the conversation, as the button does', async () => {
  finishedAnswer();
  setup();
  await sendQuestion('¿Cuánto vendimos?');
  expect(await screen.findByText('Listo')).toBeInTheDocument();

  await userEvent.type(questionBox(), '/nuevo{enter}');

  await waitFor(() => expect(screen.queryByText('Listo')).toBeNull());
  expect(ask).toHaveBeenCalledTimes(1);
  expect(questionBox()).toHaveValue('');
});

test('/new is not offered while there is nothing to leave or an answer runs', async () => {
  setup();
  await userEvent.type(questionBox(), '/ne');
  expect(commandMenu()).toBeNull();
  await userEvent.clear(questionBox());

  const stream = heldStream();
  await sendQuestion('¿Cuánto vendimos?');
  await userEvent.type(questionBox(), '/');

  expect(commandMenu()).toBeNull();
  await stream.end();
});

test('/modelo opens the list of models and a choice goes back to the question', async () => {
  setup();

  await userEvent.type(questionBox(), '/modelo{enter}');

  const models = await screen.findByRole('combobox', { name: 'Model' });
  await waitFor(() => expect(models).toHaveAttribute('aria-expanded', 'true'));
  expect(ask).not.toHaveBeenCalled();
  expect(questionBox()).toHaveValue('');

  await userEvent.click(await screen.findByText(/Claude Haiku 5\.5 ·/));

  await waitFor(() => expect(questionBox()).toHaveFocus());
  await sendQuestion('¿Cuánto?');
  expect(ask.mock.calls[0][0].model).toBe(HAIKU.id);
});

test('/deshacer is offered once the assistant changed the report, and undoes it', async () => {
  setupEditor();
  const stream = heldStream();
  await sendQuestion('Agrega una página');
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'edit' },
  });
  stream.emit({ event: 'done', data: { context_tokens: 10, can_undo: true } });
  await stream.end();
  undo.mockResolvedValue({ skipped_charts: 0, can_undo: false });

  await userEvent.type(questionBox(), '/des');
  expect(
    screen.getAllByRole('option').map(option => option.textContent),
  ).toEqual(['/undoUndo the assistant’s changes']);
  await userEvent.type(questionBox(), '{enter}');

  await waitFor(() => expect(undo).toHaveBeenCalledWith('c1'));
  expect(ask).toHaveBeenCalledTimes(1);
});

test('a click on a command runs it', async () => {
  finishedAnswer();
  setup();
  await userEvent.type(questionBox(), '/');

  await userEvent.click(screen.getByText('/summary'));

  await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
  expect(ask.mock.calls[0][0].message).toBe('Summarize this page');
});

// The document beside the chat

const DOCUMENT = {
  id: 'doc',
  title: 'Resumen ejecutivo',
  version: 1,
  conversation_id: 'c1',
  dashboard_id: 3,
  blocks: [
    {
      id: 'b1',
      type: 'text',
      text: 'Las ventas subieron.',
      written_on: '2026-11-06T10:00:00',
    },
  ],
  sources: {},
  created_on: '2026-11-06T10:00:00',
  versions: [
    {
      number: 1,
      title: 'Resumen ejecutivo',
      origin: 'created',
      restored_from: null,
      created_on: '2026-11-06T10:00:00',
    },
  ],
};
const REF = { id: 'doc', title: 'Resumen ejecutivo', version: 1 };

const writeDocument = async () => {
  (fetchArtifact as jest.Mock).mockReset().mockResolvedValue(DOCUMENT);
  const stream = heldStream();
  setup();
  await sendQuestion('Hazme el resumen');
  stream.emit({
    event: 'conversation',
    data: { id: 'c1', model: SONNET.id, mode: 'read' },
  });
  stream.emit({
    event: 'tool_start',
    data: { id: 't1', name: 'create_artifact' },
  });
  stream.emit({
    event: 'tool_end',
    data: {
      id: 't1',
      name: 'create_artifact',
      is_error: false,
      artifact: REF,
    },
  });
  return stream;
};

test('a document opens beside the chat as the answer writes it', async () => {
  const stream = await writeDocument();

  expect(
    await screen.findByTestId('auradata-artifact-panel'),
  ).toBeInTheDocument();
  expect(screen.getByText('Writing the document')).toBeInTheDocument();
  expect(await screen.findByText('Las ventas subieron.')).toBeInTheDocument();
  expect(screen.getByTestId('auradata-assistant-document')).toHaveTextContent(
    'Version 1',
  );
  await stream.end();
});

test('a closed document opens again from its card', async () => {
  const stream = await writeDocument();
  await stream.end();
  fireEvent.click(await screen.findByTestId('auradata-artifact-close'));
  expect(
    screen.queryByTestId('auradata-artifact-panel'),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('auradata-assistant-document'));

  expect(
    await screen.findByTestId('auradata-artifact-panel'),
  ).toBeInTheDocument();
});

test('the selected block travels by name and the selection ends with it', async () => {
  const stream = await writeDocument();
  await stream.end();
  fireEvent.click(await screen.findByTestId('auradata-artifact-pick'));
  expect(
    await screen.findByTestId('auradata-assistant-aimed'),
  ).toBeInTheDocument();
  ask.mockReset().mockResolvedValue(undefined);

  await sendQuestion('acorta este párrafo');

  expect(ask.mock.calls[0][0].context.artifact).toEqual({
    id: 'doc',
    block_id: 'b1',
  });
  expect(
    screen.queryByTestId('auradata-assistant-aimed'),
  ).not.toBeInTheDocument();
});

test('refreshing the text is a question about the open document', async () => {
  const stream = await writeDocument();
  await stream.end();
  ask.mockReset().mockResolvedValue(undefined);

  fireEvent.click(await screen.findByTestId('auradata-artifact-refresh'));

  await waitFor(() => expect(ask).toHaveBeenCalled());
  expect(ask.mock.calls[0][0].context.artifact).toEqual({ id: 'doc' });
});

test('opening a conversation brings its last document back', async () => {
  (fetchArtifact as jest.Mock).mockReset().mockResolvedValue(DOCUMENT);
  window.sessionStorage.clear();
  conversations.mockResolvedValue([
    {
      id: 'c1',
      dashboard_id: 3,
      mode: 'read',
      model: SONNET.id,
      title: 'Hola',
      changed_on: '2026-11-06',
      last_message_on: '2026-11-06',
    },
  ]);
  conversation.mockResolvedValue({
    ...storedConversation('c1', null),
    artifacts: [REF],
    artifact_calls: {},
  });
  setup();

  await openFromList('Hola');

  expect(
    await screen.findByTestId('auradata-artifact-panel'),
  ).toBeInTheDocument();
  expect(fetchArtifact).toHaveBeenCalledWith('doc', undefined);
});

test('on a phone a picked block goes back to the chat and still travels', async () => {
  const phone = jest.spyOn(mobile, 'usePhoneScreen').mockReturnValue(true);
  const stream = await writeDocument();
  await stream.end();

  fireEvent.click(await screen.findByTestId('auradata-artifact-pick'));

  expect(
    screen.queryByTestId('auradata-artifact-panel'),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId('auradata-assistant-aimed')).toBeInTheDocument();
  ask.mockReset().mockResolvedValue(undefined);
  await sendQuestion('acorta este párrafo');
  expect(ask.mock.calls[0][0].context.artifact).toEqual({
    id: 'doc',
    block_id: 'b1',
  });
  phone.mockRestore();
});
