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
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ensureStaticPrefix } from 'src/utils/assetUrl';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { AURA_GRADIENT, PRODUCT_TAG } from './brand';
import { isNavItemActive, type NavItem, type NavSection } from './navigation';

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 68;
// The Continua symbol alone, for the collapsed rail
const MARK_URL = '/static/assets/images/auradata/mark.svg';

const Aside = styled.aside<{ $collapsed: boolean }>`
  ${({ theme, $collapsed }) => css`
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    width: ${$collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px;
    background: ${theme.colorBgContainer};
    border-right: 1px solid ${theme.colorBorderSecondary};
    transition: width ${theme.motionDurationMid} ${theme.motionEaseInOut};
    overflow: hidden;
  `}
`;

const Brand = styled.div<{ $collapsed: boolean }>`
  ${({ theme, $collapsed }) => css`
    display: flex;
    align-items: center;
    justify-content: ${$collapsed ? 'center' : 'flex-start'};
    height: 56px;
    flex-shrink: 0;
    padding: 0 ${$collapsed ? 0 : theme.sizeUnit * 5}px;

    a {
      display: flex;
      align-items: center;
      /* Half the symbol's height around it, as the brand guidelines ask */
      gap: ${theme.sizeUnit * 3}px;
      text-decoration: none;
    }

    img {
      display: block;
      height: ${$collapsed ? 24 : 26}px;
    }
  `}
`;

/** The product next to the AuraData logo, in the brand gradient. */
export const ProductTag = styled.span`
  ${({ theme }) => css`
    padding-left: ${theme.sizeUnit * 3}px;
    border-left: 1px solid ${theme.colorBorder};
    font-family: ${theme.fontFamily};
    font-size: 16px;
    font-weight: 700;
    line-height: 20px;
    letter-spacing: 0.02em;
    background: ${AURA_GRADIENT};
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  `}
`;

const Nav = styled.nav`
  ${({ theme }) => css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
  `}
`;

const SectionTitle = styled.button<{ $collapsed: boolean }>`
  ${({ theme, $collapsed }) => css`
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: ${$collapsed ? theme.sizeUnit * 3 : theme.sizeUnit * 8}px;
    margin-top: ${theme.sizeUnit * 4}px;
    padding: 0 ${theme.sizeUnit * 3}px;
    color: ${theme.colorTextTertiary};
    font-size: 11px;
    font-weight: ${theme.fontWeightStrong};
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: ${$collapsed ? 'default' : 'pointer'};
    border-radius: ${theme.borderRadiusSM}px;

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
    }

    .anticon {
      font-size: 10px;
    }
  `}
`;

const ItemLink = styled(Link, {
  shouldForwardProp: prop => !String(prop).startsWith('$'),
})<{ $active: boolean; $collapsed: boolean }>`
  ${({ theme, $active, $collapsed }) => css`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: ${$collapsed ? 'center' : 'flex-start'};
    gap: ${theme.sizeUnit * 3}px;
    height: ${theme.sizeUnit * 9}px;
    margin: 2px 0;
    padding: 0 ${$collapsed ? 0 : theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    color: ${$active ? theme.colorPrimary : theme.colorTextSecondary};
    background: ${$active ? theme.colorPrimaryBg : 'transparent'};
    font-weight: ${$active ? theme.fontWeightStrong : 500};
    font-size: ${theme.fontSize}px;
    white-space: nowrap;
    text-decoration: none;
    transition:
      background-color ${theme.motionDurationFast},
      color ${theme.motionDurationFast};

    &:hover,
    &:focus {
      text-decoration: none;
    }

    &:hover {
      color: ${$active ? theme.colorPrimary : theme.colorText};
      background: ${$active ? theme.colorPrimaryBg : theme.colorFillSecondary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }

    .anticon {
      font-size: 17px;
      flex-shrink: 0;
    }

    span.label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `}
`;

const Footer = styled.div`
  ${({ theme }) => css`
    flex-shrink: 0;
    padding: ${theme.sizeUnit * 3}px;
    border-top: 1px solid ${theme.colorBorderSecondary};
  `}
`;

const CollapseButton = styled.button<{ $collapsed: boolean }>`
  ${({ theme, $collapsed }) => css`
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: ${$collapsed ? 'center' : 'flex-start'};
    gap: ${theme.sizeUnit * 3}px;
    width: 100%;
    height: ${theme.sizeUnit * 9}px;
    padding: 0 ${$collapsed ? 0 : theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    cursor: pointer;

    &:hover {
      color: ${theme.colorText};
      background: ${theme.colorFillSecondary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
    }

    .anticon {
      font-size: 16px;
    }
  `}
`;

interface SidebarProps {
  sections: NavSection[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isFrontendRoute: (path?: string) => boolean;
}

/** The item whose URL best matches the location (the longest one wins). */
const findActiveKey = (sections: NavSection[], pathname: string) =>
  sections
    .flatMap(section => section.items)
    .filter(item => isNavItemActive(item, pathname))
    .sort((a, b) => b.url.length - a.url.length)[0]?.key;

export function Sidebar({
  sections,
  collapsed,
  onToggleCollapsed,
  isFrontendRoute,
}: SidebarProps) {
  const theme = useTheme();
  const { pathname } = useLocation();
  const activeKey = findActiveKey(sections, pathname);
  const activeSection = sections.find(section =>
    section.items.some(item => item.key === activeKey),
  )?.key;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const renderItem = (item: NavItem) => {
    const Icon = Icons[item.icon];
    const active = item.key === activeKey;
    const content = (
      <ItemLink
        key={item.key}
        to={isFrontendRoute(item.url) ? item.url : { pathname: item.url }}
        onClick={event => {
          // Backend-rendered pages need a full page load
          if (!isFrontendRoute(item.url)) {
            event.preventDefault();
            window.location.href = ensureAppRoot(item.url);
          }
        }}
        $active={active}
        $collapsed={collapsed}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        data-test={`mibi-nav-${item.key}`}
      >
        <Icon iconSize="l" />
        {!collapsed && <span className="label">{item.label}</span>}
      </ItemLink>
    );
    return collapsed ? (
      <Tooltip key={item.key} title={item.label} placement="right">
        {content}
      </Tooltip>
    ) : (
      content
    );
  };

  const brand = useMemo(
    () => (
      <Brand $collapsed={collapsed}>
        <a href={ensureAppRoot(theme.brandLogoHref || '/')}>
          <img
            src={ensureStaticPrefix(
              collapsed ? MARK_URL : theme.brandLogoUrl || MARK_URL,
            )}
            alt={theme.brandLogoAlt || theme.brandAppName || ''}
          />
          {!collapsed && <ProductTag>{PRODUCT_TAG}</ProductTag>}
        </a>
      </Brand>
    ),
    [collapsed, theme],
  );

  return (
    <Aside $collapsed={collapsed} data-test="mibi-sidebar">
      {brand}
      <Nav aria-label={t('Main navigation')}>
        {sections.map(section => {
          const open =
            !section.collapsible ||
            collapsed ||
            (openSections[section.key] ?? activeSection === section.key);
          return (
            <div key={section.key}>
              {section.title && (
                <SectionTitle
                  type="button"
                  $collapsed={collapsed}
                  disabled={collapsed || !section.collapsible}
                  aria-expanded={section.collapsible ? open : undefined}
                  onClick={() =>
                    setOpenSections(state => ({
                      ...state,
                      [section.key]: !open,
                    }))
                  }
                >
                  {!collapsed && section.title}
                  {!collapsed &&
                    section.collapsible &&
                    (open ? <Icons.UpOutlined /> : <Icons.DownOutlined />)}
                </SectionTitle>
              )}
              {open && section.items.map(renderItem)}
            </div>
          );
        })}
      </Nav>
      <Footer>
        <CollapseButton
          type="button"
          $collapsed={collapsed}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
        >
          {collapsed ? (
            <Icons.MenuUnfoldOutlined />
          ) : (
            <Icons.MenuFoldOutlined />
          )}
          {!collapsed && t('Collapse')}
        </CollapseButton>
      </Footer>
    </Aside>
  );
}
