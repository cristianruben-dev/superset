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
import type { ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { FOLDED_PANE_WIDTH, PANE_WIDTHS, type PaneName } from './panes';

const Column = styled.section<{ $width: number }>`
  ${({ theme, $width }) => css`
    flex: none;
    box-sizing: border-box;
    width: ${$width}px;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: ${theme.colorBgContainer};
    border-left: 1px solid ${theme.colorBorderSecondary};

    .pane-column-head {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      min-height: ${theme.sizeUnit * 9}px;
      padding: 0 ${theme.sizeUnit}px 0 ${theme.sizeUnit * 3}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }

    .pane-column-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    .pane-column-fold {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: ${theme.sizeUnit * 6}px;
      height: ${theme.sizeUnit * 6}px;
      padding: 0;
      border: 0;
      border-radius: ${theme.borderRadiusSM}px;
      background: transparent;
      color: ${theme.colorTextSecondary};
      cursor: pointer;

      &:hover {
        background: ${theme.colorFillTertiary};
        color: ${theme.colorText};
      }
    }

    .pane-column-body {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* A folded pane is a strip with its name written downwards */
    .pane-column-strip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      width: 100%;
      height: 100%;
      padding: ${theme.sizeUnit * 2}px 0;
      border: 0;
      background: ${theme.colorBgLayout};
      color: ${theme.colorTextSecondary};
      cursor: pointer;

      &:hover {
        background: ${theme.colorFillTertiary};
        color: ${theme.colorText};
      }
    }

    .pane-column-strip-name {
      writing-mode: vertical-rl;
      white-space: nowrap;
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

/** A pane of the editor that folds into a strip, as the panes of Power BI. */
export function PaneColumn({
  pane,
  title,
  folded,
  onFold,
  actions,
  children,
}: {
  pane: PaneName;
  title: string;
  folded: boolean;
  onFold: (folded: boolean) => void;
  /** Buttons of the pane, before its fold button. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Column
      $width={folded ? FOLDED_PANE_WIDTH : PANE_WIDTHS[pane]}
      aria-label={title}
      data-pane={pane}
      data-test={`auradata-pane-${pane}`}
      className="auradata-pane-column"
    >
      {folded ? (
        <button
          type="button"
          className="pane-column-strip"
          aria-expanded={false}
          aria-label={t('Expand %s', title)}
          title={t('Expand %s', title)}
          data-test={`auradata-pane-${pane}-toggle`}
          onClick={() => onFold(false)}
        >
          <Icons.DoubleLeftOutlined iconSize="s" />
          <span className="pane-column-strip-name">{title}</span>
        </button>
      ) : (
        <>
          <div className="pane-column-head">
            <span className="pane-column-title">{title}</span>
            {actions}
            <button
              type="button"
              className="pane-column-fold"
              aria-expanded
              aria-label={t('Collapse %s', title)}
              title={t('Collapse %s', title)}
              data-test={`auradata-pane-${pane}-toggle`}
              onClick={() => onFold(true)}
            >
              <Icons.DoubleRightOutlined iconSize="s" />
            </button>
          </div>
          <div className="pane-column-body">{children}</div>
        </>
      )}
    </Column>
  );
}
