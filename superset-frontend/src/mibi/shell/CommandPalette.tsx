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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import rison from 'rison';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ensureAppRoot } from 'src/utils/pathUtils';
import type { NavIconName, NavSection } from './navigation';

interface Result {
  key: string;
  label: string;
  hint: string;
  url: string;
  icon: NavIconName;
}

interface DashboardResult {
  id: number;
  dashboard_title: string;
  url: string;
}

const SearchRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 5}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    .anticon {
      color: ${theme.colorTextTertiary};
      font-size: 18px;
    }

    input {
      all: unset;
      flex: 1;
      font-size: ${theme.fontSizeLG}px;
      color: ${theme.colorText};

      &::placeholder {
        color: ${theme.colorTextTertiary};
      }
    }
  `}
`;

const Results = styled.ul`
  ${({ theme }) => css`
    list-style: none;
    margin: 0;
    padding: ${theme.sizeUnit * 2}px;
    max-height: 380px;
    overflow-y: auto;
  `}
`;

const GroupTitle = styled.li`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px ${theme.sizeUnit}px;
    color: ${theme.colorTextTertiary};
    font-size: 11px;
    font-weight: ${theme.fontWeightStrong};
    letter-spacing: 0.06em;
    text-transform: uppercase;
  `}
`;

const ResultItem = styled.li<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 2.5}px ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    cursor: pointer;
    color: ${theme.colorText};
    background: ${$selected ? theme.colorFillSecondary : 'transparent'};

    .anticon {
      color: ${$selected ? theme.colorPrimary : theme.colorTextTertiary};
      font-size: 16px;
    }

    .label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hint {
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

const Empty = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 8}px;
    text-align: center;
    color: ${theme.colorTextTertiary};
  `}
`;

interface CommandPaletteProps {
  show: boolean;
  onHide: () => void;
  sections: NavSection[];
  isFrontendRoute: (path?: string) => boolean;
}

/** Quick search over the pages of AuraData BI and its dashboards (Ctrl/⌘ + K). */
export function CommandPalette({
  show,
  onHide,
  sections,
  isFrontendRoute,
}: CommandPaletteProps) {
  const history = useHistory();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [dashboards, setDashboards] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (show) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    if (!show) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const filters = query
        ? [{ col: 'dashboard_title', opr: 'title_or_slug', value: query }]
        : [];
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/?q=${rison.encode({
          filters,
          order_column: 'changed_on_delta_humanized',
          order_direction: 'desc',
          page_size: 6,
          columns: ['id', 'dashboard_title', 'url'],
        })}`,
      })
        .then(({ json }) =>
          setDashboards(
            (json.result as DashboardResult[]).map(dashboard => ({
              key: `dashboard-${dashboard.id}`,
              label: dashboard.dashboard_title,
              hint: t('Dashboard'),
              url: dashboard.url,
              icon: 'DashboardOutlined',
            })),
          ),
        )
        .catch(() => setDashboards([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [show, query]);

  const pages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sections
      .flatMap(section => section.items)
      .filter(item => !needle || item.label.toLowerCase().includes(needle))
      .map(item => ({ ...item, hint: t('Page') }));
  }, [sections, query]);

  const groups = [
    { title: t('Dashboards'), items: dashboards },
    { title: t('Go to'), items: pages },
  ].filter(group => group.items.length);
  const flat = groups.flatMap(group => group.items);

  useEffect(() => {
    setSelected(index => Math.min(index, Math.max(flat.length - 1, 0)));
  }, [flat.length]);

  const open = (result: Result) => {
    onHide();
    if (isFrontendRoute(result.url)) {
      history.push(result.url);
    } else {
      window.location.href = ensureAppRoot(result.url);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(index => (index + 1) % Math.max(flat.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(
        index => (index - 1 + flat.length) % Math.max(flat.length, 1),
      );
    } else if (event.key === 'Enter' && flat[selected]) {
      event.preventDefault();
      open(flat[selected]);
    }
  };

  let position = -1;
  return (
    <Modal
      show={show}
      onHide={onHide}
      title={null}
      hideFooter
      closable={false}
      width={600}
      name="mibi-command-palette"
      destroyOnHidden
    >
      <SearchRow>
        <Icons.SearchOutlined />
        <input
          ref={inputRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('Search dashboards and pages…')}
          aria-label={t('Search')}
          data-test="mibi-command-input"
        />
      </SearchRow>
      {flat.length ? (
        <Results role="listbox">
          {groups.map(group => (
            <div key={group.title}>
              <GroupTitle role="presentation">{group.title}</GroupTitle>
              {group.items.map(result => {
                position += 1;
                const index = position;
                const Icon = Icons[result.icon];
                return (
                  <ResultItem
                    key={result.key}
                    role="option"
                    aria-selected={index === selected}
                    $selected={index === selected}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => open(result)}
                  >
                    <Icon />
                    <span className="label">{result.label}</span>
                    <span className="hint">{result.hint}</span>
                  </ResultItem>
                );
              })}
            </div>
          ))}
        </Results>
      ) : (
        <Empty>{t('No results')}</Empty>
      )}
    </Modal>
  );
}
