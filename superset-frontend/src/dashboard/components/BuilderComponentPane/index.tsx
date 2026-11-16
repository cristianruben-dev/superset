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
import { memo, useCallback, useEffect, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import tinycolor from 'tinycolor2';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  panesWidth,
  setBuilderTab,
  setEditorPanesWidth,
  setPaneCollapsed,
  useFormatPaneTab,
  usePanesCollapsed,
  type PaneName,
} from 'src/auradata/format/panes';
import { PaneColumn } from 'src/auradata/format/PaneColumn';
import { DataPane } from 'src/auradata/format/DataPane';
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

const scrolling = css`
  height: 100%;
  overflow-y: auto;
`;

const BuilderComponentPane = ({ topOffset = 0, pageTop = 0 }) => {
  const theme = useTheme();
  // The header is sticky and the app bar is not: the panes fill what they leave
  const occupied = topOffset + pageTop;
  const formatTab = useFormatPaneTab();
  const folded = usePanesCollapsed();
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const assistant = useAssistantAccess(dashboardId);

  // Choosing an object to format opens the pane
  useOnOpenFormat(
    useCallback(() => {
      setBuilderTab('FORMAT');
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

  // The galleries of charts and elements open in place of the Format pane
  const gallery =
    formatTab === 'CHARTS'
      ? { title: t('Charts'), content: <SliceAdder /> }
      : formatTab === 'LAYOUT_ELEMENTS'
        ? {
            title: t('Elements'),
            content: (
              <div css={scrolling}>
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
          }
        : undefined;

  // Side by side as in Power BI: the Data pane feeds the Format pane beside it
  const panes: {
    pane: PaneName;
    title: string;
    actions?: ReactNode;
    content: ReactNode;
  }[] = [
    {
      pane: 'bookmarks',
      title: t('Bookmarks'),
      content: (
        <div css={scrolling}>
          <BookmarksPane />
        </div>
      ),
    },
    { pane: 'selection', title: t('Selection'), content: <SelectionPane /> },
    {
      pane: 'builder',
      title: gallery?.title ?? t('Format'),
      actions: gallery && (
        <button
          type="button"
          className="pane-column-fold"
          aria-label={t('Back to Format')}
          title={t('Back to Format')}
          data-test="auradata-pane-builder-back"
          onClick={() => setBuilderTab('FORMAT')}
        >
          <Icons.CloseOutlined iconSize="s" />
        </button>
      ),
      content: gallery?.content ?? <FormatPane />,
    },
    { pane: 'data', title: t('Data'), content: <DataPane /> },
    ...(assistant.editModels.length
      ? [
          {
            pane: 'assistant' as const,
            title: t('Assistant'),
            content: (
              <AssistantChat
                mode="edit"
                access={{ ...assistant, models: assistant.editModels }}
                active
              />
            ),
          },
        ]
      : []),
  ];
  const width = panesWidth(
    folded,
    panes.map(({ pane }) => pane),
  );

  // The report leaves the room the panes take
  useEffect(() => setEditorPanesWidth(width), [width]);
  useEffect(() => () => setEditorPanesWidth(0), []);

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
      `}
    >
      {panes.map(({ pane, title, actions, content }) => (
        <PaneColumn
          key={pane}
          pane={pane}
          title={title}
          folded={folded[pane]}
          onFold={value => setPaneCollapsed(pane, value)}
          actions={actions}
        >
          {content}
        </PaneColumn>
      ))}
    </div>
  );
};

export default memo(BuilderComponentPane);
