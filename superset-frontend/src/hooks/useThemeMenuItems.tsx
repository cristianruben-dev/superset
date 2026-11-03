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
import { useMemo } from 'react';
import { Icons } from '@superset-ui/core/components';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { t } from '@apache-superset/core/translation';
import { ThemeMode, ThemeAlgorithm, styled } from '@apache-superset/core/theme';
import { NAVBAR_MENU_POPUP_OFFSET } from 'src/features/home/commonMenuData';

const ThemeOption = styled.div`
  display: flex;
  align-items: center;

  & .theme-name {
    flex: 1;
  }

  & .current-theme {
    margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

export interface ThemeSubMenuOption {
  key: ThemeMode;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export interface ThemeSubMenuProps {
  setThemeMode: (newMode: ThemeMode) => void;
  themeMode: ThemeMode;
  allowOSPreference?: boolean;
}

export const useThemeMenuItems = ({
  setThemeMode,
  themeMode,
  allowOSPreference = true,
}: ThemeSubMenuProps): MenuItem => {
  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const themeIconMap: Record<ThemeAlgorithm | ThemeMode, React.ReactNode> =
    useMemo(
      () => ({
        [ThemeAlgorithm.DEFAULT]: <Icons.SunOutlined />,
        [ThemeAlgorithm.DARK]: <Icons.MoonOutlined />,
        [ThemeMode.SYSTEM]: <Icons.DesktopOutlined />,
        [ThemeAlgorithm.COMPACT]: <Icons.CompressOutlined />,
      }),
      [],
    );

  const optionLabel = (
    mode: ThemeMode,
    icon: React.ReactNode,
    label: string,
  ) => (
    <ThemeOption>
      {icon}
      <span className="theme-name">{label}</span>
      {mode === themeMode && (
        <Icons.CheckOutlined className="current-theme" iconSize="s" />
      )}
    </ThemeOption>
  );

  const themeOptions: MenuItem[] = [
    {
      key: ThemeMode.DEFAULT,
      label: optionLabel(ThemeMode.DEFAULT, <Icons.SunOutlined />, t('Light')),
      onClick: () => handleSelect(ThemeMode.DEFAULT),
    },
    {
      key: ThemeMode.DARK,
      label: optionLabel(ThemeMode.DARK, <Icons.MoonOutlined />, t('Dark')),
      onClick: () => handleSelect(ThemeMode.DARK),
    },
    ...(allowOSPreference
      ? [
          {
            key: ThemeMode.SYSTEM,
            label: optionLabel(
              ThemeMode.SYSTEM,
              <Icons.DesktopOutlined />,
              t('Match system'),
            ),
            onClick: () => handleSelect(ThemeMode.SYSTEM),
          },
        ]
      : []),
  ];

  const children: MenuItem[] = [
    {
      type: 'group' as const,
      label: t('Theme'),
      key: 'theme-group',
      children: themeOptions,
    },
  ];

  return {
    key: 'theme-sub-menu',
    label: themeIconMap[themeMode],
    icon: <Icons.DownOutlined iconSize="xs" />,
    className: 'submenu-with-caret',
    children,
    popupOffset: NAVBAR_MENU_POPUP_OFFSET,
  };
};
