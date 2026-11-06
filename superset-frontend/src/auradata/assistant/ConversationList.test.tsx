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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { ConversationList } from './ConversationList';
import type { ListedConversation } from './types';

const conversation = (id: string, title: string): ListedConversation => ({
  id,
  dashboard_id: 1,
  mode: 'read',
  model: 'm',
  title,
  changed_on: '',
  last_message_on: new Date().toISOString(),
});

const LIST = [
  conversation('a', 'Ventas de marzo'),
  conversation('b', 'Región norte'),
];

const setup = (overrides = {}) => {
  const props = {
    conversations: LIST,
    currentId: 'b',
    onOpen: jest.fn(),
    onRename: jest.fn(() => Promise.resolve()),
    onDelete: jest.fn(() => Promise.resolve()),
    onClose: jest.fn(),
    ...overrides,
  };
  render(<ConversationList {...props} />);
  return props;
};

test('searches titles, without minding accents, and says when nothing matches', async () => {
  setup();
  const search = screen.getByRole('textbox', { name: 'Search conversations' });

  await userEvent.type(search, 'region');

  expect(
    screen.getByRole('button', { name: 'Región norte' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Ventas de marzo' }),
  ).not.toBeInTheDocument();

  await userEvent.type(search, 'xyz');

  expect(
    screen.getByText('No conversation has that title.'),
  ).toBeInTheDocument();
});

test('groups by date and marks the open conversation', () => {
  setup();

  expect(screen.getByRole('region', { name: 'Today' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Región norte' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  expect(
    screen.getByRole('button', { name: 'Ventas de marzo' }),
  ).not.toHaveAttribute('aria-current');
});

test('opens a conversation', async () => {
  const { onOpen } = setup();

  await userEvent.click(
    screen.getByRole('button', { name: 'Ventas de marzo' }),
  );

  expect(onOpen).toHaveBeenCalledWith('a');
});

test('renames with Enter and goes back to the row', async () => {
  const { onRename } = setup();

  await userEvent.click(
    screen.getByRole('button', { name: 'Rename «Ventas de marzo»' }),
  );
  const title = screen.getByRole('textbox', { name: 'Conversation title' });
  expect(title).toHaveValue('Ventas de marzo');
  await userEvent.clear(title);
  await userEvent.type(title, '  Abril  {enter}');

  await waitFor(() => expect(onRename).toHaveBeenCalledWith('a', 'Abril'));
  await waitFor(() =>
    expect(
      screen.queryByRole('textbox', { name: 'Conversation title' }),
    ).not.toBeInTheDocument(),
  );
});

test('Escape leaves a rename alone, and the list stays open', async () => {
  const { onRename, onClose } = setup();

  await userEvent.click(
    screen.getByRole('button', { name: 'Rename «Ventas de marzo»' }),
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Conversation title' }),
    '{esc}',
  );

  expect(onRename).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Ventas de marzo' }),
  ).toBeInTheDocument();
});

test('an empty title cannot be saved', async () => {
  const { onRename } = setup();

  await userEvent.click(
    screen.getByRole('button', { name: 'Rename «Ventas de marzo»' }),
  );
  const title = screen.getByRole('textbox', { name: 'Conversation title' });
  await userEvent.clear(title);
  await userEvent.type(title, '{enter}');

  expect(onRename).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save title' })).toBeDisabled();
});

test('deleting asks first, and nothing happens if you cancel', async () => {
  const { onDelete } = setup();

  await userEvent.click(
    screen.getByRole('button', { name: 'Delete «Ventas de marzo»' }),
  );
  expect(onDelete).not.toHaveBeenCalled();
  expect(screen.getByText(/you cannot get them back/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onDelete).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Ventas de marzo' }),
  ).toBeInTheDocument();
});

test('deleting runs once confirmed', async () => {
  const { onDelete } = setup();

  await userEvent.click(
    screen.getByRole('button', { name: 'Delete «Ventas de marzo»' }),
  );
  await userEvent.click(
    screen.getByTestId('auradata-assistant-delete-confirm'),
  );

  await waitFor(() => expect(onDelete).toHaveBeenCalledWith('a'));
});

test('a refused delete keeps the question up to try again', async () => {
  const onDelete = jest.fn(() => Promise.reject(new Error('busy')));
  setup({ onDelete });

  await userEvent.click(
    screen.getByRole('button', { name: 'Delete «Ventas de marzo»' }),
  );
  await userEvent.click(
    screen.getByTestId('auradata-assistant-delete-confirm'),
  );

  await waitFor(() => expect(onDelete).toHaveBeenCalled());
  expect(
    await screen.findByTestId('auradata-assistant-delete-confirm'),
  ).toBeEnabled();
});

test('Escape closes the list', async () => {
  const { onClose } = setup();

  await userEvent.type(
    screen.getByRole('textbox', { name: 'Search conversations' }),
    '{esc}',
  );

  expect(onClose).toHaveBeenCalled();
});
