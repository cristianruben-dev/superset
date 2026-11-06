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
import { useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import copyTextToClipboard from 'src/utils/copy';
import { figureAsText } from './figure';
import type { ChatMessage, Feedback, FeedbackReason } from './types';

const COPY_NOTICE_MS = 2000;

const reasons = (): { key: FeedbackReason; label: string }[] => [
  { key: 'wrong_data', label: t('Wrong figures') },
  { key: 'off_topic', label: t('Not what I asked') },
  { key: 'incomplete', label: t('Incomplete') },
  { key: 'other', label: t('Something else') },
];

/** An answer as it pastes: its text, then its table if it has one. */
const copiedText = ({ text, figure }: ChatMessage) =>
  [text, figure ? figureAsText(figure) : ''].filter(Boolean).join('\n\n');

const Bar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    margin-top: ${theme.sizeUnit * 2}px;
  `}
`;

const Action = styled.button`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit}px;
    min-width: ${theme.sizeUnit * 6}px;
    height: ${theme.sizeUnit * 6}px;
    padding: 0 ${theme.sizeUnit}px;
    border: 0;
    border-radius: ${theme.sizeUnit}px;
    background: transparent;
    color: ${theme.colorTextTertiary};
    font: inherit;
    font-size: ${theme.fontSizeSM}px;
    cursor: pointer;
    transition:
      background ${theme.motionDurationFast},
      color ${theme.motionDurationFast};

    &:hover:not(:disabled) {
      background: ${theme.colorFillTertiary};
      color: ${theme.colorText};
    }
    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
    &:disabled {
      cursor: not-allowed;
    }
    &[aria-pressed='true'] {
      color: ${theme.colorText};
    }
  `}
`;

const Reasons = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    margin-top: ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};

    > span {
      margin-right: ${theme.sizeUnit}px;
    }
  `}
`;

const Reason = styled.button`
  ${({ theme }) => css`
    padding: 0 ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.sizeUnit * 3}px;
    background: transparent;
    color: ${theme.colorTextSecondary};
    font: inherit;
    line-height: ${theme.sizeUnit * 6}px;
    cursor: pointer;
    transition:
      background ${theme.motionDurationFast},
      border-color ${theme.motionDurationFast},
      color ${theme.motionDurationFast};

    &:hover:not(:disabled) {
      background: ${theme.colorFillTertiary};
      color: ${theme.colorText};
    }
    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
    &:disabled {
      cursor: not-allowed;
    }
    &[aria-pressed='true'] {
      border-color: ${theme.colorPrimary};
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorText};
    }
  `}
`;

function CopyButton({ message }: { message: ChatMessage }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    clearTimeout(timer.current);
    await copyTextToClipboard(() => Promise.resolve(copiedText(message))).then(
      () => setState('copied'),
      () => setState('failed'),
    );
    timer.current = setTimeout(() => setState('idle'), COPY_NOTICE_MS);
  };

  return (
    <Action
      type="button"
      onClick={copy}
      aria-label={t('Copy answer')}
      title={t('Copy answer')}
      data-test="auradata-assistant-copy"
    >
      {state === 'idle' && <Icons.CopyOutlined iconSize="s" />}
      {state === 'copied' && (
        <>
          <Icons.CheckOutlined iconSize="s" />
          {t('Copied')}
        </>
      )}
      {state === 'failed' && (
        <>
          <Icons.CloseOutlined iconSize="s" />
          {t('Could not copy')}
        </>
      )}
    </Action>
  );
}

/**
 * What can be done with a finished answer: vote on it, and copy it. A second click on
 * a vote takes it back. A thumbs down saves at once, and the reasons below it are
 * optional; they stay for this visit, so a reload shows only the vote.
 */
export function AnswerActions({
  message,
  onVote,
}: {
  message: ChatMessage;
  onVote: (feedback: Feedback | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const canCopy = !!(message.text || message.figure);
  const canVote = !!message.storedId && !message.stopped;
  const { feedback } = message;
  if (!canCopy && !canVote) return null;

  const save = async (next: Feedback | null) => {
    setSaving(true);
    await onVote(next);
    setSaving(false);
  };

  const vote = (choice: Feedback['vote']) => {
    const next = feedback?.vote === choice ? null : { vote: choice };
    setAsking(next?.vote === 'down');
    return save(next);
  };

  return (
    <div data-test="auradata-assistant-actions">
      <Bar>
        {canVote && (
          <>
            <Action
              type="button"
              disabled={saving}
              aria-pressed={feedback?.vote === 'up'}
              aria-label={t('Helpful')}
              title={t('Helpful')}
              onClick={() => vote('up')}
              data-test="auradata-assistant-vote-up"
            >
              {feedback?.vote === 'up' ? (
                <Icons.LikeFilled iconSize="s" />
              ) : (
                <Icons.LikeOutlined iconSize="s" />
              )}
            </Action>
            <Action
              type="button"
              disabled={saving}
              aria-pressed={feedback?.vote === 'down'}
              aria-label={t('Not helpful')}
              title={t('Not helpful')}
              onClick={() => vote('down')}
              data-test="auradata-assistant-vote-down"
            >
              {feedback?.vote === 'down' ? (
                <Icons.DislikeFilled iconSize="s" />
              ) : (
                <Icons.DislikeOutlined iconSize="s" />
              )}
            </Action>
          </>
        )}
        {canCopy && <CopyButton message={message} />}
      </Bar>
      {asking && feedback?.vote === 'down' && (
        <Reasons
          role="group"
          aria-label={t('What went wrong?')}
          data-test="auradata-assistant-reasons"
        >
          <span>{t('What went wrong?')}</span>
          {reasons().map(({ key, label }) => (
            <Reason
              key={key}
              type="button"
              disabled={saving}
              aria-pressed={feedback.reason === key}
              onClick={() =>
                save({
                  vote: 'down',
                  reason: feedback.reason === key ? null : key,
                })
              }
            >
              {label}
            </Reason>
          ))}
        </Reasons>
      )}
    </div>
  );
}
