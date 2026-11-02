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
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { logging } from '@apache-superset/core/utils';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { ResultsPaneOnDashboard } from 'src/explore/components/DataTablesPane';
import { ViewResultsModalTrigger } from 'src/dashboard/components/SliceHeaderControls/ViewResultsModalTrigger';
import { useElementAction } from 'src/mibi/elements/actions';
import { captureDashboard } from 'src/mibi/export/capture';
import { actionButtonStyles, headerTooltipStyle } from './styles';
import type { ActionButtonFormat, VisualFormat } from './types';

const iconProps = { iconSize: 'm' } as const;

function HeaderIcon({
  title,
  onClick,
  children,
  testId,
}: {
  title: ReactNode;
  onClick?: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Tooltip title={title} placement="top">
      <span
        role={onClick ? 'button' : 'img'}
        tabIndex={onClick ? 0 : undefined}
        aria-label={typeof title === 'string' ? title : undefined}
        data-test={testId}
        className="mibi-header-icon"
        onClick={onClick}
        onKeyDown={event => {
          if (onClick && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        {children}
      </span>
    </Tooltip>
  );
}

/** The optional icons a report can show in the header of a chart. */
export function HeaderExtras({
  format,
  chartId,
  sliceName,
  description,
  failed,
  formData,
  exploreUrl,
  canExplore,
  canDownload,
  isFullSize,
  onToggleFullSize,
  hasExitButton,
}: {
  format: VisualFormat | undefined;
  chartId: number;
  sliceName?: string;
  description?: string;
  failed: boolean;
  formData: never;
  exploreUrl: string;
  canExplore: boolean;
  canDownload: boolean;
  isFullSize?: boolean;
  onToggleFullSize: () => void;
  /** The menu of the chart brings its own button to leave a full size chart */
  hasExitButton: boolean;
}) {
  const theme = useTheme();
  const { addSuccessToast, addDangerToast } = useToasts();
  const resultsRef = useRef<{ close: () => void; open: (e: Event) => void }>(
    null,
  );
  const header = format?.header;
  const link = format?.link;
  const runLink = useElementAction(link?.action, !!link?.show);

  const toggleFocus = () => {
    // The menu of the chart may have asked the browser for its full screen
    if (isFullSize && document.fullscreenElement) document.exitFullscreen();
    else onToggleFullSize();
  };

  useEffect(() => {
    if (!isFullSize || !header?.focus) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        onToggleFullSize();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [header?.focus, isFullSize, onToggleFullSize]);

  const copyImage = async () => {
    try {
      const { canvas } = await captureDashboard(
        theme,
        2,
        `[data-test-chart-id="${chartId}"]`,
      );
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('No image');
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      addSuccessToast(t('Image copied'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('The image could not be copied'));
    }
  };

  const tooltip = header?.tooltip;
  return (
    <>
      {link?.show && (
        <HeaderIcon
          title={
            runLink
              ? link.tooltip || t('Go to the action of this chart')
              : link.disabledTooltip || t('This action is not available')
          }
          onClick={runLink}
          testId="mibi-header-link"
        >
          <Icons.LinkOutlined {...iconProps} />
        </HeaderIcon>
      )}
      {header?.tooltipIcon && tooltip?.text && (
        <Tooltip
          title={tooltip.text}
          placement="top"
          styles={{ body: headerTooltipStyle(tooltip) }}
        >
          <span
            role="img"
            aria-label={tooltip.text}
            data-test="mibi-header-tooltip"
            className="mibi-header-icon"
          >
            <Icons.QuestionCircleOutlined {...iconProps} />
          </span>
        </Tooltip>
      )}
      {header?.info && description && (
        <HeaderIcon title={description} testId="mibi-header-info">
          <Icons.InfoCircleOutlined {...iconProps} />
        </HeaderIcon>
      )}
      {header?.error && failed && (
        <HeaderIcon
          title={t('This chart could not be loaded')}
          testId="mibi-header-error"
        >
          <Icons.CloseCircleOutlined {...iconProps} />
        </HeaderIcon>
      )}
      {header?.seeData && (
        <ViewResultsModalTrigger
          canExplore={canExplore}
          exploreUrl={exploreUrl}
          modalRef={resultsRef as never}
          modalTitle={t('Chart Data: %s', sliceName ?? '')}
          triggerNode={
            <HeaderIcon title={t('See the data')} testId="mibi-header-data">
              <Icons.TableOutlined {...iconProps} />
            </HeaderIcon>
          }
          modalBody={
            <ResultsPaneOnDashboard
              queryFormData={formData}
              queryForce={false}
              dataSize={20}
              isRequest
              isVisible
              canDownload={canDownload}
            />
          }
        />
      )}
      {header?.copy && (
        <HeaderIcon
          title={t('Copy as an image')}
          onClick={copyImage}
          testId="mibi-header-copy"
        >
          <Icons.CopyOutlined {...iconProps} />
        </HeaderIcon>
      )}
      {header?.focus && !(isFullSize && hasExitButton) && (
        <HeaderIcon
          title={isFullSize ? t('Exit focus mode') : t('Focus mode')}
          onClick={toggleFocus}
          testId="mibi-header-focus"
        >
          {isFullSize ? (
            <Icons.FullscreenExitOutlined {...iconProps} />
          ) : (
            <Icons.FullscreenOutlined {...iconProps} />
          )}
        </HeaderIcon>
      )}
    </>
  );
}

/** The button a report can place in the title area of a chart. */
export function ChartActionButton({
  button,
  format,
  enabled,
}: {
  button: ActionButtonFormat;
  format: VisualFormat | undefined;
  enabled: boolean;
}) {
  const theme = useTheme();
  const run = useElementAction(format?.link?.action, enabled);
  const styles = actionButtonStyles(button, format, theme);
  const positioned: CSSProperties = styles.box;
  const iconOnly = button.iconOnly;
  const showText = !iconOnly && button.textShow !== false;
  return (
    <button
      type="button"
      className={`mibi-action-button mibi-action-${button.position ?? 'within'}`}
      data-test="mibi-chart-action-button"
      disabled={!run}
      style={positioned}
      title={format?.link?.tooltip}
      onClick={run}
    >
      {button.iconShow !== false && (
        <span style={styles.icon}>
          <Icons.ThunderboltOutlined
            iconColor={styles.icon.color as string}
            style={{ fontSize: button.iconSize ?? 14 }}
          />
        </span>
      )}
      {showText && (
        <span style={styles.text}>{button.text || t('Action')}</span>
      )}
    </button>
  );
}
