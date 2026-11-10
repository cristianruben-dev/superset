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
import { useEffect, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { rememberedPanel, rememberPanel } from '../assistant/remembered';
import { useAssistantAccess } from '../assistant/useAssistant';
import { usePhoneScreen } from '../format/mobile';
import { setPresenting } from '../present/presentation';
import { RibbonButton } from '../ribbon/parts';
import { applyBookmark, bookmarksOf } from './bookmarks';
import { useFiltersChanged } from './ResetFiltersButton';
import { resetFilters } from './resetFilters';
import { STATUS_BAR_HEIGHT } from '../shell/StatusBar';

const Bar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    height: ${theme.sizeUnit * 9}px;
    padding: 0 ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;

    /* The small commands of the ribbon, a little taller to sit alone in a row */
    button.small {
      height: ${theme.sizeUnit * 7}px;
      padding: 0 ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

const Group = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;

    & + & {
      padding-left: ${theme.sizeUnit * 3}px;
      border-left: 1px solid ${theme.colorBorderSecondary};
    }

    .label {
      margin-right: ${theme.sizeUnit * 1.5}px;
      font-family: ${theme.fontFamilyCode};
      font-size: 11px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

function CommandGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Group role="group" aria-label={label}>
      <span className="label" aria-hidden>
        {label}
      </span>
      {children}
    </Group>
  );
}

/** A phone has no bar of commands: the assistant waits over the corner of the page. */
const PhoneCommand = styled(Button)`
  ${({ theme }) => css`
    position: fixed;
    right: ${theme.sizeUnit * 3}px;
    bottom: calc(
      ${STATUS_BAR_HEIGHT + theme.sizeUnit * 2}px +
        env(safe-area-inset-bottom, 0px)
    );
    z-index: ${theme.zIndexPopupBase - 1};
    box-shadow: ${theme.boxShadowSecondary};
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .phone-assistant-label {
      display: none;
    }
  `}
`;

const useFullscreen = () => {
  const [fullscreen, setFullscreen] = useState(
    () => !!document.fullscreenElement,
  );
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  };
  return [fullscreen, toggle] as const;
};

/**
 * The commands of a report for viewers, in one row under the top bar, as the
 * reading view of Power BI: view, filters and export. The editor has the ribbon,
 * and phones none.
 */
export function ReadingBar({
  onExport,
  exportDisabled,
}: {
  onExport: () => void;
  exportDisabled?: boolean;
}) {
  const dispatch = useDispatch();
  const filtersChanged = useFiltersChanged();
  const bookmarks = useSelector((state: RootState) =>
    bookmarksOf(state.dashboardLayout?.present),
  );
  const [fullscreen, toggleFullscreen] = useFullscreen();
  // As Power BI mobile: a phone shows the report without commands
  const phone = usePhoneScreen();
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const assistant = useAssistantAccess(dashboardId);
  const assistantModels = assistant.models;
  // A reload finds the panel as it was: an answer may be running there
  const [assistantOpen, setAssistantOpen] = useState(() =>
    rememberedPanel(dashboardId),
  );
  const [assistantUsed, setAssistantUsed] = useState(assistantOpen);
  const showAssistant = (open: boolean) => {
    rememberPanel(dashboardId, open);
    setAssistantOpen(open);
  };
  const openAssistant = () => {
    setAssistantUsed(true);
    showAssistant(true);
  };
  const assistantPanel = assistantUsed && assistantModels.length > 0 && (
    <AssistantPanel
      open={assistantOpen}
      onClose={() => showAssistant(false)}
      access={assistant}
    />
  );

  if (phone) {
    return assistantModels.length > 0 ? (
      <>
        <PhoneCommand
          buttonStyle="primary"
          onClick={openAssistant}
          icon={<Icons.CommentOutlined iconSize="m" />}
          data-test="auradata-assistant-phone-button"
          aria-label={t('Ask')}
        >
          <span className="phone-assistant-label">{t('Ask')}</span>
        </PhoneCommand>
        {assistantPanel}
      </>
    ) : null;
  }

  return (
    <Bar
      role="toolbar"
      aria-label={t('Report commands')}
      data-test="auradata-reading-bar"
    >
      <CommandGroup label={t('View')}>
        <RibbonButton
          small
          label={t('Present')}
          icon={<Icons.FundProjectionScreenOutlined iconSize="m" />}
          onClick={() => setPresenting(true)}
          data-test="auradata-present-button"
        />
        <RibbonButton
          small
          label={fullscreen ? t('Exit full screen') : t('Full screen')}
          icon={
            fullscreen ? (
              <Icons.FullscreenExitOutlined iconSize="m" />
            ) : (
              <Icons.FullscreenOutlined iconSize="m" />
            )
          }
          pressed={fullscreen}
          onClick={toggleFullscreen}
          data-test="auradata-fullscreen-button"
        />
      </CommandGroup>
      <CommandGroup label={t('Filters')}>
        <RibbonButton
          small
          label={t('Reset filters')}
          hint={t('Reset filters: back to the saved filters and slicers')}
          icon={<Icons.Undo iconSize="m" />}
          disabled={!filtersChanged}
          onClick={() => dispatch(resetFilters() as never)}
          data-test="auradata-reset-filters"
        />
        {bookmarks.length > 0 && (
          <RibbonButton
            small
            label={t('Bookmarks')}
            icon={<Icons.BookOutlined iconSize="m" />}
            menu={{
              items: bookmarks.map(bookmark => ({
                key: bookmark.id,
                label: bookmark.name,
                icon: <Icons.BookOutlined iconSize="m" />,
              })),
              onClick: ({ key }) =>
                dispatch(applyBookmark(String(key)) as never),
            }}
            data-test="auradata-bookmarks-button"
          />
        )}
      </CommandGroup>
      <CommandGroup label={t('Export')}>
        <RibbonButton
          small
          label={t('PDF or image')}
          icon={<Icons.DownloadOutlined iconSize="m" />}
          disabled={exportDisabled}
          onClick={onExport}
          data-test="auradata-export-button"
        />
      </CommandGroup>
      {assistantModels.length > 0 && (
        <CommandGroup label={t('Assistant')}>
          <RibbonButton
            small
            label={t('Ask your data')}
            icon={<Icons.CommentOutlined iconSize="m" />}
            pressed={assistantOpen}
            onClick={() =>
              assistantOpen ? showAssistant(false) : openAssistant()
            }
            data-test="auradata-assistant-button"
          />
        </CommandGroup>
      )}
      {assistantPanel}
    </Bar>
  );
}
