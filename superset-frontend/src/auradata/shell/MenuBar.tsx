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
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Dropdown } from '@superset-ui/core/components';
import type { MenuItem } from '@superset-ui/core/components/Menu';

/** The height of a menu bar, which the sidebar leaves above itself. */
export const MENU_BAR_HEIGHT = 36;
/** The height of the menu bar on phones, leaving room for 44px touch targets. */
export const MENU_BAR_PHONE_HEIGHT = 44;

export interface MenuBarMenu {
  key: string;
  label: string;
  items: MenuItem[];
}

const Bar = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: ${MENU_BAR_HEIGHT}px;
    padding: 0 calc(var(--mb-space-gutter) - ${theme.sizeUnit * 2}px);
    /* The frame of the window, a shade apart from the top bar under it */
    background: ${theme.colorBgLayout};
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    font-size: ${theme.fontSizeSM + 1}px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;

    .end {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      margin-left: auto;
      padding-right: ${theme.sizeUnit * 2}px;
      font-family: ${theme.fontFamilyCode};
      font-size: 11px;
      color: ${theme.colorTextTertiary};
      white-space: nowrap;
    }

    @media (max-width: 767px) {
      height: ${MENU_BAR_PHONE_HEIGHT}px;
      padding: 0 ${theme.sizeUnit * 2}px;
      font-size: 12px;

      .end {
        font-size: 12px;
      }
    }
  `}
`;

const Trigger = styled.button`
  ${({ theme }) => css`
    flex: none;
    height: ${theme.sizeUnit * 7}px;
    padding: 0 ${theme.sizeUnit * 2.5}px;
    border: 0;
    border-radius: ${theme.borderRadiusSM}px;
    background: transparent;
    color: ${theme.colorText};
    font: inherit;
    cursor: pointer;

    &:hover,
    &.open {
      background: ${theme.colorFillTertiary};
    }

    &.open {
      color: ${theme.colorPrimary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
    }

    @media (max-width: 767px) {
      min-height: 44px;
      min-width: 44px;
      padding: 0 ${theme.sizeUnit * 2}px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `}
`;

const Shortcut = styled.kbd`
  ${({ theme }) => css`
    margin-left: ${theme.sizeUnit * 6}px;
    padding: 0;
    border: 0;
    background: none;
    font-family: ${theme.fontFamilyCode};
    font-size: 11px;
    color: ${theme.colorTextTertiary};

    @media (max-width: 767px) {
      font-size: 12px;
    }
  `}
`;

/** The label of a menu item with its keyboard shortcut on the right. */
export function withShortcut(label: string, shortcut: string): ReactNode {
  return (
    <span
      css={css`
        display: flex;
        justify-content: space-between;
      `}
    >
      {label}
      <Shortcut>{shortcut}</Shortcut>
    </span>
  );
}

/**
 * A row of drop-down menus, as the menu bar of a desktop application
 * (File, View…). Once a menu is open, pointing at another opens that one.
 */
export function MenuBar({
  menus,
  end,
  'data-test': dataTest,
}: {
  menus: MenuBarMenu[];
  /** Shown at the right end of the bar, in Geist Mono */
  end?: ReactNode;
  'data-test'?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Bar role="menubar" aria-label={t('Menu bar')} data-test={dataTest}>
      {menus
        .filter(menu => menu.items.length)
        .map(menu => (
          <Dropdown
            key={menu.key}
            trigger={['click']}
            open={open === menu.key}
            onOpenChange={value =>
              setOpen(current =>
                value ? menu.key : current === menu.key ? null : current,
              )
            }
            menu={{
              items: menu.items,
              onClick: () => setOpen(null),
            }}
          >
            <Trigger
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open === menu.key}
              className={open === menu.key ? 'open' : undefined}
              onMouseEnter={() => {
                if (open && open !== menu.key) setOpen(menu.key);
              }}
              data-test={`auradata-menu-${menu.key}`}
            >
              {menu.label}
            </Trigger>
          </Dropdown>
        ))}
      {end && <div className="end">{end}</div>}
    </Bar>
  );
}
