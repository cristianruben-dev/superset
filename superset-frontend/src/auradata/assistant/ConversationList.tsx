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
import { type FormEvent, type KeyboardEvent, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { usePhoneScreen } from '../format/mobile';
import { groupByDate, matchesTitle } from './conversationGroups';
import type { ListedConversation } from './types';

/** The most a title can take, as the server counts it. */
const TITLE_LENGTH = 80;

const Column = styled.div`
  ${({ theme }) => css`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    min-height: 0;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
  `}
`;

const Groups = styled.div`
  ${({ theme }) => css`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;
    min-height: 0;
    /* Room for the focus ring of a row, which the scroll area would clip */
    margin: 0 -${theme.sizeUnit}px;
    padding: ${theme.sizeUnit / 2}px ${theme.sizeUnit}px;
    overflow-y: auto;

    h4 {
      margin: 0 0 ${theme.sizeUnit}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightNormal};
      color: ${theme.colorTextTertiary};
    }
    ul {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit / 2}px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      margin: 0;
    }
  `}
`;

const Row = styled.div<{ current: boolean }>`
  ${({ theme, current }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    min-height: ${theme.sizeUnit * 8}px;
    padding-right: ${theme.sizeUnit}px;
    border-radius: ${theme.sizeUnit}px;
    background: ${current ? theme.colorFillSecondary : 'transparent'};
    transition: background ${theme.motionDurationFast};

    &:hover {
      background: ${current ? theme.colorFillSecondary : theme.colorFillTertiary};
    }
    &:hover .actions,
    &:focus-within .actions {
      opacity: 1;
    }
    @media (hover: none) {
      min-height: ${theme.sizeUnit * 10}px;

      .actions {
        opacity: 1;
      }
    }
  `}
`;

const Open = styled.button`
  ${({ theme }) => css`
    flex: 1;
    min-width: 0;
    align-self: stretch;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    overflow: hidden;
    border: 0;
    border-radius: ${theme.sizeUnit}px;
    background: transparent;
    color: ${theme.colorText};
    font: inherit;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
    }
  `}
`;

const Actions = styled.div`
  ${({ theme }) => css`
    flex: none;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit / 2}px;
    opacity: 0;
    transition: opacity ${theme.motionDurationFast};
  `}
`;

const Action = styled.button`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 6}px;
    height: ${theme.sizeUnit * 6}px;
    padding: 0;
    border: 0;
    border-radius: ${theme.sizeUnit}px;
    background: transparent;
    color: ${theme.colorTextTertiary};
    cursor: pointer;
    transition:
      background ${theme.motionDurationFast},
      color ${theme.motionDurationFast};

    &:hover:not(:disabled) {
      background: ${theme.colorFillSecondary};
      color: ${theme.colorText};
    }
    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 1px;
    }
    &:disabled {
      cursor: not-allowed;
    }
    @media (hover: none) {
      width: ${theme.sizeUnit * 8}px;
      height: ${theme.sizeUnit * 8}px;
    }
  `}
`;

const RenameForm = styled.form`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    min-height: ${theme.sizeUnit * 8}px;
  `}
`;

const Confirm = styled.fieldset`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    min-width: 0;
    margin: 0;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.sizeUnit * 2}px;

    p {
      margin: 0;
      font-size: ${theme.fontSizeSM}px;
      line-height: 1.5;
      color: ${theme.colorTextSecondary};
    }
    div {
      display: flex;
      justify-content: flex-end;
      gap: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const Nothing = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

function RenameRow({
  title,
  onSave,
  onCancel,
}: {
  title: string;
  onSave: (title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const name = value.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name || saving) return;
    if (name === title) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(name);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <RenameForm onSubmit={submit}>
      <Input
        aria-label={t('Conversation title')}
        value={value}
        maxLength={TITLE_LENGTH}
        onChange={event => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={event => event.target.select()}
        autoFocus
        size="small"
        data-test="auradata-assistant-rename-input"
      />
      <Action
        type="submit"
        disabled={!name || saving}
        aria-label={t('Save title')}
        title={t('Save title')}
      >
        <Icons.CheckOutlined iconSize="s" />
      </Action>
      <Action
        type="button"
        onClick={onCancel}
        aria-label={t('Cancel')}
        title={t('Cancel')}
      >
        <Icons.CloseOutlined iconSize="s" />
      </Action>
    </RenameForm>
  );
}

function ConfirmDelete({
  title,
  onDelete,
  onCancel,
}: {
  title: string;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <Confirm aria-label={t('Delete conversation')}>
      <p>
        {t(
          'Delete «%s»? What was said and the data it read are erased, and you cannot get them back.',
          title,
        )}
      </p>
      <div>
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={onCancel}
          disabled={deleting}
          autoFocus
        >
          {t('Cancel')}
        </Button>
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={remove}
          loading={deleting}
          data-test="auradata-assistant-delete-confirm"
        >
          {t('Delete')}
        </Button>
      </div>
    </Confirm>
  );
}

/**
 * The conversations of a report, as a view of the panel: a dropdown would not fit the
 * pane of the editor. Titles are searched here, since the list is already loaded.
 */
export function ConversationList({
  conversations,
  currentId,
  onOpen,
  onRename,
  onDelete,
  onClose,
}: {
  conversations: ListedConversation[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const phone = usePhoneScreen();
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      groupByDate(
        conversations.filter(item => matchesTitle(item.title, query)),
      ),
    [conversations, query],
  );

  const rename = async (id: string, title: string) => {
    await onRename(id, title);
    setRenaming(null);
  };

  const remove = async (id: string) => {
    await onDelete(id);
    setDeleting(null);
  };

  const row = ({ id, title }: ListedConversation) => {
    if (renaming === id) {
      return (
        <RenameRow
          title={title}
          onSave={value => rename(id, value)}
          onCancel={() => setRenaming(null)}
        />
      );
    }
    if (deleting === id) {
      return (
        <ConfirmDelete
          title={title}
          onDelete={() => remove(id)}
          onCancel={() => setDeleting(null)}
        />
      );
    }
    const current = id === currentId;
    return (
      <Row current={current} data-test="auradata-assistant-conversation">
        <Open
          type="button"
          onClick={() => onOpen(id)}
          aria-current={current || undefined}
          title={title}
        >
          {title}
        </Open>
        <Actions className="actions">
          <Action
            type="button"
            onClick={() => {
              setDeleting(null);
              setRenaming(id);
            }}
            aria-label={t('Rename «%s»', title)}
            title={t('Rename')}
            data-test="auradata-assistant-rename"
          >
            <Icons.EditOutlined iconSize="s" />
          </Action>
          <Action
            type="button"
            onClick={() => {
              setRenaming(null);
              setDeleting(id);
            }}
            aria-label={t('Delete «%s»', title)}
            title={t('Delete')}
            data-test="auradata-assistant-delete"
          >
            <Icons.DeleteOutlined iconSize="s" />
          </Action>
        </Actions>
      </Row>
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onClose();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <Column onKeyDown={onKeyDown} data-test="auradata-assistant-conversations">
      <Input
        // A phone would cover the list with its keyboard
        autoFocus={!phone}
        aria-label={t('Search conversations')}
        placeholder={t('Search conversations')}
        prefix={<Icons.SearchOutlined iconSize="s" />}
        value={query}
        onChange={event => setQuery(event.target.value)}
        allowClear
        data-test="auradata-assistant-search"
      />
      <Groups>
        {groups.map(group => (
          <section key={group.label} aria-label={group.label}>
            <h4>{group.label}</h4>
            <ul>
              {group.conversations.map(item => (
                <li key={item.id}>{row(item)}</li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && (
          <Nothing>{t('No conversation has that title.')}</Nothing>
        )}
      </Groups>
    </Column>
  );
}
