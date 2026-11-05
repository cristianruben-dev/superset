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
import cx from 'classnames';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { isFilterCardOpen, setFilterCardOpen } from './filterSummary';

const Card = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 1.5}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorBgContainer};
    transition:
      border-color ${theme.motionDurationMid},
      box-shadow ${theme.motionDurationMid};
    &:hover {
      border-color: ${theme.colorBorder};
    }
    /* A filter with a selection carries the accent on its edge */
    &.is-on {
      box-shadow: inset 3px 0 0 ${theme.colorPrimary};
    }
  `}
`;

const Head = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2}px
      ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    cursor: pointer;
    user-select: none;
    border-radius: ${theme.borderRadius}px;
    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
    }
    .auradata-filter-card-text {
      flex: 1;
      min-width: 0;
    }
    .auradata-filter-card-name {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      margin: 0;
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
      overflow-wrap: anywhere;
    }
    .auradata-filter-card-summary {
      display: block;
      margin-top: 2px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .auradata-filter-card-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      color: ${theme.colorTextSecondary};
    }
    .auradata-filter-card-chevron {
      display: flex;
      transition: transform ${theme.motionDurationMid};
    }
    &[aria-expanded='true'] .auradata-filter-card-chevron {
      transform: rotate(180deg);
    }
  `}
`;

const Body = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2}px
      ${theme.sizeUnit * 3}px;
    border-top: 1px solid ${theme.colorSplit};
  `}
`;

/**
 * A filter of the filter pane as a card, as in Power BI: its name and what
 * it selects, folded until the reader opens it. Folded, its control stays
 * mounted elsewhere, so the selection keeps applying.
 */
export function FilterCard({
  id,
  name,
  summary,
  active,
  forceOpen = false,
  extra,
  actions,
  children,
}: {
  id: string;
  name: ReactNode;
  summary: string;
  active: boolean;
  /** Kept open, as a required filter without a value */
  forceOpen?: boolean;
  /** Next to the name: required mark, description */
  extra?: ReactNode;
  /** Before the chevron: edit and clear */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => isFilterCardOpen(id));
  const expanded = open || forceOpen;
  const toggle = () => {
    setOpen(!expanded);
    setFilterCardOpen(id, !expanded);
  };
  return (
    <Card
      className={cx('auradata-filter-card', active && 'is-on')}
      data-test="auradata-filter-card"
    >
      <Head
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <div className="auradata-filter-card-text">
          <h4
            className="auradata-filter-card-name"
            id={`filter-name-${id}`}
            data-test="filter-control-name"
          >
            {name}
            {extra}
          </h4>
          <span
            className="auradata-filter-card-summary"
            data-test="auradata-filter-card-summary"
          >
            {summary}
          </span>
        </div>
        {/* Clicks on the actions do not fold the card */}
        <div
          className="auradata-filter-card-actions"
          onClick={event => event.stopPropagation()}
          role="presentation"
        >
          {actions}
        </div>
        <span className="auradata-filter-card-chevron" aria-hidden>
          <Icons.DownOutlined iconSize="s" />
        </span>
      </Head>
      {/* Folded, the control is not drawn; its portal keeps it alive */}
      {expanded && <Body>{children}</Body>}
    </Card>
  );
}
