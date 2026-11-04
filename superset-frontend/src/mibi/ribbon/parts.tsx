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
import cx from 'classnames';
import { css, styled } from '@apache-superset/core/theme';
import { Dropdown, Tooltip } from '@superset-ui/core/components';
import type { MenuProps } from '@superset-ui/core/components/Menu';
import { Icons } from '@superset-ui/core/components/Icons';

export const RibbonBar = styled.div`
  ${({ theme }) => css`
    border-top: 1px solid ${theme.colorBorderSecondary};
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export const RibbonTabs = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: 0 ${theme.sizeUnit * 3}px;
    height: ${theme.sizeUnit * 7}px;

    .spacer {
      flex: 1;
    }
  `}
`;

export const RibbonTab = styled.button<{
  $active: boolean;
  $contextual?: boolean;
}>`
  ${({ theme, $active, $contextual }) => css`
    height: 100%;
    padding: 0 ${theme.sizeUnit * 3}px;
    border: 0;
    border-bottom: 2px solid ${$active ? theme.colorPrimary : 'transparent'};
    background: transparent;
    font-size: ${theme.fontSize}px;
    font-weight: ${$active ? 600 : 400};
    color: ${
      $contextual
        ? theme.colorPrimary
        : $active
          ? theme.colorText
          : theme.colorTextSecondary
    };
    cursor: pointer;

    &:hover {
      color: ${$contextual ? theme.colorPrimaryHover : theme.colorText};
    }
  `}
`;

export const RibbonBody = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: stretch;
    min-height: ${theme.sizeUnit * 19}px;
    padding: 2px ${theme.sizeUnit * 2}px 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  `}
`;

const GroupBox = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex: none;
    flex-direction: column;
    padding: 0 ${theme.sizeUnit}px;
    border-right: 1px solid ${theme.colorBorderSecondary};

    &:last-of-type {
      border-right: 0;
    }

    .items {
      display: flex;
      flex: 1;
      align-items: flex-start;
      gap: 2px;
    }

    .caption {
      padding: 0;
      line-height: 14px;
      text-align: center;
      font-size: 11px;
      color: ${theme.colorTextTertiary};
    }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
  `}
`;

export function RibbonGroup({
  label,
  children,
  'data-test': dataTest,
}: {
  label: string;
  children: ReactNode;
  'data-test'?: string;
}) {
  return (
    <GroupBox role="group" aria-label={label} data-test={dataTest}>
      <div className="items">{children}</div>
      <div className="caption">{label}</div>
    </GroupBox>
  );
}

const BaseButton = styled.button`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    border: 1px solid transparent;
    border-radius: ${theme.borderRadiusSM}px;
    background: transparent;
    color: ${theme.colorText};
    cursor: pointer;

    .anticon {
      color: ${theme.colorPrimary};
    }

    &:hover:not(:disabled) {
      background: ${theme.colorFillTertiary};
    }

    &.pressed {
      background: ${theme.colorPrimaryBg};
      border-color: ${theme.colorPrimaryBorder};
    }

    &:disabled {
      color: ${theme.colorTextDisabled};
      cursor: default;

      .anticon {
        color: ${theme.colorTextDisabled};
      }
    }

    &.large {
      flex-direction: column;
      justify-content: flex-start;
      gap: 2px;
      width: ${theme.sizeUnit * 16}px;
      min-height: ${theme.sizeUnit * 14}px;
      padding: 2px;
      font-size: 11px;
      line-height: 1.2;
      text-align: center;

      .anticon {
        font-size: 18px;
        line-height: 22px;
      }
    }

    &.small {
      gap: ${theme.sizeUnit * 1.5}px;
      height: ${theme.sizeUnit * 4.5}px;
      padding: 0 ${theme.sizeUnit * 1.5}px;
      font-size: 11px;
      white-space: nowrap;
    }

    .caret,
    &.large .caret {
      font-size: 10px;
      line-height: 1;
      color: ${theme.colorTextTertiary};
    }

    /* The icon draws at the size of its own svg, whatever the font says */
    .caret svg {
      width: 10px;
      height: 10px;
    }

    &:disabled .caret {
      color: ${theme.colorTextDisabled};
    }
  `}
`;

export interface RibbonButtonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  small?: boolean;
  /** Explains the action or gives its keyboard shortcut */
  hint?: string;
  /** Opens this menu instead of running an action */
  menu?: MenuProps;
  /** Draws the arrow of a button that opens something of its own */
  caret?: boolean;
  'data-test'?: string;
}

/** A command of the ribbon: large, or small to stack three in a column. */
export function RibbonButton({
  label,
  icon,
  onClick,
  disabled,
  pressed,
  small,
  hint,
  menu,
  caret,
  'data-test': dataTest,
}: RibbonButtonProps) {
  const button = (
    <BaseButton
      type="button"
      className={cx(small ? 'small' : 'large', pressed && 'pressed')}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      data-test={dataTest}
    >
      {icon}
      <span>
        {label}
        {(menu || caret) && (
          <>
            {' '}
            <Icons.DownOutlined className="caret" iconSize="xs" />
          </>
        )}
      </span>
    </BaseButton>
  );
  const body = menu ? (
    <Dropdown trigger={['click']} disabled={disabled} menu={menu}>
      {button}
    </Dropdown>
  ) : (
    button
  );
  return hint ? (
    <Tooltip title={hint} placement="bottom" mouseEnterDelay={0.4}>
      <span>{body}</span>
    </Tooltip>
  ) : (
    body
  );
}
