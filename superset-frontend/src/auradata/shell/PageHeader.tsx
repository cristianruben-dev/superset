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
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import type { NavSection } from './navigation';
import { navCrumbs, useExtraCrumbs, type Crumb } from './pageCrumbs';

const Strip = styled.nav`
  ${({ theme }) => css`
    display: flex;
    flex: none;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    height: ${theme.sizeUnit * 8}px;
    padding: 0 var(--mb-space-gutter);
    background: ${theme.colorBgContainer};
    font-family: ${theme.fontFamilyCode};
    font-size: 11px;
    line-height: 1;
    color: ${theme.colorTextTertiary};
    white-space: nowrap;
    overflow: hidden;

    ol {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      min-width: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sep {
      flex: none;
      color: ${theme.colorBorder};
    }

    a {
      color: inherit;
      text-decoration: none;

      &:hover {
        color: ${theme.colorPrimary};
      }
    }

    [aria-current='page'] {
      color: ${theme.colorTextSecondary};
    }

    @media (max-width: 767px) {
      height: 36px;
      padding: 0 ${theme.sizeUnit * 2}px;
      font-size: 12px;
      overflow-x: auto;
      overflow-y: visible;

      ol {
        height: 100%;
      }

      li {
        display: flex;
        align-items: center;
        font-size: 12px;
      }

      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        min-width: 44px;
        padding: 0 ${theme.sizeUnit}px;
        font-size: 12px;
      }
    }
  `}
`;

/**
 * The breadcrumb trail under the top bar of every page out of a report: where
 * the page sits in the navigation, plus what the page adds (`usePageCrumbs`).
 */
export function ShellCrumbs({
  sections,
  pathname,
}: {
  sections: NavSection[];
  pathname: string;
}) {
  const extra = useExtraCrumbs();
  const nav = navCrumbs(sections, pathname);
  // A page that names itself is also a navigation entry for some users
  const last = nav[nav.length - 1]?.label;
  const crumbs: Crumb[] = [
    ...nav,
    ...extra.filter((crumb, index) => index > 0 || crumb.label !== last),
  ];
  if (!crumbs.length) return null;
  return (
    <Strip aria-label={t('Breadcrumb')} data-test="auradata-crumbs">
      <ol>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${index}-${crumb.label}`}>
              {index > 0 && (
                <li className="sep" aria-hidden>
                  /
                </li>
              )}
              <li aria-current={last ? 'page' : undefined}>
                {crumb.url && !last ? (
                  <Link to={crumb.url}>{crumb.label}</Link>
                ) : (
                  crumb.label
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </Strip>
  );
}

const Header = styled.header`
  ${({ theme }) => css`
    display: flex;
    flex: none;
    align-items: center;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    min-height: ${theme.sizeUnit * 14}px;
    padding: ${theme.sizeUnit * 2}px var(--mb-space-gutter);
    background: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    .titles {
      display: flex;
      align-items: baseline;
      gap: ${theme.sizeUnit * 3}px;
      flex: 1;
      min-width: min(240px, 100%);
    }

    h1 {
      margin: 0;
      overflow: hidden;
      font-size: 18px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.012em;
      line-height: 1.3;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: ${theme.colorText};
    }

    .meta {
      flex: none;
      font-family: ${theme.fontFamilyCode};
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: ${theme.colorTextTertiary};
    }

    .commands {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 2}px;
    }

    @media (max-width: 767px) {
      min-height: 40px;
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      gap: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;

      .titles {
        gap: ${theme.sizeUnit}px;
      }

      h1 {
        font-size: 16px;
      }

      .meta {
        font-size: 12px;
      }
    }
  `}
`;

const Group = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    /* A phone wraps the commands instead of widening the page */
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 2}px;

    & + & {
      padding-left: ${theme.sizeUnit * 2}px;
      border-left: 1px solid ${theme.colorBorderSecondary};
    }
  `}
`;

/** Commands that belong together, split from the next group by a hairline. */
export function CommandGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Group role="group" aria-label={label}>
      {children}
    </Group>
  );
}

/**
 * The title row of a page out of a report: its name, figures about it in Geist
 * Mono, and its commands in groups on the right.
 */
export function PageHeader({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Header data-test="auradata-page-header">
      <div className="titles">
        <h1>{title}</h1>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {children && <div className="commands">{children}</div>}
    </Header>
  );
}
