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
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import RightMenu from 'src/features/home/RightMenu';
import type { MenuData, User } from 'src/types/bootstrapTypes';

const Bar = styled.header`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 4}px;
    height: 56px;
    padding: 0 ${theme.sizeUnit * 6}px;
    background: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    position: relative;
    z-index: 20;
  `}
`;

const SearchTrigger = styled.button`
  ${({ theme }) => css`
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    width: min(420px, 100%);
    height: ${theme.sizeUnit * 9}px;
    padding: 0 ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgLayout};
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSize}px;
    cursor: text;
    transition: border-color ${theme.motionDurationFast};

    &:hover {
      border-color: ${theme.colorBorder};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
    }

    .placeholder {
      flex: 1;
    }

    kbd {
      font-family: ${theme.fontFamily};
      font-size: 11px;
      padding: 1px 6px;
      border-radius: ${theme.borderRadiusSM}px;
      border: 1px solid ${theme.colorBorder};
      background: ${theme.colorBgContainer};
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const Right = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  height: 100%;
`;

const NewButton = styled.span`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 1.5}px;
    height: ${theme.sizeUnit * 8}px;
    padding: 0 ${theme.sizeUnit * 3.5}px;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorPrimary};
    color: ${theme.colorTextLightSolid};
    font-weight: ${theme.fontWeightStrong};
    font-size: ${theme.fontSize}px;
    line-height: 1;
    box-shadow: ${theme.boxShadowTertiary};
  `}
`;

const UserChip = styled.span`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    color: ${theme.colorText};
    font-weight: 500;

    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        ${theme.colorPrimaryHover},
        ${theme.colorPrimaryActive}
      );
      color: ${theme.colorTextLightSolid};
      font-size: 12px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: 0.02em;
    }

    .name {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `}
`;

const initials = (user?: User) => {
  const letters = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map(name => name!.trim()[0])
    .join('');
  return (letters || user?.username?.[0] || '?').toUpperCase();
};

interface TopBarProps {
  data: MenuData;
  isFrontendRoute: (path?: string) => boolean;
  onSearch: () => void;
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ data, isFrontendRoute, onSearch }: TopBarProps) {
  const user = useSelector<{ user?: User }, User | undefined>(
    state => state.user,
  );
  const anonymous = data.navbar_right.user_is_anonymous;

  return (
    <Bar id="main-menu" role="banner" data-test="mibi-topbar">
      <SearchTrigger
        type="button"
        onClick={onSearch}
        data-test="mibi-search-trigger"
      >
        <Icons.SearchOutlined />
        <span className="placeholder">{t('Search dashboards and pages…')}</span>
        <kbd>{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
      </SearchTrigger>
      <Right>
        <RightMenu
          align="flex-end"
          settings={[]}
          navbarRight={data.navbar_right}
          isFrontendRoute={isFrontendRoute}
          environmentTag={data.environment_tag}
          newLabel={
            <NewButton>
              <Icons.PlusOutlined iconSize="m" />
              {t('New')}
            </NewButton>
          }
          settingsLabel={
            anonymous ? undefined : (
              <UserChip>
                <span className="avatar">{initials(user)}</span>
                <span className="name">
                  {user?.firstName || user?.username}
                </span>
                <Icons.DownOutlined iconSize="xs" />
              </UserChip>
            )
          }
        />
      </Right>
    </Bar>
  );
}
