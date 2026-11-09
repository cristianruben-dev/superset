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
/* eslint-env browser */
import {
  clearPendingFields,
  useFollowFieldSteps,
} from 'src/auradata/format/chartFields';
import { memo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import tinycolor from 'tinycolor2';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  BUILDER_SIDEPANEL_RAIL_WIDTH,
  BUILDER_SIDEPANEL_WIDTH,
} from 'src/dashboard/constants';
import {
  setBuilderTab,
  setPaneCollapsed,
  useBuilderTab,
  usePaneCollapsed,
  type BuilderTab,
} from 'src/auradata/format/panes';
import { SelectionPane } from 'src/auradata/format/SelectionPane';
import SliceAdder from 'src/dashboard/containers/SliceAdder';
import dashboardComponents from 'src/visualizations/presets/dashboardComponents';
import type { RootState } from 'src/dashboard/types';
import NewDivider from '../gridComponents/new/NewDivider';
import NewHeader from '../gridComponents/new/NewHeader';
import NewTabs from '../gridComponents/new/NewTabs';
import NewMarkdown from '../gridComponents/new/NewMarkdown';
import NewDynamicComponent from '../gridComponents/new/NewDynamicComponent';
import { FormatPane } from 'src/auradata/format/FormatPane';
import { NewElements } from 'src/auradata/elements/NewElements';
import { BookmarksPane } from 'src/auradata/report/BookmarksPane';
import { AssistantChat } from 'src/auradata/assistant/AssistantPanel';
import { useAssistantAccess } from 'src/auradata/assistant/useAssistant';
import { selectVisual, useOnOpenFormat } from 'src/auradata/format/selection';
import { useObjectShortcuts } from 'src/auradata/format/useObjectCommands';

const TABS_KEYS = {
  FORMAT: 'FORMAT',
  SELECTION: 'SELECTION',
  BOOKMARKS: 'BOOKMARKS',
  ASSISTANT: 'ASSISTANT',
  CHARTS: 'CHARTS',
  LAYOUT_ELEMENTS: 'LAYOUT_ELEMENTS',
} as const;

const BuilderComponentPane = ({ topOffset = 0, pageTop = 0 }) => {
  const theme = useTheme();
  // The header is sticky and the app bar is not: the pane fills what they leave
  const occupied = topOffset + pageTop;
  const activeKey = useBuilderTab();
  const collapsed = usePaneCollapsed('builder');
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const assistant = useAssistantAccess(dashboardId);
  const width = collapsed
    ? BUILDER_SIDEPANEL_RAIL_WIDTH
    : BUILDER_SIDEPANEL_WIDTH;

  // Choosing an object to format opens the pane
  useOnOpenFormat(
    useCallback(() => {
      setBuilderTab(TABS_KEYS.FORMAT);
      setPaneCollapsed('builder', false);
    }, []),
  );
  // Leaving the builder forgets the chart being formatted and its unsaved fields
  useEffect(
    () => () => {
      selectVisual(null);
      clearPendingFields();
    },
    [],
  );
  useObjectShortcuts();
  useFollowFieldSteps();

  const tabItems = [
    {
      key: TABS_KEYS.FORMAT,
      label: t('Format'),
      icon: <Icons.BgColorsOutlined iconSize="m" />,
      content: (
        <div
          css={css`
            height: calc(100vh - ${occupied}px);
          `}
        >
          <FormatPane />
        </div>
      ),
    },
    {
      key: TABS_KEYS.SELECTION,
      label: t('Selection'),
      icon: <Icons.OrderedListOutlined iconSize="m" />,
      content: (
        <div
          css={css`
            height: calc(100vh - ${occupied}px);
          `}
        >
          <SelectionPane />
        </div>
      ),
    },
    {
      key: TABS_KEYS.BOOKMARKS,
      label: t('Bookmarks'),
      icon: <Icons.BookOutlined iconSize="m" />,
      content: (
        <div
          css={css`
            height: calc(100vh - ${occupied}px);
            overflow-y: auto;
          `}
        >
          <BookmarksPane />
        </div>
      ),
    },
    ...(assistant.editModels.length
      ? [
          {
            key: TABS_KEYS.ASSISTANT,
            label: t('Assistant'),
            icon: <Icons.CommentOutlined iconSize="m" />,
            content: (
              <div
                css={css`
                  height: calc(100vh - ${occupied}px);
                `}
              >
                <AssistantChat
                  mode="edit"
                  access={{
                    ...assistant,
                    models: assistant.editModels,
                  }}
                  active
                />
              </div>
            ),
          },
        ]
      : []),
    ...(activeKey === TABS_KEYS.CHARTS
      ? [
          {
            key: TABS_KEYS.CHARTS,
            label: t('Charts'),
            icon: <Icons.BarChartOutlined iconSize="m" />,
            content: (
              <div
                css={css`
                  height: calc(100vh - ${occupied}px);
                `}
              >
                <SliceAdder />
              </div>
            ),
          },
        ]
      : []),
    ...(activeKey === TABS_KEYS.LAYOUT_ELEMENTS
      ? [
          {
            key: TABS_KEYS.LAYOUT_ELEMENTS,
            label: t('Elements'),
            icon: <Icons.AppstoreOutlined iconSize="m" />,
            content: (
              <div
                css={css`
                  height: calc(100vh - ${occupied}px);
                  overflow-y: auto;
                `}
              >
                <NewElements />
                <NewTabs />
                <NewHeader />
                <NewMarkdown />
                <NewDivider />
                {dashboardComponents
                  .getAll()
                  .map(({ key: componentKey, metadata }) => (
                    <NewDynamicComponent
                      key={componentKey}
                      metadata={metadata}
                      componentKey={componentKey}
                    />
                  ))}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div
      data-test="dashboard-builder-sidepane"
      css={css`
        position: sticky;
        right: 0;
        top: ${topOffset}px;
        height: calc(100vh - ${occupied}px);
        width: ${width}px;
        display: flex;
        flex-direction: row;
        box-shadow: -${theme.sizeUnit}px 0 ${theme.sizeUnit}px 0
          ${tinycolor(theme.colorBorder).setAlpha(0.1).toRgbString()};
        background-color: ${theme.colorBgContainer};
        transition: width 0.15s ease-in-out;
      `}
    >
      {/* Pane Content */}
      <div
        css={css`
          display: ${collapsed ? 'none' : 'block'};
          flex: 1;
          min-width: 0;
          height: 100%;
          border-right: 1px solid ${theme.colorBorderSecondary};
          overflow: hidden;
        `}
      >
        {tabItems.find(item => item.key === activeKey)?.content ??
          tabItems[0]?.content}
      </div>

      {/* Power BI Style Vertical Pane Switcher Rail */}
      <div
        role="tablist"
        aria-orientation="vertical"
        data-test="dashboard-builder-component-pane-tabs-navigation"
        css={css`
          width: ${BUILDER_SIDEPANEL_RAIL_WIDTH}px;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: ${theme.sizeUnit * 2}px;
          background: ${theme.colorBgContainer};
          user-select: none;
        `}
      >
        <button
          type="button"
          data-test="dashboard-builder-pane-toggle"
          aria-label={collapsed ? t('Open the panel') : t('Fold the panel')}
          title={collapsed ? t('Open the panel') : t('Fold the panel')}
          onClick={() => setPaneCollapsed('builder', !collapsed)}
          css={css`
            width: ${theme.sizeUnit * 8}px;
            height: ${theme.sizeUnit * 8}px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: ${theme.borderRadius}px;
            background: transparent;
            color: ${theme.colorTextSecondary};
            cursor: pointer;
            margin-bottom: ${theme.sizeUnit * 2}px;
            &:hover {
              background: ${theme.colorFillTertiary};
            }
          `}
        >
          {collapsed ? (
            <Icons.MenuUnfoldOutlined iconSize="m" />
          ) : (
            <Icons.MenuFoldOutlined iconSize="m" />
          )}
        </button>

        {tabItems.map(item => {
          const isSelected = !collapsed && activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-test={`builder-tab-${item.key.toLowerCase()}`}
              title={item.label}
              onClick={() => {
                if (activeKey === item.key && !collapsed) {
                  setPaneCollapsed('builder', true);
                } else {
                  setBuilderTab(item.key as BuilderTab);
                  setPaneCollapsed('builder', false);
                }
              }}
              css={css`
                all: unset;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2px;
                width: 100%;
                padding: ${theme.sizeUnit * 2}px 0;
                cursor: pointer;
                font-size: 10px;
                line-height: 1.1;
                text-align: center;
                color: ${isSelected
                  ? theme.colorPrimary
                  : theme.colorTextSecondary};
                background: ${isSelected
                  ? theme.colorPrimaryBg
                  : 'transparent'};
                border-right: ${isSelected
                  ? `3px solid ${theme.colorPrimary}`
                  : '3px solid transparent'};
                transition: all 0.15s ease;

                &:hover {
                  background: ${isSelected
                    ? theme.colorPrimaryBg
                    : theme.colorFillTertiary};
                  color: ${theme.colorText};
                }

                .anticon {
                  margin: 0;
                }
              `}
            >
              {item.icon}
              <span
                css={css`
                  max-width: 40px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                `}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default memo(BuilderComponentPane);
