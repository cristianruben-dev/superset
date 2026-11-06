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
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Button, Drawer, Input, Select } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { RootState } from 'src/dashboard/types';
import { hasPendingFields } from '../format/chartFields';
import { usePhoneScreen } from '../format/mobile';
import { selectedVisuals } from '../format/selection';
import { AssistantFigure } from './AssistantFigure';
import { AssistantMarkdown } from './AssistantMarkdown';
import { AssistantError, fetchConversations } from './client';
import { ConfirmationCard } from './ConfirmationCard';
import { confirmationTitle } from './confirmations';
import { editorContext, pageContext } from './context';
import { reloadReport, saveReport } from './editorActions';
import { isLongConversation } from './transcript';
import { PrivacyNotice } from './PrivacyNotice';
import type {
  AssistantAccess,
  AssistantBudget,
  ChatMessage,
  ChatMode,
  Conversation,
  ModelPrice,
  OfferedModel,
  ToolStep,
} from './types';
import { useAssistantChat } from './useAssistantChat';

const PANEL_WIDTH = 440;

const readSuggestions = () => [
  t('Summarize this report'),
  t('What stands out the most?'),
  t('Compare the main categories'),
];

const editSuggestions = () => [
  t('Review this report and improve it'),
  t('Align the objects of this page'),
  t('Make it look good on a phone'),
];

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
  })[name] ?? confirmationTitle({ name, title: t('Working on the report') });

const budgetMessage = ({ level, scope }: AssistantBudget) => {
  if (level === 'stopped') {
    return scope === 'workspace'
      ? t(
          'This workspace used up its assistant budget for the month. Ask an admin of the workspace, or wait for next month.',
        )
      : t(
          'The assistant used up its budget for the month. Ask an admin, or wait for next month.',
        );
  }
  return scope === 'workspace'
    ? t(
        'This workspace is close to its assistant budget for the month. The assistant stops when it runs out.',
      )
    : t(
        'The assistant is close to its budget for the month. It stops when it runs out.',
      );
};

/** Whether a model can go on with a conversation of another model. */
const canContinue = (model: OfferedModel, current?: OfferedModel) =>
  !current?.tool_search || model.tool_search;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const Controls = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
  `}
`;

const History = styled.div`
  flex: 1;
  min-width: 0;
`;

const Messages = styled.div`
  ${({ theme }) => css`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;
    min-height: 0;
    padding: ${theme.sizeUnit * 4}px;
    overflow-y: auto;
  `}
`;

const Bubble = styled.div<{ fromUser: boolean }>`
  ${({ theme, fromUser }) => css`
    align-self: ${fromUser ? 'flex-end' : 'stretch'};
    max-width: ${fromUser ? '85%' : '100%'};
    padding: ${fromUser ? `${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px` : 0};
    border-radius: ${theme.sizeUnit * 3}px;
    background: ${fromUser ? theme.colorFillSecondary : 'transparent'};
    line-height: 1.6;
    overflow-wrap: anywhere;
    white-space: ${fromUser ? 'pre-wrap' : 'normal'};

    p,
    ul,
    ol {
      margin: 0 0 ${theme.sizeUnit * 2}px;
    }
    p:last-child,
    ul:last-child,
    ol:last-child {
      margin-bottom: 0;
    }
    ul,
    ol {
      padding-left: ${theme.sizeUnit * 5}px;
    }
    li + li {
      margin-top: ${theme.sizeUnit}px;
    }
    h1,
    h2,
    h3,
    h4 {
      margin: ${theme.sizeUnit * 3}px 0 ${theme.sizeUnit}px;
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
    }
    strong {
      font-weight: ${theme.fontWeightStrong};
    }
    code {
      padding: 0 ${theme.sizeUnit}px;
      border-radius: ${theme.sizeUnit}px;
      background: ${theme.colorFillTertiary};
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeSM}px;
    }
    table {
      display: block;
      max-width: 100%;
      margin-bottom: ${theme.sizeUnit * 2}px;
      overflow-x: auto;
      border-collapse: collapse;
      font-size: ${theme.fontSizeSM}px;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 3}px ${theme.sizeUnit}px 0;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      text-align: left;
    }
    th {
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const StepList = styled.ul`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};

    li {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      margin: 0;
    }
    li.failed {
      color: ${theme.colorError};
    }
  `}
`;

const StepsFold = styled.details`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};

    summary {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      border-radius: ${theme.sizeUnit}px;
      cursor: pointer;
      list-style: none;
      transition: color ${theme.motionDurationFast};
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary:hover {
      color: ${theme.colorText};
    }
    summary:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
    summary .anticon {
      transition: transform ${theme.motionDurationFast};
    }
    &[open] summary .anticon {
      transform: rotate(90deg);
    }
    &[open] summary {
      margin-bottom: ${theme.sizeUnit}px;
    }
  `}
`;

const Running = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    line-height: 1.5;
    color: ${theme.colorTextTertiary};
  `}
`;

const Empty = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    margin: auto 0;

    h3 {
      margin: 0;
      font-size: ${theme.fontSizeLG}px;
      font-weight: ${theme.fontWeightStrong};
    }
    p {
      margin: 0;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const Suggestions = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;

    button {
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.sizeUnit * 2}px;
      background: transparent;
      color: ${theme.colorText};
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition:
        background ${theme.motionDurationFast},
        border-color ${theme.motionDurationFast};
    }
    button:hover:not(:disabled) {
      border-color: ${theme.colorPrimary};
      background: ${theme.colorFillTertiary};
    }
    button:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
    button:disabled {
      color: ${theme.colorTextDisabled};
      cursor: not-allowed;
    }
  `}
`;

const QuietAction = styled.button`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.sizeUnit * 2}px;
    background: transparent;
    color: ${theme.colorTextSecondary};
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
      color: ${theme.colorTextDisabled};
      cursor: not-allowed;
    }
  `}
`;

const Footer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-top: 1px solid ${theme.colorBorderSecondary};
  `}
`;

const Composer = styled.form`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};
    transition:
      border-color ${theme.motionDurationFast},
      box-shadow ${theme.motionDurationFast};

    &:focus-within {
      border-color: ${theme.colorPrimary};
      box-shadow: 0 0 0 2px ${theme.colorPrimaryBg};
    }
    textarea.ant-input {
      padding: ${theme.sizeUnit}px;
      line-height: 1.5;
    }
  `}
`;

const ComposerBar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.sizeUnit * 2}px;

    > div:first-of-type {
      flex: 0 1 auto;
      width: auto;
      min-width: 0;
    }
    .ant-select {
      width: auto !important;
      max-width: 240px;
    }
    .ant-select-selector {
      padding-inline: ${theme.sizeUnit}px !important;
      background: transparent !important;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }
    button {
      flex: none;
      min-width: ${theme.sizeUnit * 8}px;
      width: ${theme.sizeUnit * 8}px;
      height: ${theme.sizeUnit * 8}px;
      padding: 0;
      border-radius: ${theme.sizeUnit * 2}px;
    }
    .send .anticon {
      transform: rotate(-90deg);
    }
  `}
`;

function StepIcon({ step }: { step: ToolStep }) {
  if (step.running) return <Icons.LoadingOutlined iconSize="s" />;
  return step.failed ? (
    <Icons.CloseOutlined iconSize="s" />
  ) : (
    <Icons.CheckOutlined iconSize="s" />
  );
}

/**
 * The tools of an answer, once each. They show as it works, and fold into one line when
 * it ends, unless one of them failed.
 */
function ToolSteps({
  tools,
  writing,
}: {
  tools: ToolStep[];
  writing: boolean;
}) {
  const steps = [
    ...new Map(tools.map(step => [toolLabel(step.name), step])).entries(),
  ];
  const list = (
    <StepList aria-label={t('Steps of the answer')}>
      {steps.map(([label, step]) => (
        <li
          key={label}
          className={step.failed ? 'failed' : undefined}
          data-test="auradata-assistant-step"
        >
          <StepIcon step={step} />
          <span>
            {step.running ? `${label}…` : label}
            {step.rejected && ` (${t('rejected')})`}
          </span>
        </li>
      ))}
    </StepList>
  );
  if (writing) return <Running>{list}</Running>;
  return (
    <StepsFold open={tools.some(step => step.failed)}>
      <summary>
        <Icons.RightOutlined iconSize="xs" />
        {tn('%s step', '%s steps', steps.length, steps.length)}
      </summary>
      {list}
    </StepsFold>
  );
}

function Answer({
  message,
  dashboardId,
  writing,
  onNewConversation,
}: {
  message: ChatMessage;
  dashboardId: number;
  writing: boolean;
  onNewConversation: () => void;
}) {
  const waiting = writing && !message.text && !message.tools.length;
  return (
    <Bubble fromUser={false} data-test="auradata-assistant-answer">
      {waiting && (
        <StepList aria-label={t('Steps of the answer')}>
          <li>
            <Icons.LoadingOutlined iconSize="s" />
            <span>{t('Thinking…')}</span>
          </li>
        </StepList>
      )}
      {message.tools.length > 0 && (
        <ToolSteps tools={message.tools} writing={writing} />
      )}
      {message.text && <AssistantMarkdown text={message.text} />}
      {message.figure && (
        <AssistantFigure figure={message.figure} dashboardId={dashboardId} />
      )}
      {message.problem && (
        <Alert
          type={message.refused ? 'info' : 'error'}
          message={message.problem}
          showIcon
          action={
            message.contextExceeded && (
              <Button
                buttonSize="small"
                onClick={onNewConversation}
                data-test="auradata-assistant-context-new"
              >
                {t('New conversation')}
              </Button>
            )
          }
        />
      )}
      {message.stopped && <Hint>{t('You stopped this answer.')}</Hint>}
    </Bubble>
  );
}

function Conversations({
  mode,
  access,
  active,
}: {
  mode: ChatMode;
  access: AssistantAccess;
  active: boolean;
}) {
  const { models } = access;
  const store = useStore<RootState>();
  const dispatch = useDispatch();
  const history = useHistory();
  const { addDangerToast, addSuccessToast, addWarningToast } = useToasts();
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const unsaved = useSelector(
    (state: RootState) => !!state.dashboardState.hasUnsavedChanges,
  );
  const saving = useSelector(
    (state: RootState) => !!state.dashboardState.dashboardIsSaving,
  );
  const editing = mode === 'edit';
  const blocked = editing && (unsaved || hasPendingFields());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [draft, setDraft] = useState('');
  const fallbackModel =
    models.find(model => model.default)?.id ?? models[0]?.id;
  const [chosenModel, setChosenModel] = useState<string>();

  const loadConversations = useCallback(() => {
    fetchConversations(dashboardId).then(
      // A conversation keeps its mode: each side lists its own
      list => setConversations(list.filter(item => item.mode === mode)),
      () => setConversations([]),
    );
  }, [dashboardId, mode]);

  const reload = useCallback(
    () =>
      (
        dispatch(reloadReport(history) as never) as unknown as Promise<void>
      ).catch(() =>
        addDangerToast(
          t('The report could not be reloaded. Refresh the page.'),
        ),
      ),
    [addDangerToast, dispatch, history],
  );

  // Work done on the canvas during an answer is not thrown away to show that answer
  const afterChange = useCallback(() => {
    if (store.getState().dashboardState.hasUnsavedChanges) {
      addWarningToast(
        t(
          'The assistant changed the saved report while you were editing. Discard your changes to see it.',
        ),
      );
    } else {
      reload();
    }
  }, [addWarningToast, reload, store]);

  const chat = useAssistantChat(
    mode,
    loadConversations,
    editing ? afterChange : undefined,
  );
  const { stop, reset } = chat;
  const current = models.find(item => item.id === chat.conversationModel);
  const model = chosenModel ?? current?.id ?? fallbackModel;
  const selected = models.find(item => item.id === model);
  const long = isLongConversation(
    chat.contextTokens,
    selected?.max_input_tokens,
  );
  const budget = chat.budget ?? access.budget;
  const stopped = budget.level === 'stopped';

  useEffect(() => {
    if (active) loadConversations();
    else stop();
  }, [active, loadConversations, stop]);

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

  // A conversation that just started is not on the list until its answer ends
  const historyOptions = useMemo(() => {
    const options = conversations.map(item => ({
      value: item.id,
      label: item.title,
    }));
    const { conversationId, messages } = chat;
    return !conversationId ||
      options.some(item => item.value === conversationId)
      ? options
      : [{ value: conversationId, label: messages[0]?.text ?? '' }, ...options];
  }, [conversations, chat.conversationId, chat.messages]);

  const startNew = () => {
    reset();
    setChosenModel(undefined);
  };

  const openConversation = (id: string) => {
    setChosenModel(undefined);
    chat.open(id);
  };

  const contextNow = () =>
    editing
      ? editorContext(store.getState(), dashboardId, selectedVisuals())
      : pageContext(store.getState(), dashboardId);

  const canSend = !chat.busy && !!model && !blocked && !stopped;

  const ask = (text: string) => {
    const message = text.trim();
    if (!message || !model || !canSend) return;
    setDraft('');
    chat.send(message, model, contextNow());
  };

  const submit = () => ask(draft);

  const decide = (id: string, approved: boolean) => {
    if (model) chat.decide(id, approved, model);
  };

  const undo = async () => {
    try {
      const result = await chat.undo();
      if (result?.skipped_charts) {
        addWarningToast(
          t(
            'Done, except for %s charts that no longer exist.',
            result.skipped_charts,
          ),
        );
      } else {
        addSuccessToast(t('The assistant’s changes were undone.'));
      }
    } catch (error) {
      addDangerToast(
        error instanceof AssistantError
          ? error.message
          : t('This could not be undone.'),
      );
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Column>
      {historyOptions.length + chat.messages.length > 0 && (
        <Controls>
          <History>
            {historyOptions.length > 0 && (
              <Select
                ariaLabel={t('Conversations of this report')}
                placeholder={t('Conversations of this report')}
                value={chat.conversationId ?? undefined}
                options={historyOptions}
                onChange={value => openConversation(String(value))}
                disabled={chat.busy}
                showSearch={false}
                data-test="auradata-assistant-history"
              />
            )}
          </History>
          <Button
            buttonStyle="secondary"
            onClick={startNew}
            disabled={chat.busy || !chat.messages.length}
            icon={<Icons.PlusOutlined iconSize="m" />}
            tooltip={t('New conversation')}
            aria-label={t('New conversation')}
            data-test="auradata-assistant-new"
          />
        </Controls>
      )}

      <Messages aria-live="polite" data-test="auradata-assistant-messages">
        {chat.messages.length === 0 && (
          <Empty>
            <h3>
              {editing ? t('What do we change?') : t('Ask about your data')}
            </h3>
            <p>
              {editing
                ? t(
                    'The assistant knows the page and what you have selected, and it asks you before it deletes, publishes, shares or schedules anything.',
                  )
                : t(
                    'The assistant answers about the page and filters on your screen, and it cannot change anything.',
                  )}
            </p>
            <Suggestions>
              {(editing ? editSuggestions() : readSuggestions()).map(text => (
                <button
                  key={text}
                  type="button"
                  disabled={!canSend}
                  onClick={() => ask(text)}
                  data-test="auradata-assistant-suggestion"
                >
                  {text}
                </button>
              ))}
            </Suggestions>
          </Empty>
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
              onNewConversation={startNew}
            />
          ),
        )}
        {chat.confirmations.map(confirmation => (
          <ConfirmationCard
            key={confirmation.id}
            confirmation={confirmation}
            disabled={chat.busy || blocked}
            onDecide={approved => decide(confirmation.id, approved)}
          />
        ))}
        {editing && chat.canUndo && !chat.busy && (
          <QuietAction
            type="button"
            onClick={undo}
            disabled={blocked}
            data-test="auradata-assistant-undo"
          >
            <Icons.Undo iconSize="s" />
            {t('Undo the assistant’s changes')}
          </QuietAction>
        )}
        <div ref={end} />
      </Messages>

      <Footer>
        {blocked && (
          <Alert
            type="warning"
            showIcon
            message={t(
              'The assistant works on the saved report. Save your changes or discard them first.',
            )}
            action={
              <>
                <Button
                  buttonSize="small"
                  buttonStyle="secondary"
                  onClick={reload}
                  disabled={saving}
                  data-test="auradata-assistant-discard"
                >
                  {t('Discard')}
                </Button>
                <Button
                  buttonSize="small"
                  onClick={() => dispatch(saveReport() as never)}
                  disabled={saving}
                  data-test="auradata-assistant-save"
                >
                  {t('Save')}
                </Button>
              </>
            }
            data-test="auradata-assistant-unsaved"
          />
        )}
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

        {budget.level !== 'ok' && (
          <Alert
            type={stopped ? 'error' : 'warning'}
            showIcon
            message={budgetMessage(budget)}
            data-test="auradata-assistant-budget"
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
            placeholder={
              chat.confirmations.length
                ? t('If you write, the actions above are dropped')
                : t('Ask something')
            }
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={stopped}
            variant="borderless"
            autoSize={{ minRows: 1, maxRows: 6 }}
            data-test="auradata-assistant-input"
          />
          <ComposerBar>
            <Select
              ariaLabel={t('Model')}
              value={model}
              options={modelOptions}
              onChange={value => setChosenModel(String(value))}
              disabled={chat.busy}
              showSearch={false}
              variant="borderless"
              size="small"
              popupMatchSelectWidth={false}
              labelRender={({ value }) =>
                models.find(item => item.id === value)?.name ?? value
              }
              data-test="auradata-assistant-model"
            />
            {chat.busy ? (
              <Button
                buttonStyle="secondary"
                onClick={stop}
                icon={<Icons.StopOutlined iconSize="m" />}
                tooltip={t('Stop')}
                aria-label={t('Stop')}
                data-test="auradata-assistant-stop"
              />
            ) : (
              <Button
                className="send"
                buttonStyle="primary"
                htmlType="submit"
                disabled={!draft.trim() || blocked || stopped}
                icon={<Icons.ArrowRightOutlined iconSize="m" />}
                aria-label={t('Send')}
                data-test="auradata-assistant-send"
              />
            )}
          </ComposerBar>
        </Composer>
        <Hint>
          {t('What you ask, and the data it reads, go to Anthropic.')}
        </Hint>
      </Footer>
    </Column>
  );
}

/**
 * The conversation with the assistant: «Ask your data» in reading, and the copilot of
 * the editor. The model answers on the server, which decides what it can reach. In the
 * editor it acts on the saved report, so the panel asks to save or discard first, and
 * shows what it did when it ends. The first time, it says what travels to Anthropic, and
 * nothing is sent until the person accepts.
 */
export function AssistantChat({
  mode,
  access,
  active,
}: {
  mode: ChatMode;
  access: AssistantAccess;
  active: boolean;
}) {
  return access.privacyAccepted ? (
    <Conversations mode={mode} access={access} active={active} />
  ) : (
    <PrivacyNotice onAccept={access.acceptPrivacy} />
  );
}

/** «Ask your data»: a side panel of the report, the whole screen on a phone. */
export function AssistantPanel({
  open,
  onClose,
  access,
}: {
  open: boolean;
  onClose: () => void;
  access: AssistantAccess;
}) {
  const phone = usePhoneScreen();
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
      <AssistantChat mode="read" access={access} active={open} />
    </Drawer>
  );
}
