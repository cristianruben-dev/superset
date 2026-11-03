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
import { clearPendingFields } from 'src/mibi/format/chartFields';
import { useCallback, useEffect, type ReactNode } from 'react';
import tinycolor from 'tinycolor2';
import Tabs from '@superset-ui/core/components/Tabs';
import { t } from '@apache-superset/core/translation';
import { css, SupersetTheme } from '@apache-superset/core/theme';
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
} from 'src/mibi/format/panes';
import { SelectionPane } from 'src/mibi/format/SelectionPane';
import SliceAdder from 'src/dashboard/containers/SliceAdder';
import dashboardComponents from 'src/visualizations/presets/dashboardComponents';
import NewDivider from '../gridComponents/new/NewDivider';
import NewHeader from '../gridComponents/new/NewHeader';
import NewTabs from '../gridComponents/new/NewTabs';
import NewMarkdown from '../gridComponents/new/NewMarkdown';
import NewDynamicComponent from '../gridComponents/new/NewDynamicComponent';
import { FormatPane } from 'src/mibi/format/FormatPane';
import { NewElements } from 'src/mibi/elements/NewElements';
import { BookmarksPane } from 'src/mibi/report/BookmarksPane';
import { selectVisual, useOnOpenFormat } from 'src/mibi/format/selection';
import { useObjectShortcuts } from 'src/mibi/format/useObjectCommands';

const TABS_KEYS = {
  CHARTS: 'CHARTS',
  LAYOUT_ELEMENTS: 'LAYOUT_ELEMENTS',
  FORMAT: 'FORMAT',
  SELECTION: 'SELECTION',
  BOOKMARKS: 'BOOKMARKS',
} as const;

/** The label of a pane tab: an icon over a short name, so five fit side by side. */
const paneLabel = (icon: ReactNode, label: string) => (
  <span
    css={css`
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: 11px;
      line-height: 1.2;
      .anticon {
        margin: 0;
      }
    `}
  >
    {icon}
    {label}
  </span>
);

const BuilderComponentPane = ({ topOffset = 0, pageTop = 0 }) => {
  // The header is sticky and the app bar is not: the pane fills what they leave
  const occupied = topOffset + pageTop;
  const activeKey = useBuilderTab();
  const collapsed = usePaneCollapsed('builder');
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

  return (
    <div
      data-test="dashboard-builder-sidepane"
      css={css`
        position: sticky;
        right: 0;
        top: ${topOffset}px;
        height: calc(100vh - ${occupied}px);
        width: ${width}px;
      `}
    >
      <div
        css={(theme: SupersetTheme) => css`
          position: absolute;
          height: 100%;
          width: ${width}px;
          box-shadow: -${theme.sizeUnit}px 0 ${theme.sizeUnit}px 0
            ${tinycolor(theme.colorBorder).setAlpha(0.1).toRgbString()};
          background-color: ${theme.colorBgBase};
        `}
      >
        <button
          type="button"
          data-test="dashboard-builder-pane-toggle"
          aria-label={collapsed ? t('Open the panel') : t('Fold the panel')}
          title={collapsed ? t('Open the panel') : t('Fold the panel')}
          onClick={() => setPaneCollapsed('builder', !collapsed)}
          css={(theme: SupersetTheme) => css`
            position: absolute;
            top: ${theme.sizeUnit * 2}px;
            left: ${theme.sizeUnit * 1.5}px;
            z-index: 2;
            width: ${theme.sizeUnit * 6}px;
            height: ${theme.sizeUnit * 6}px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: ${theme.borderRadius}px;
            background: transparent;
            color: ${theme.colorTextSecondary};
            cursor: pointer;
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
        <div
          css={(theme: SupersetTheme) => css`
            display: ${collapsed ? 'none' : 'block'};
            height: 100%;
            padding: ${theme.sizeUnit * 2}px 0 0 28px;
            box-sizing: border-box;
          `}
        >
          <Tabs
            data-test="dashboard-builder-component-pane-tabs-navigation"
            id="tabs"
            activeKey={activeKey}
            onChange={key => setBuilderTab(key as BuilderTab)}
            // AuraData BI: five tabs fit side by side
            tabBarGutter={4}
            css={css`
              line-height: inherit;
              height: 100%;

              & .ant-tabs-content-holder {
                height: 100%;
                & .ant-tabs-content {
                  height: 100%;
                }
              }
            `}
            items={[
              {
                key: TABS_KEYS.CHARTS,
                label: paneLabel(
                  <Icons.BarChartOutlined iconSize="m" />,
                  t('Charts'),
                ),
                children: (
                  <div
                    css={css`
                      height: calc(100vh - ${occupied + 77}px);
                    `}
                  >
                    <SliceAdder />
                  </div>
                ),
              },
              {
                key: TABS_KEYS.LAYOUT_ELEMENTS,
                label: paneLabel(
                  <Icons.AppstoreOutlined iconSize="m" />,
                  t('Elements'),
                ),
                children: (
                  <>
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
                  </>
                ),
              },
              {
                key: TABS_KEYS.FORMAT,
                label: paneLabel(
                  <Icons.BgColorsOutlined iconSize="m" />,
                  t('Format'),
                ),
                children: (
                  <div
                    css={css`
                      height: calc(100vh - ${occupied + 77}px);
                    `}
                  >
                    <FormatPane />
                  </div>
                ),
              },
              {
                key: TABS_KEYS.SELECTION,
                label: paneLabel(
                  <Icons.OrderedListOutlined iconSize="m" />,
                  t('Selection'),
                ),
                children: (
                  <div
                    css={css`
                      height: calc(100vh - ${occupied + 77}px);
                    `}
                  >
                    <SelectionPane />
                  </div>
                ),
              },
              {
                key: TABS_KEYS.BOOKMARKS,
                label: paneLabel(
                  <Icons.BookOutlined iconSize="m" />,
                  t('Bookmarks'),
                ),
                children: (
                  <div
                    css={css`
                      height: calc(100vh - ${occupied + 77}px);
                      overflow-y: auto;
                    `}
                  >
                    <BookmarksPane />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default BuilderComponentPane;
