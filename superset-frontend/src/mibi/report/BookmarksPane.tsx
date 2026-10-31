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
import { useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Checkbox, Input, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import {
  addBookmark,
  applyBookmark,
  bookmarksOf,
  deleteBookmark,
  editBookmark,
  moveBookmark,
  updateBookmark,
} from './bookmarks';
import type { Bookmark, BookmarkOptions } from './types';

const Pane = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px;

    .intro {
      margin: 0;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }

    .empty {
      padding: ${theme.sizeUnit * 6}px ${theme.sizeUnit * 4}px;
      border: 1px dashed ${theme.colorBorder};
      border-radius: ${theme.borderRadiusLG}px;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
      text-align: center;
    }
  `}
`;

const Card = styled.div<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid
      ${$active ? theme.colorPrimaryBorder : theme.colorBorderSecondary};
    background: ${$active ? theme.colorPrimaryBg : theme.colorBgContainer};

    .row {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
    }

    .name {
      flex: 1;
      min-width: 0;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 3}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const IconAction = styled.button`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: ${theme.borderRadiusSM}px;
    background: transparent;
    color: ${theme.colorTextSecondary};
    cursor: pointer;

    &:hover:not(:disabled) {
      color: ${theme.colorPrimary};
      background: ${theme.colorFillSecondary};
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  `}
`;

function Action({
  title,
  onClick,
  disabled,
  testId,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <IconAction
        type="button"
        aria-label={title}
        data-test={testId}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </IconAction>
    </Tooltip>
  );
}

function BookmarkCard({
  bookmark,
  index,
  count,
  active,
  onApply,
}: {
  bookmark: Bookmark;
  index: number;
  count: number;
  active: boolean;
  onApply: () => void;
}) {
  const dispatch = useDispatch();
  const [name, setName] = useState(bookmark.name);
  const run = (action: unknown) => dispatch(action as never);
  const setOption = (key: keyof BookmarkOptions, value: boolean) =>
    run(
      editBookmark(bookmark.id, {
        options: { ...bookmark.options, [key]: value },
      }),
    );
  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== bookmark.name) {
      run(editBookmark(bookmark.id, { name: trimmed }));
    } else {
      setName(bookmark.name);
    }
  };

  return (
    <Card $active={active} data-test="mibi-bookmark">
      <div className="row">
        <Input
          className="name"
          size="small"
          value={name}
          maxLength={80}
          aria-label={t('Bookmark name')}
          onChange={event => setName(event.target.value)}
          onBlur={commitName}
          onPressEnter={commitName}
        />
        <Action
          title={t('Show this bookmark')}
          onClick={onApply}
          testId="mibi-bookmark-apply"
        >
          <Icons.PlayCircleOutlined iconSize="m" />
        </Action>
        <Action
          title={t('Update with the current view')}
          onClick={() => run(updateBookmark(bookmark.id))}
          testId="mibi-bookmark-update"
        >
          <Icons.SyncOutlined iconSize="m" />
        </Action>
      </div>
      <div className="row">
        <div className="actions">
          <Checkbox
            checked={bookmark.options.data}
            onChange={event => setOption('data', event.target.checked)}
          >
            {t('Data')}
          </Checkbox>
          <Checkbox
            checked={bookmark.options.display}
            onChange={event => setOption('display', event.target.checked)}
          >
            {t('Display')}
          </Checkbox>
          <Checkbox
            checked={bookmark.options.page}
            onChange={event => setOption('page', event.target.checked)}
          >
            {t('Current page')}
          </Checkbox>
        </div>
        <span style={{ flex: 1 }} />
        <Action
          title={t('Move up')}
          disabled={index === 0}
          onClick={() => run(moveBookmark(bookmark.id, -1))}
        >
          <Icons.ArrowUpOutlined iconSize="s" />
        </Action>
        <Action
          title={t('Move down')}
          disabled={index === count - 1}
          onClick={() => run(moveBookmark(bookmark.id, 1))}
        >
          <Icons.ArrowDownOutlined iconSize="s" />
        </Action>
        <Action
          title={t('Delete')}
          onClick={() => run(deleteBookmark(bookmark.id))}
          testId="mibi-bookmark-delete"
        >
          <Icons.DeleteOutlined iconSize="s" />
        </Action>
      </div>
    </Card>
  );
}

/** Bookmarks of the report, in the builder side panel. */
export function BookmarksPane() {
  const dispatch = useDispatch();
  const bookmarks = useSelector((state: RootState) =>
    bookmarksOf(state.dashboardLayout.present),
  );
  const [activeId, setActiveId] = useState<string>();

  const add = () => {
    const bookmark = dispatch(
      addBookmark(t('Bookmark %s', bookmarks.length + 1)) as never,
    ) as unknown as Bookmark;
    setActiveId(bookmark?.id);
  };

  return (
    <Pane data-test="mibi-bookmarks-pane">
      <Button
        buttonStyle="primary"
        icon={<Icons.PlusOutlined />}
        onClick={add}
        data-test="mibi-bookmark-add"
      >
        {t('Add bookmark')}
      </Button>
      <p className="intro">
        {t(
          'A bookmark saves the current page, filter selections and which objects show. Viewers open it from the Bookmarks menu or from a button.',
        )}
      </p>
      {bookmarks.length === 0 ? (
        <div className="empty">
          {t('Set up the view you want, then add a bookmark.')}
        </div>
      ) : (
        bookmarks.map((bookmark, index) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            index={index}
            count={bookmarks.length}
            active={bookmark.id === activeId}
            onApply={() => {
              dispatch(applyBookmark(bookmark.id) as never);
              setActiveId(bookmark.id);
            }}
          />
        ))
      )}
    </Pane>
  );
}
