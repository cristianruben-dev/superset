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
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { logging } from '@apache-superset/core/utils';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import MemoizedFiltersBadge from 'src/dashboard/components/FiltersBadge';
import { useActionSlot } from './actionSlots';
import { captionLines, copyVisualImage } from './copyVisual';
import { ObjectActionButton } from './ObjectActions';
import type { VisualFormat } from './types';

/**
 * The buttons of a chart in the floating bar over it, as Power BI shows them
 * on hover: copy as an image with its caption, the filters that affect it,
 * focus mode and the menu of more options. Each one follows its switch of
 * General › Header icons; with no bar to hold them (the chart outside a
 * report) they stay in the header.
 */
export function ChartBarActions({
  componentId,
  chartId,
  format,
  report,
  showFilters,
  isFullSize,
  onToggleFullSize,
  menu,
}: {
  componentId: string | undefined;
  chartId: number;
  format: VisualFormat | undefined;
  /** The title of the report, for the caption of a copied picture */
  report?: string;
  showFilters: boolean;
  isFullSize?: boolean;
  onToggleFullSize: () => void;
  /** The menu of more options, or nothing when it is switched off */
  menu?: ReactNode;
}) {
  const theme = useTheme();
  const { addSuccessToast, addDangerToast } = useToasts();
  const slot = useActionSlot(componentId);
  const header = format?.header;
  const showCopy = header?.copy !== false;
  const showFocus = header?.focus !== false;

  useEffect(() => {
    if (!isFullSize || !showFocus) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        onToggleFullSize();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showFocus, isFullSize, onToggleFullSize]);

  const copy = async () => {
    try {
      await copyVisualImage(
        theme,
        chartId,
        captionLines({
          report,
          copiedAt: new Date(),
          link: window.location.href,
        }),
      );
      addSuccessToast(t('Image copied'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('The image could not be copied'));
    }
  };

  const toggleFocus = () => {
    // The menu of the chart may have asked the browser for its full screen
    if (isFullSize && document.fullscreenElement) document.exitFullscreen();
    else onToggleFullSize();
  };

  const buttons = (
    <>
      {showCopy && (
        <ObjectActionButton
          label={t('Copy as image with caption')}
          testId="auradata-header-copy"
          onClick={copy}
        >
          <Icons.CopyOutlined iconSize="m" />
        </ObjectActionButton>
      )}
      {/* Its own list opens on hover and says what affects the chart */}
      {showFilters && <MemoizedFiltersBadge chartId={chartId} alwaysShow />}
      {showFocus && (
        <ObjectActionButton
          label={isFullSize ? t('Exit focus mode') : t('Focus mode')}
          testId="auradata-header-focus"
          onClick={toggleFocus}
        >
          {isFullSize ? (
            <Icons.FullscreenExitOutlined iconSize="m" />
          ) : (
            <Icons.FullscreenOutlined iconSize="m" />
          )}
        </ObjectActionButton>
      )}
      {menu && (
        <Tooltip title={t('More options')}>
          <span>{menu}</span>
        </Tooltip>
      )}
    </>
  );
  return slot ? createPortal(buttons, slot) : buttons;
}
