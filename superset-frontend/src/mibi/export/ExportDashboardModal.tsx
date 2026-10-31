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
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Checkbox, Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import type { RootState } from 'src/dashboard/types';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import { ensureStaticPrefix } from 'src/utils/assetUrl';
import getBootstrapData from 'src/utils/getBootstrapData';
import { fetchDashboardWorkspace } from 'src/mibi/workspaces/api';
import { activeTabIndex, topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { canvasSize } from 'src/mibi/format/styles';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  appliedFilters,
  captureDashboard,
  loadWholePage,
  waitForCharts,
} from './capture';
import {
  buildPdf,
  buildPng,
  exportFileName,
  loadImage,
  saveFile,
  type ExportFormat,
  type ExportSection,
} from './document';

type Scope = 'current' | 'all';

const Body = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 5}px;

    .group {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 2}px;
    }

    .label {
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      color: ${theme.colorTextSecondary};
    }

    .formats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${theme.sizeUnit * 3}px;
    }

    .segments {
      display: flex;
      gap: ${theme.sizeUnit}px;
      padding: ${theme.sizeUnit}px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorFillQuaternary};
    }

    .progress {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimaryText};
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

const FormatCard = styled.button<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid
      ${$selected ? theme.colorPrimary : theme.colorBorderSecondary};
    background: ${$selected ? theme.colorPrimaryBg : theme.colorBgContainer};
    box-shadow: ${$selected ? `0 0 0 1px ${theme.colorPrimary}` : 'none'};
    text-align: left;
    cursor: pointer;
    transition:
      border-color ${theme.motionDurationMid},
      background ${theme.motionDurationMid};

    &:hover {
      border-color: ${theme.colorPrimary};
    }

    &:disabled {
      cursor: default;
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: ${theme.borderRadius}px;
      background: ${$selected ? theme.colorPrimary : theme.colorFillTertiary};
      color: ${$selected
        ? theme.colorTextLightSolid
        : theme.colorTextSecondary};
    }

    .copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    strong {
      font-weight: 600;
      color: ${theme.colorText};
    }

    span.hint {
      font-size: ${theme.fontSizeSM}px;
      line-height: 1.4;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const Segment = styled.button<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit * 1.5}px;
    min-width: 0;
    height: 32px;
    padding: 0 ${theme.sizeUnit * 3}px;
    border: 0;
    border-radius: ${theme.borderRadiusSM}px;
    background: ${$selected ? theme.colorBgContainer : 'transparent'};
    box-shadow: ${$selected ? theme.boxShadowTertiary : 'none'};
    color: ${$selected ? theme.colorText : theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${$selected ? 600 : 500};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;

    &:disabled {
      cursor: default;
    }
  `}
`;

function Segments<T extends string>({
  value,
  options,
  onChange,
  disabled,
  name,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div className="segments" role="radiogroup" aria-label={name}>
      {options.map(option => (
        <Segment
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          $selected={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Segment>
      ))}
    </div>
  );
}

const userName = (user: RootState['user']) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username;

export interface ExportDashboardModalProps {
  show: boolean;
  onHide: () => void;
}

/**
 * Exports the dashboard as a paginated PDF or a PNG with a header (logo,
 * title, workspace, date and applied filters), for the page on screen or
 * every page of the dashboard.
 */
export function ExportDashboardModal({
  show,
  onHide,
}: ExportDashboardModalProps) {
  const theme = useTheme();
  const store = useStore<RootState>();
  const dispatch = useDispatch();
  const { addDangerToast, addSuccessToast } = useToasts();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const info = useSelector((state: RootState) => state.dashboardInfo);
  const dashboardTitle = String(layout[DASHBOARD_HEADER_ID]?.meta?.text ?? '');
  const tabs = useMemo(() => topLevelTabs(layout), [layout]);
  const fixedSize = canvasSize(layout[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas);
  const fixedCanvas = !!fixedSize;
  const current = activeTabIndex(tabs, activeTabs);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scope, setScope] = useState<Scope>('current');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<string>();

  useEffect(() => {
    if (!show || !info.id) return;
    let cancelled = false;
    fetchDashboardWorkspace(info.id)
      .then(result => !cancelled && setWorkspace(result?.name))
      .catch(() => {});
    // eslint-disable-next-line consistent-return
    return () => {
      cancelled = true;
    };
  }, [show, info.id]);

  const busy = progress !== null;

  const run = async () => {
    const root = () => document.querySelector('.dashboard');
    const date = new Date();
    const title = dashboardTitle || t('Dashboard');
    const indexes =
      scope === 'all' && tabs.length > 1
        ? tabs.map((_, index) => index)
        : [current];
    const sections: ExportSection[] = [];
    try {
      for (let step = 0; step < indexes.length; step += 1) {
        const index = indexes[step];
        setProgress(
          indexes.length > 1
            ? t('Preparing page %s of %s…', step + 1, indexes.length)
            : t('Preparing the dashboard…'),
        );
        const switching =
          tabs.length > 0 &&
          index !==
            activeTabIndex(tabs, store.getState().dashboardState.activeTabs);
        if (switching) dispatch(setDirectPathToChild(tabs[index].path));
        // eslint-disable-next-line no-await-in-loop
        await waitForCharts(store.getState, root(), { animate: switching });
        // eslint-disable-next-line no-await-in-loop
        await loadWholePage(store.getState, root());
        // eslint-disable-next-line no-await-in-loop
        const capture = await captureDashboard(
          theme,
          2,
          fixedCanvas ? '[data-test="mibi-canvas"]' : '.dashboard',
        );
        sections.push({
          title: tabs[index]?.title,
          capture,
          fixed: fixedCanvas,
        });
      }
      setProgress(t('Creating the file…'));
      const logo = includeHeader
        ? await loadImage(
            theme.brandLogoUrl
              ? ensureStaticPrefix(theme.brandLogoUrl)
              : undefined,
          )
        : null;
      const state = store.getState();
      const exportInfo = {
        title,
        workspace,
        filters: appliedFilters(state),
        author: userName(state.user),
        date,
        locale: getBootstrapData().common?.locale,
        logo,
        includeHeader,
      };
      const name = exportFileName(title, date, format);
      if (format === 'pdf') {
        buildPdf(sections, exportInfo, theme).save(name);
      } else {
        saveFile(
          buildPng(sections, exportInfo, theme).toDataURL('image/png'),
          name,
        );
      }
      addSuccessToast(t('Dashboard exported'));
      onHide();
    } catch (error) {
      logging.error('Dashboard export failed', error);
      addDangerToast(t('The dashboard could not be exported. Try again.'));
    } finally {
      if (tabs.length && indexes.length > 1) {
        dispatch(setDirectPathToChild(tabs[current].path));
      }
      setProgress(null);
    }
  };

  return (
    <Modal
      show={show}
      onHide={busy ? () => {} : onHide}
      name="export-dashboard"
      title={t('Export dashboard')}
      width="560px"
      primaryButtonName={busy ? t('Exporting…') : t('Export')}
      primaryButtonLoading={busy}
      disablePrimaryButton={busy}
      onHandledPrimaryAction={run}
      destroyOnHidden
    >
      <Body data-test="mibi-export-modal">
        <div className="group">
          <span className="label">{t('Format')}</span>
          <div className="formats" role="radiogroup" aria-label={t('Format')}>
            <FormatCard
              type="button"
              role="radio"
              aria-checked={format === 'pdf'}
              $selected={format === 'pdf'}
              disabled={busy}
              onClick={() => setFormat('pdf')}
              data-test="mibi-export-pdf"
            >
              <span className="icon">
                <Icons.FilePdfOutlined iconSize="l" />
              </span>
              <span className="copy">
                <strong>{t('PDF document')}</strong>
                <span className="hint">
                  {t('Pages the size of the dashboard, with a cover')}
                </span>
              </span>
            </FormatCard>
            <FormatCard
              type="button"
              role="radio"
              aria-checked={format === 'png'}
              $selected={format === 'png'}
              disabled={busy}
              onClick={() => setFormat('png')}
              data-test="mibi-export-png"
            >
              <span className="icon">
                <Icons.FileImageOutlined iconSize="l" />
              </span>
              <span className="copy">
                <strong>{t('PNG image')}</strong>
                <span className="hint">
                  {t('One picture for slides or chats')}
                </span>
              </span>
            </FormatCard>
          </div>
        </div>

        {tabs.length > 1 && (
          <div className="group">
            <span className="label">{t('Pages')}</span>
            <Segments<Scope>
              name={t('Pages')}
              value={scope}
              disabled={busy}
              onChange={setScope}
              options={[
                {
                  value: 'current',
                  label: t('This page (%s)', tabs[current]?.title),
                },
                {
                  value: 'all',
                  label: t('All pages (%s)', tabs.length),
                },
              ]}
            />
          </div>
        )}

        <Checkbox
          checked={includeHeader}
          disabled={busy}
          onChange={event => setIncludeHeader(event.target.checked)}
        >
          {format === 'pdf'
            ? t(
                'Start with a cover: logo, workspace, date, filters and contents',
              )
            : t('Add a header with the logo, workspace, date and filters')}
        </Checkbox>

        {busy && (
          <div className="progress" role="status">
            <Icons.LoadingOutlined iconSize="m" />
            {progress}
          </div>
        )}
      </Body>
    </Modal>
  );
}
