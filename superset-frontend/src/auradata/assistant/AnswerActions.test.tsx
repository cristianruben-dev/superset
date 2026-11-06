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
import { useState } from 'react';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import copyTextToClipboard from 'src/utils/copy';
import { AnswerActions } from './AnswerActions';
import type { ChatMessage, Feedback, Figure } from './types';

jest.mock('src/utils/copy', () => ({ __esModule: true, default: jest.fn() }));

const copy = copyTextToClipboard as jest.Mock;

const FIGURE = {
  rows: [{ region: 'Norte', total: 1234.5 }],
  row_count: 1,
} as unknown as Figure;

const answer = (changes: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'local-1',
  role: 'assistant',
  text: 'Vendimos **10**',
  tools: [],
  storedId: 'm1',
  ...changes,
});

/** The actions over a message that keeps the votes, as the panel does. */
function Harness({
  start,
  onVote,
}: {
  start: ChatMessage;
  onVote: (feedback: Feedback | null) => void;
}) {
  const [message, setMessage] = useState(start);
  return (
    <AnswerActions
      message={message}
      onVote={async feedback => {
        setMessage({ ...message, feedback });
        onVote(feedback);
      }}
    />
  );
}

const up = () => screen.getByRole('button', { name: 'Helpful' });
const down = () => screen.getByRole('button', { name: 'Not helpful' });

/** Clicks an action and waits for its save to end. */
const press = async (button: HTMLElement) => {
  userEvent.click(button);
  await waitFor(() => expect(button).toBeEnabled());
};

beforeEach(() => {
  copy.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test('copies the text and the table of an answer', async () => {
  render(<Harness start={answer({ figure: FIGURE })} onVote={jest.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Copy answer' }));

  const [getText] = copy.mock.calls[0];
  await expect(getText()).resolves.toBe(
    'Vendimos **10**\n\nregion\ttotal\nNorte\t1234.5',
  );
});

test('the button says it copied, and goes back to rest', async () => {
  jest.useFakeTimers();
  render(<Harness start={answer()} onVote={jest.fn()} />);
  const button = screen.getByRole('button', { name: 'Copy answer' });

  await act(async () => {
    userEvent.click(button);
  });

  expect(button).toHaveTextContent('Copied');
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(button).not.toHaveTextContent('Copied');
});

test('the button says when the browser refused to copy', async () => {
  copy.mockRejectedValue(new Error('denied'));
  render(<Harness start={answer()} onVote={jest.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Copy answer' }));

  expect(await screen.findByText('Could not copy')).toBeInTheDocument();
});

test('a vote shows as pressed, and a second click takes it back', async () => {
  const onVote = jest.fn();
  render(<Harness start={answer()} onVote={onVote} />);

  await press(up());

  expect(onVote).toHaveBeenLastCalledWith({ vote: 'up' });
  expect(up()).toHaveAttribute('aria-pressed', 'true');
  expect(down()).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('group')).not.toBeInTheDocument();

  await press(up());

  expect(onVote).toHaveBeenLastCalledWith(null);
  expect(up()).toHaveAttribute('aria-pressed', 'false');
});

test('a thumbs down saves at once and the reason is optional', async () => {
  const onVote = jest.fn();
  render(<Harness start={answer()} onVote={onVote} />);

  await press(down());

  expect(onVote).toHaveBeenCalledWith({ vote: 'down' });
  const reason = screen.getByRole('button', { name: 'Wrong figures' });
  await press(reason);

  expect(onVote).toHaveBeenLastCalledWith({
    vote: 'down',
    reason: 'wrong_data',
  });
  expect(reason).toHaveAttribute('aria-pressed', 'true');

  await press(reason);

  expect(onVote).toHaveBeenLastCalledWith({ vote: 'down', reason: null });
});

test('changing to a thumbs up drops the reasons', async () => {
  const onVote = jest.fn();
  render(<Harness start={answer()} onVote={onVote} />);

  await press(down());
  await press(up());

  expect(onVote).toHaveBeenLastCalledWith({ vote: 'up' });
  expect(
    screen.queryByRole('button', { name: 'Wrong figures' }),
  ).not.toBeInTheDocument();
});

test('a vote that came back from the server does not ask for the reason', () => {
  render(
    <Harness
      start={answer({ feedback: { vote: 'down', reason: 'other' } })}
      onVote={jest.fn()}
    />,
  );

  expect(down()).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
});

test('an answer the server never stored can be copied but not voted', () => {
  render(
    <Harness start={answer({ storedId: undefined })} onVote={jest.fn()} />,
  );

  expect(
    screen.getByRole('button', { name: 'Copy answer' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Helpful' }),
  ).not.toBeInTheDocument();
});

test('a stopped answer takes no vote', () => {
  render(<Harness start={answer({ stopped: true })} onVote={jest.fn()} />);

  expect(
    screen.queryByRole('button', { name: 'Helpful' }),
  ).not.toBeInTheDocument();
});

test('a refusal has nothing to copy, and takes a vote', () => {
  render(
    <Harness start={answer({ text: '', refused: true })} onVote={jest.fn()} />,
  );

  expect(
    screen.queryByRole('button', { name: 'Copy answer' }),
  ).not.toBeInTheDocument();
  expect(up()).toBeInTheDocument();
});

test('an empty answer without an id shows nothing', () => {
  render(
    <Harness
      start={answer({ text: '', storedId: undefined })}
      onVote={jest.fn()}
    />,
  );

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
