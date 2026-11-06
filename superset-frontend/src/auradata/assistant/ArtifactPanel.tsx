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
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Button, Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import getBootstrapData from 'src/utils/getBootstrapData';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { usePhoneScreen } from '../format/mobile';
import { DocumentMark } from './DocumentNotes';
import { oldestText } from './artifact';
import { ArtifactBlocks } from './ArtifactBlocks';
import { AssistantError, exportArtifact } from './client';
import { parseServerDate } from './conversationGroups';
import { ShareCard } from './ShareCard';
import type { ArtifactVersion } from './types';
import { useArtifact } from './useArtifact';

const DOCK_WIDTH = 780;
const DOCK_MARGIN = 24;
const HISTORY_WIDTH = 248;

const dateFormat = () =>
  new Intl.DateTimeFormat(getBootstrapData().common?.locale || 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const dateText = (value: string) => dateFormat().format(parseServerDate(value));

const originText = ({ origin, restored_from: from }: ArtifactVersion) => {
  if (origin === 'restored') return t('Back to version %s', from);
  return origin === 'created' ? t('Created') : t('Changed by the assistant');
};

/** Hands a file to the browser, as a link the person clicked. */
const saveFile = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

interface DockBox {
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where the chat is on screen: the document stands right beside it, whether the chat
 * lives in the reading drawer or in a pane of the editor.
 */
function useDockBox(anchor: HTMLElement | null) {
  const [box, setBox] = useState<DockBox | null>(null);
  useEffect(() => {
    if (!anchor) return undefined;
    const host = (anchor.closest('.ant-drawer-content') ??
      anchor) as HTMLElement;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      setBox({
        top: rect.top,
        right: window.innerWidth - rect.left,
        bottom: Math.max(window.innerHeight - rect.bottom, 0),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener('resize', measure);
    // The drawer slides in, which no size change announces
    document.addEventListener('transitionend', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.removeEventListener('transitionend', measure);
    };
  }, [anchor]);
  return box;
}

const Dock = styled.aside<{ box: DockBox | null }>`
  ${({ theme, box }) => css`
    position: fixed;
    z-index: ${theme.zIndexPopupBase};
    top: ${box?.top ?? 0}px;
    right: ${box?.right ?? 0}px;
    bottom: ${box?.bottom ?? 0}px;
    display: flex;
    flex-direction: column;
    width: min(
      ${DOCK_WIDTH}px,
      calc(100vw - ${(box?.right ?? 0) + DOCK_MARGIN}px)
    );
    border-left: 1px solid ${theme.colorBorderSecondary};
    border-right: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    box-shadow: ${theme.boxShadowSecondary};

    &[data-phone='true'] {
      inset: 0;
      width: auto;
      border: 0;
    }
  `}
`;

const Bar = styled.header`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    flex: none;
    min-height: ${theme.sizeUnit * 13}px;
    padding: 0 ${theme.sizeUnit * 3}px 0 ${theme.sizeUnit * 6}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    .version {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`;

const Paper = styled.div`
  ${({ theme }) => css`
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: ${theme.sizeUnit * 8}px ${theme.sizeUnit * 10}px
      ${theme.sizeUnit * 12}px;

    @media (max-width: 767px) {
      padding: ${theme.sizeUnit * 6}px ${theme.sizeUnit * 5}px;
    }
  `}
`;

const Title = styled.h1`
  ${({ theme }) => css`
    margin: 0 0 ${theme.sizeUnit * 2}px;
    font-size: ${theme.sizeUnit * 7}px;
    line-height: 1.2;
    font-weight: ${theme.fontWeightStrong};
    letter-spacing: -0.015em;
    color: ${theme.colorText};
    overflow-wrap: anywhere;
  `}
`;

const Written = styled.p`
  ${({ theme }) => css`
    margin: 0 0 ${theme.sizeUnit * 6}px;
    font-size: ${theme.fontSizeSM}px;
    line-height: 1.5;
    color: ${theme.colorTextTertiary};

    time {
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
    }
    button {
      padding: 0;
      border: 0;
      background: none;
      color: ${theme.colorLink};
      font: inherit;
      cursor: pointer;
    }
    button:disabled {
      color: ${theme.colorTextDisabled};
      cursor: not-allowed;
    }
    button:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
  `}
`;

const OldVersion = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    margin-bottom: ${theme.sizeUnit * 5}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-radius: ${theme.sizeUnit * 2}px;
    background: ${theme.colorFillTertiary};
    font-size: ${theme.fontSizeSM}px;

    span {
      flex: 1;
      min-width: ${theme.sizeUnit * 30}px;
    }
  `}
`;

const History = styled.nav`
  ${({ theme }) => css`
    flex: none;
    width: ${HISTORY_WIDTH}px;
    overflow-y: auto;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px;
    border-left: 1px solid ${theme.colorBorderSecondary};

    @media (max-width: 767px) {
      flex: 1;
      width: auto;
      border: 0;
    }
    ol {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit / 2}px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    button {
      display: block;
      width: 100%;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
      border: 0;
      border-radius: ${theme.sizeUnit}px;
      background: transparent;
      color: ${theme.colorText};
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background ${theme.motionDurationFast};
    }
    button:hover {
      background: ${theme.colorFillTertiary};
    }
    button:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
    }
    button[aria-current='true'] {
      background: ${theme.colorPrimaryBg};
    }
    .name {
      display: block;
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightStrong};
    }
    .origin {
      display: block;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }
    time {
      display: block;
      margin-top: ${theme.sizeUnit / 2}px;
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const Problem = styled.p`
  ${({ theme }) => css`
    margin: 0;
    color: ${theme.colorTextSecondary};
  `}
`;

/**
 * The document beside the chat: it follows what the answer writes, keeps its history and
 * goes back to any version, which adds a new one. Selecting a block aims the next message
 * at it. Figures are read here, as the person looking, and their date differs from that of
 * the text, which stays as it was written: that is what the line under the title says,
 * and refreshing it is a message like any other. Saving it as a page is one too, in the
 * editor, so it gets the card and the undo of any change of the assistant. Exporting and
 * sharing are of the person alone: no model hears of them.
 */
export function ArtifactPanel({
  artifactId,
  liveVersion,
  anchor,
  dashboardId,
  busy,
  canAsk,
  selected,
  onSelect,
  onRefresh,
  onSaveAsPage,
  onClose,
}: {
  artifactId: string;
  liveVersion?: number;
  anchor: HTMLElement | null;
  dashboardId: number;
  /** An answer is running, and it could be writing this document. */
  busy: boolean;
  canAsk: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
  /** Absent in a conversation that cannot change the report. */
  onSaveAsPage?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const phone = usePhoneScreen();
  const box = useDockBox(anchor);
  const { addDangerToast, addSuccessToast } = useToasts();
  const { artifact, viewing, failed, view, restore, replace } = useArtifact(
    artifactId,
    liveVersion,
  );
  const [showHistory, setShowHistory] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const last = artifact?.versions[artifact.versions.length - 1]?.number;
  const old = viewing !== null;
  const written = artifact ? oldestText(artifact.blocks) : null;

  const goBack = async (version: number) => {
    setRestoring(true);
    try {
      await restore(version);
      onSelect(null);
      addSuccessToast(t('Back to version %s.', version));
    } catch (error) {
      addDangerToast(
        error instanceof AssistantError
          ? error.message
          : t('This version could not be restored.'),
      );
    } finally {
      setRestoring(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { blob, name } = await exportArtifact(artifactId);
      saveFile(blob, name);
    } catch (error) {
      addDangerToast(
        error instanceof AssistantError
          ? error.message
          : t('The PDF could not be made.'),
      );
    } finally {
      setExporting(false);
    }
  };

  const open = (version: number) => {
    onSelect(null);
    view(version === last ? null : version);
    if (phone) setShowHistory(false);
  };

  let content;
  if (failed) {
    content = (
      <Problem data-test="auradata-artifact-problem">
        {t('This document could not be opened.')}
      </Problem>
    );
  } else if (!artifact) {
    content = <Loading position="inline-centered" />;
  } else {
    content = (
      <>
        {old && (
          <OldVersion data-test="auradata-artifact-old">
            <span>{t('You are reading version %s.', artifact.version)}</span>
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              onClick={() => view(null)}
            >
              {t('See the last one')}
            </Button>
            <Button
              buttonSize="small"
              onClick={() => goBack(artifact.version)}
              disabled={busy || restoring}
              data-test="auradata-artifact-restore"
            >
              {t('Go back to this version')}
            </Button>
          </OldVersion>
        )}
        {sharing && !old && (
          <ShareCard
            artifact={artifact}
            onChange={replace}
            onClose={() => setSharing(false)}
          />
        )}
        <Title>{artifact.title}</Title>
        <DocumentMark
          model={
            artifact.model_name ?? artifact.versions.at(-1)?.model_name ?? null
          }
        />
        <Written data-test="auradata-artifact-written">
          {written ? (
            <>
              {t('Text written on')}{' '}
              <time dateTime={written}>{dateText(written)}</time>.{' '}
              {t('Figures are read as you open it; the text stays as written.')}{' '}
              {!old && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={!canAsk}
                  data-test="auradata-artifact-refresh"
                >
                  {t('Refresh the text')}
                </button>
              )}
            </>
          ) : (
            t('Figures are read as you open it.')
          )}
        </Written>
        <ArtifactBlocks
          blocks={artifact.blocks}
          sources={artifact.sources}
          dashboardId={dashboardId}
          selected={selected}
          onSelect={
            old ? undefined : id => onSelect(id === selected ? null : id)
          }
        />
      </>
    );
  }

  return createPortal(
    <Dock
      box={box}
      data-phone={phone}
      aria-label={t('Document')}
      data-test="auradata-artifact-panel"
    >
      <Bar>
        <span className="version">
          {artifact &&
            `${t('Version %s', artifact.version)} · ${dateText(artifact.created_on)}`}
        </span>
        {artifact && !old && (
          <>
            <Button
              buttonStyle="tertiary"
              onClick={onSaveAsPage}
              disabled={!onSaveAsPage || busy || !canAsk}
              aria-label={t('Save as a page of the report')}
              tooltip={
                onSaveAsPage
                  ? t('Save as a page of the report')
                  : t(
                      'Open the editor and ask the assistant to save this document as a page',
                    )
              }
              icon={<Icons.PlusSquareOutlined iconSize="m" />}
              data-test="auradata-artifact-save-page"
            />
            <Button
              buttonStyle="tertiary"
              onClick={exportPdf}
              loading={exporting}
              disabled={exporting}
              aria-label={t('Export to PDF')}
              tooltip={t('Export to PDF')}
              icon={<Icons.FilePdfOutlined iconSize="m" />}
              data-test="auradata-artifact-export"
            />
            <Button
              buttonStyle="tertiary"
              onClick={() => setSharing(!sharing)}
              aria-pressed={sharing}
              aria-label={t('Share with the workspace')}
              tooltip={
                artifact.share
                  ? t('Shared with «%s»', artifact.share.workspace ?? '')
                  : t('Share with the workspace')
              }
              icon={
                <Icons.TeamOutlined
                  iconSize="m"
                  iconColor={artifact.share ? theme.colorPrimary : undefined}
                />
              }
              data-test="auradata-artifact-share"
            />
          </>
        )}
        <Button
          buttonStyle="tertiary"
          onClick={() => setShowHistory(!showHistory)}
          aria-pressed={showHistory}
          aria-label={t('Version history')}
          tooltip={t('Version history')}
          icon={<Icons.HistoryOutlined iconSize="m" />}
          data-test="auradata-artifact-history"
        />
        <Button
          buttonStyle="tertiary"
          onClick={onClose}
          aria-label={t('Close the document')}
          tooltip={t('Close the document')}
          icon={<Icons.CloseOutlined iconSize="m" />}
          data-test="auradata-artifact-close"
        />
      </Bar>
      <Body>
        {!(phone && showHistory) && <Paper>{content}</Paper>}
        {showHistory && artifact && (
          <History aria-label={t('Version history')}>
            <ol>
              {[...artifact.versions].reverse().map(version => (
                <li key={version.number}>
                  <button
                    type="button"
                    aria-current={version.number === artifact.version}
                    onClick={() => open(version.number)}
                    data-test="auradata-artifact-version"
                  >
                    <span className="name">
                      {t('Version %s', version.number)}
                    </span>
                    <span className="origin">{originText(version)}</span>
                    <time dateTime={version.created_on}>
                      {dateText(version.created_on)}
                    </time>
                  </button>
                </li>
              ))}
            </ol>
          </History>
        )}
      </Body>
    </Dock>,
    document.body,
  );
}
