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
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Drawer,
  Input,
  Loading,
  Select,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { usePhoneScreen } from '../format/mobile';
import { AssistantFigure } from './AssistantFigure';
import { AssistantMarkdown } from './AssistantMarkdown';
import { fetchConversations } from './client';
import { pageContext } from './context';
import { isLongConversation } from './transcript';
import type {
  ChatMessage,
  Conversation,
  ModelPrice,
  OfferedModel,
  ToolStep,
} from './types';
import { useAssistantChat } from './useAssistantChat';

const PANEL_WIDTH = 440;

const priceLabel = (price: ModelPrice) =>
  ({
    economy: t('Economical'),
    balanced: t('Balanced'),
    top: t('Maximum'),
  })[price];

const toolLabel = (name: string) =>
  ({
    get_report_structure: t('Reading the report'),
    get_dashboard_info: t('Reading the report'),
    get_dashboard_datasets: t('Looking at the datasets'),
    list_datasets: t('Looking at the datasets'),
    get_dataset_info: t('Looking at the datasets'),
    query_dataset: t('Querying the data'),
    get_chart_data: t('Reading a chart'),
    get_dashboard_screenshot: t('Looking at the report'),
    get_visual_screenshot: t('Looking at a chart'),
  })[name] ?? t('Using %s', name);

/** Whether a model can go on with a conversation of another model. */
const canContinue = (model: OfferedModel, current?: OfferedModel) =>
  !current?.tool_search || model.tool_search;

const Column = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    height: 100%;
    padding: ${theme.sizeUnit * 3}px;
    box-sizing: border-box;
  `}
`;

const Controls = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const History = styled.div`
  grid-column: 1 / -1;
`;

const Messages = styled.div`
  ${({ theme }) => css`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    min-height: 0;
    overflow-y: auto;
  `}
`;

const Bubble = styled.div<{ fromUser: boolean }>`
  ${({ theme, fromUser }) => css`
    align-self: ${fromUser ? 'flex-end' : 'stretch'};
    max-width: ${fromUser ? '85%' : '100%'};
    padding: ${fromUser ? `${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px` : 0};
    border-radius: ${theme.borderRadius}px;
    background: ${fromUser ? theme.colorFillTertiary : 'transparent'};
    overflow-wrap: anywhere;
    white-space: ${fromUser ? 'pre-wrap' : 'normal'};

    p {
      margin: 0 0 ${theme.sizeUnit * 2}px;
    }
    p:last-child {
      margin-bottom: 0;
    }
    table {
      display: block;
      max-width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
      font-size: ${theme.fontSizeSM}px;
    }
    th,
    td {
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }
  `}
`;

const Steps = styled.ul`
  ${({ theme }) => css`
    margin: 0 0 ${theme.sizeUnit}px;
    padding: 0;
    list-style: none;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};

    li.failed {
      color: ${theme.colorError};
    }
  `}
`;

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const Composer = styled.form`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-end;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

/** The tools of an answer, once each: the one in use shows while it runs. */
function ToolSteps({ tools }: { tools: ToolStep[] }) {
  const steps = [
    ...new Map(tools.map(step => [toolLabel(step.name), step])).entries(),
  ];
  return (
    <Steps aria-label={t('Steps of the answer')}>
      {steps.map(([label, step]) => (
        <li
          key={label}
          className={step.failed ? 'failed' : undefined}
          data-test="auradata-assistant-step"
        >
          {step.running ? `${label}…` : label}
        </li>
      ))}
    </Steps>
  );
}

function Answer({
  message,
  dashboardId,
  writing,
}: {
  message: ChatMessage;
  dashboardId: number;
  writing: boolean;
}) {
  const waiting = writing && !message.text && !message.tools.length;
  return (
    <Bubble fromUser={false} data-test="auradata-assistant-answer">
      {waiting && <Loading position="inline" size="s" />}
      {message.tools.length > 0 && <ToolSteps tools={message.tools} />}
      {message.text && <AssistantMarkdown text={message.text} />}
      {message.figure && (
        <AssistantFigure figure={message.figure} dashboardId={dashboardId} />
      )}
      {message.problem && (
        <Alert
          type={message.refused ? 'info' : 'error'}
          message={message.problem}
          showIcon
        />
      )}
      {message.stopped && <Hint>{t('You stopped this answer.')}</Hint>}
    </Bubble>
  );
}

/**
 * «Ask your data»: a side panel of the report, read only, that takes the whole screen
 * of a phone. The model answers on the server, which decides what it can reach.
 */
export function AssistantPanel({
  open,
  onClose,
  models,
}: {
  open: boolean;
  onClose: () => void;
  models: OfferedModel[];
}) {
  const store = useStore<RootState>();
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const phone = usePhoneScreen();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [draft, setDraft] = useState('');
  const fallbackModel =
    models.find(model => model.default)?.id ?? models[0]?.id;
  const [chosenModel, setChosenModel] = useState<string>();

  const loadConversations = useCallback(() => {
    fetchConversations(dashboardId).then(
      // Conversations of the editor belong to the editor: their mode is fixed
      list => setConversations(list.filter(item => item.mode === 'read')),
      () => setConversations([]),
    );
  }, [dashboardId]);

  const chat = useAssistantChat(loadConversations);
  const { stop, reset } = chat;
  const current = models.find(item => item.id === chat.conversationModel);
  const model = chosenModel ?? current?.id ?? fallbackModel;
  const selected = models.find(item => item.id === model);
  const long = isLongConversation(
    chat.contextTokens,
    selected?.max_input_tokens,
  );

  useEffect(() => {
    if (open) loadConversations();
    else stop();
  }, [open, loadConversations, stop]);

  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [chat.messages]);

  const modelOptions = useMemo(
    () =>
      models.map(item => ({
        value: item.id,
        disabled: !canContinue(item, current),
        label: [
          item.name,
          priceLabel(item.price),
          ...(item.default ? [t('default')] : []),
        ].join(' · '),
      })),
    [models, current],
  );

  const startNew = () => {
    reset();
    setChosenModel(undefined);
  };

  const openConversation = (id: string) => {
    setChosenModel(undefined);
    chat.open(id);
  };

  const submit = () => {
    const message = draft.trim();
    if (!message || chat.busy || !model) return;
    setDraft('');
    chat.send(message, model, pageContext(store.getState(), dashboardId));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('Assistant')}
      placement="right"
      mask={false}
      width={phone ? '100%' : PANEL_WIDTH}
      styles={{ body: { padding: 0 } }}
      data-test="auradata-assistant-panel"
    >
      <Column>
        <Controls>
          <Select
            ariaLabel={t('Model')}
            value={model}
            options={modelOptions}
            onChange={value => setChosenModel(String(value))}
            disabled={chat.busy}
            showSearch={false}
            data-test="auradata-assistant-model"
          />
          <Button
            buttonStyle="secondary"
            onClick={startNew}
            disabled={chat.busy || !chat.messages.length}
            data-test="auradata-assistant-new"
          >
            {t('New conversation')}
          </Button>
          {conversations.length > 0 && (
            <History>
              <Select
                ariaLabel={t('Conversations of this report')}
                placeholder={t('Conversations of this report')}
                value={chat.conversationId ?? undefined}
                options={conversations.map(item => ({
                  value: item.id,
                  label: item.title,
                }))}
                onChange={value => openConversation(String(value))}
                disabled={chat.busy}
                showSearch={false}
                data-test="auradata-assistant-history"
              />
            </History>
          )}
        </Controls>

        <Messages aria-live="polite" data-test="auradata-assistant-messages">
          {chat.messages.length === 0 && (
            <Hint>
              {t(
                'Ask about this report. The assistant answers about the page and filters on your screen, and it cannot change anything.',
              )}
            </Hint>
          )}
          {chat.messages.map((message, index) =>
            message.role === 'user' ? (
              <Bubble key={message.id} fromUser>
                {message.text}
              </Bubble>
            ) : (
              <Answer
                key={message.id}
                message={message}
                dashboardId={dashboardId}
                writing={chat.busy && index === chat.messages.length - 1}
              />
            ),
          )}
          <div ref={end} />
        </Messages>

        {chat.cacheLost && (
          <Alert
            type="info"
            showIcon
            message={t(
              'You changed the model, so it reads this conversation from scratch: this answer takes longer and costs more than usual.',
            )}
            data-test="auradata-assistant-model-changed"
          />
        )}
        {long && (
          <Alert
            type="warning"
            showIcon
            message={t(
              'This conversation is getting too long for the model. Start a new one to keep going.',
            )}
            action={
              <Button buttonSize="small" onClick={startNew}>
                {t('New conversation')}
              </Button>
            }
            data-test="auradata-assistant-long"
          />
        )}

        <Composer
          onSubmit={event => {
            event.preventDefault();
            submit();
          }}
        >
          <Input.TextArea
            aria-label={t('Your question')}
            placeholder={t('Your question')}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            autoSize={{ minRows: 1, maxRows: 5 }}
            data-test="auradata-assistant-input"
          />
          {chat.busy ? (
            <Button
              buttonStyle="secondary"
              onClick={stop}
              icon={<Icons.StopOutlined iconSize="m" />}
              data-test="auradata-assistant-stop"
            >
              {t('Stop')}
            </Button>
          ) : (
            <Button
              buttonStyle="primary"
              htmlType="submit"
              disabled={!draft.trim()}
              data-test="auradata-assistant-send"
            >
              {t('Send')}
            </Button>
          )}
        </Composer>
        <Hint>
          {t('What you ask, and the data it reads, go to Anthropic.')}
        </Hint>
      </Column>
    </Drawer>
  );
}
