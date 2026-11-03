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
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import RightMenu from 'src/features/home/RightMenu';
import type { MenuData, User } from 'src/types/bootstrapTypes';
import { AURA_GRADIENT } from './brand';
import { setReportHeaderSlot } from './reportHeader';
import { BrandLink } from './Sidebar';

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

const Brand = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    flex-shrink: 0;

    a {
      display: flex;
      align-items: center;
      /* Half the symbol's height around it, as the brand guidelines ask */
      gap: ${theme.sizeUnit * 3}px;
      text-decoration: none;
    }

    img {
      display: block;
      height: 26px;
    }
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
    padding: 0 ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 4}px;
    border-radius: 999px;
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
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    kbd {
      font-family: ${theme.fontFamilyCode};
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 999px;
      border: 1px solid ${theme.colorBorder};
      background: ${theme.colorBgContainer};
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const ReportSlot = styled.div`
  flex: 1;
  min-width: 0;
  height: 100%;
`;

const SearchIcon = styled.button`
  ${({ theme }) => css`
    all: unset;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 8}px;
    height: ${theme.sizeUnit * 8}px;
    border-radius: 50%;
    color: ${theme.colorTextSecondary};
    cursor: pointer;

    &:hover {
      background: ${theme.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
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
    height: ${theme.sizeUnit * 8.5}px;
    padding: 0 ${theme.sizeUnit * 4}px 0 ${theme.sizeUnit * 3.5}px;
    /* The primary call to action of auradata.mx: an ink pill that glows */
    border-radius: 999px;
    background: ${theme.colorText};
    color: ${theme.colorBgContainer};
    font-weight: ${theme.fontWeightStrong};
    font-size: ${theme.fontSize}px;
    line-height: 1;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 1px 2px rgba(0, 0, 0, 0.2);
    transition:
      box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1),
      transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);

    &:hover {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.18),
        0 8px 32px -8px rgba(37, 99, 235, 0.45);
    }

    &:active {
      transform: scale(0.98);
    }
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
      background: ${AURA_GRADIENT};
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
  /** Show the logo and only a search icon, for pages without the sidebar. */
  showBrand?: boolean;
  /** Only the AuraData symbol, for phones. */
  compactBrand?: boolean;
  /** Leave room for the title and actions of the report. */
  reportHeader?: boolean;
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({
  data,
  isFrontendRoute,
  onSearch,
  showBrand = false,
  compactBrand = false,
  reportHeader = false,
}: TopBarProps) {
  const user = useSelector<{ user?: User }, User | undefined>(
    state => state.user,
  );
  const anonymous = data.navbar_right.user_is_anonymous;

  return (
    <Bar id="main-menu" role="banner" data-test="mibi-topbar">
      {showBrand && (
        <Brand data-test="mibi-topbar-brand">
          <BrandLink compact={compactBrand} />
        </Brand>
      )}
      {showBrand ? (
        <>
          {reportHeader && (
            <ReportSlot
              ref={setReportHeaderSlot}
              data-test="mibi-report-slot"
            />
          )}
          <Tooltip title={isMac ? '⌘ K' : 'Ctrl K'} placement="bottom">
            <SearchIcon
              type="button"
              onClick={onSearch}
              aria-label={t('Search dashboards and pages…')}
              data-test="mibi-search-trigger"
            >
              <Icons.SearchOutlined />
            </SearchIcon>
          </Tooltip>
        </>
      ) : (
        <SearchTrigger
          type="button"
          onClick={onSearch}
          data-test="mibi-search-trigger"
        >
          <Icons.SearchOutlined />
          <span className="placeholder">
            {t('Search dashboards and pages…')}
          </span>
          <kbd>{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
        </SearchTrigger>
      )}
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
              <span className="label mibi-new-label">{t('New')}</span>
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
