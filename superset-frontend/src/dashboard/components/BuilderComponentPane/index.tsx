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
import { useCallback, useEffect, useState } from 'react';
import tinycolor from 'tinycolor2';
import Tabs from '@superset-ui/core/components/Tabs';
import { t } from '@apache-superset/core/translation';
import { css, SupersetTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  BUILDER_SIDEPANEL_RAIL_WIDTH,
  BUILDER_SIDEPANEL_WIDTH,
} from 'src/dashboard/constants';
import { setPaneCollapsed, usePaneCollapsed } from 'src/mibi/format/panes';
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
  BOOKMARKS: 'BOOKMARKS',
};

const BuilderComponentPane = ({ topOffset = 0 }) => {
  const [activeKey, setActiveKey] = useState(TABS_KEYS.CHARTS);
  const collapsed = usePaneCollapsed('builder');
  const width = collapsed
    ? BUILDER_SIDEPANEL_RAIL_WIDTH
    : BUILDER_SIDEPANEL_WIDTH;
  // Choosing an object to format opens the pane
  useOnOpenFormat(
    useCallback(() => {
      setActiveKey(TABS_KEYS.FORMAT);
      setPaneCollapsed('builder', false);
    }, []),
  );
  // Leaving the builder forgets the chart being formatted
  useEffect(
    () => () => {
      selectVisual(null);
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
        height: calc(100vh - ${topOffset}px);
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
          css={css`
            display: ${collapsed ? 'none' : 'block'};
            height: 100%;
            padding-left: 28px;
            box-sizing: border-box;
          `}
        >
          <Tabs
            data-test="dashboard-builder-component-pane-tabs-navigation"
            id="tabs"
            activeKey={activeKey}
            onChange={setActiveKey}
            // AuraData BI: four tabs (with Bookmarks) fit side by side
            tabBarGutter={16}
            css={(theme: SupersetTheme) => css`
              line-height: inherit;
              margin-top: ${theme.sizeUnit * 2}px;
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
                label: t('Charts'),
                children: (
                  <div
                    css={css`
                      height: calc(100vh - ${topOffset * 2}px);
                    `}
                  >
                    <SliceAdder />
                  </div>
                ),
              },
              {
                key: TABS_KEYS.LAYOUT_ELEMENTS,
                label: t('Layout elements'),
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
                label: t('Format'),
                children: (
                  <div
                    css={css`
                      height: calc(100vh - ${topOffset + 56}px);
                    `}
                  >
                    <FormatPane />
                  </div>
                ),
              },
              {
                key: TABS_KEYS.BOOKMARKS,
                label: t('Bookmarks'),
                children: (
                  <div
                    css={css`
                      height: calc(100vh - ${topOffset + 56}px);
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
