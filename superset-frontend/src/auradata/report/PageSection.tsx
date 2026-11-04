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
import { useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Select, Switch } from '@superset-ui/core/components';
import { getClientErrorObject } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  deleteElementImage,
  uploadElementImage,
} from 'src/auradata/elements/actions';
import type { CanvasFormat } from 'src/auradata/format/types';
import type { RootState } from 'src/dashboard/types';
import { setComponentMeta } from 'src/auradata/format/actions';
import {
  ColorField,
  Field,
  RangeField,
  Section,
  Segments,
} from 'src/auradata/format/controls';
import { topLevelTabs } from 'src/auradata/present/dashboardTabs';
import { CELL } from 'src/auradata/format/types';
import { tooltipPageOf } from './tooltipPages';
import {
  DEFAULT_TOOLTIP_PAGE,
  DRILLTHROUGH_PAGE_KEY,
  PAGE_BACKGROUND_KEY,
  TOOLTIP_PAGE_KEY,
  type DrillthroughPage,
  type TooltipPage,
} from './types';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
type PageBackground = NonNullable<CanvasFormat['background']> & {
  imageId?: number;
};

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

/** Columns of the datasets the dashboard's charts use, sorted by name. */
function useDashboardColumns(): string[] {
  const datasources = useSelector((state: RootState) => state.datasources);
  return useMemo(() => {
    const names = new Set<string>();
    Object.values(datasources ?? {}).forEach(datasource =>
      (datasource.columns ?? []).forEach(column =>
        names.add(column.column_name),
      ),
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [datasources]);
}

/**
 * Settings of the page being edited: whether other pages can "drill through"
 * to it, and on which columns.
 */
export function PageSection() {
  const dispatch = useDispatch();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const columns = useDashboardColumns();
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const { addDangerToast } = useToasts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const page = topLevelTabs(layout).find(tab => activeTabs?.includes(tab.id));
  if (!page) return null;

  const drillthrough = layout[page.id]?.meta?.[DRILLTHROUGH_PAGE_KEY] as
    | DrillthroughPage
    | undefined;
  const save = (next: DrillthroughPage | undefined) =>
    dispatch(setComponentMeta(page.id, DRILLTHROUGH_PAGE_KEY, next) as never);

  const tooltip = tooltipPageOf(layout[page.id]?.meta);
  const saveTooltip = (next: TooltipPage | undefined, setting: string) =>
    dispatch(
      setComponentMeta(
        page.id,
        TOOLTIP_PAGE_KEY,
        next,
        `meta:${page.id}:${TOOLTIP_PAGE_KEY}:${setting}`,
      ) as never,
    );

  const background = (layout[page.id]?.meta?.[PAGE_BACKGROUND_KEY] ?? {
    type: 'none',
  }) as PageBackground;
  const setBackground = (next: PageBackground | undefined) =>
    dispatch(setComponentMeta(page.id, PAGE_BACKGROUND_KEY, next) as never);
  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      addDangerToast(t('The image is larger than 2 MB'));
      return;
    }
    setUploading(true);
    try {
      if (background.imageId) {
        await deleteElementImage(dashboardId, background.imageId).catch(
          logging.error,
        );
      }
      const image = await uploadElementImage(dashboardId, file);
      setBackground({
        ...background,
        type: 'image',
        image: image.url,
        imageId: image.id,
        fit: background.fit ?? 'cover',
      });
    } catch (error) {
      const { message, error: text } = await getClientErrorObject(error);
      logging.error(error);
      addDangerToast(message || text || t('The image could not be uploaded'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Section data-test="auradata-format-page">
      <h4>{t('Page: %s', page.title || t('Untitled'))}</h4>
      <Field label={t('Page background')}>
        <Segments<'none' | 'color' | 'image'>
          name={t('Page background')}
          value={
            background.type === 'image' || background.type === 'color'
              ? background.type
              : 'none'
          }
          onChange={type =>
            setBackground(type === 'none' ? undefined : { ...background, type })
          }
          options={[
            { value: 'none', label: t('Canvas') },
            { value: 'color', label: t('Color') },
            { value: 'image', label: t('Image') },
          ]}
        />
      </Field>
      {background.type === 'color' && (
        <ColorField
          label={t('Color')}
          value={background.color ?? '#FFFFFF'}
          onChange={color => setBackground({ ...background, color })}
        />
      )}
      {background.type === 'image' && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            data-test="auradata-page-background-file"
            onChange={event => onFile(event.target.files?.[0])}
          />
          <Button
            buttonStyle="secondary"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {background.image ? t('Change') : t('Upload image')}
          </Button>
          <Field label={t('Fit')}>
            <Segments<'cover' | 'contain' | 'repeat'>
              name={t('Fit')}
              value={background.fit ?? 'cover'}
              onChange={fit => setBackground({ ...background, fit })}
              options={[
                { value: 'cover', label: t('Fill') },
                { value: 'contain', label: t('Fit') },
                { value: 'repeat', label: t('Tile') },
              ]}
            />
          </Field>
          <RangeField
            label={t('Opacity')}
            value={background.opacity ?? 100}
            min={0}
            max={100}
            onChange={opacity => setBackground({ ...background, opacity })}
          />
        </>
      )}
      <Field label={t('Use as tooltip')}>
        <Switch
          size="small"
          checked={!!tooltip}
          aria-label={t('Use as tooltip')}
          data-test="auradata-tooltip-page-toggle"
          onChange={on =>
            saveTooltip(on ? { ...DEFAULT_TOOLTIP_PAGE } : undefined, 'on')
          }
        />
      </Field>
      {tooltip && (
        <>
          <RangeField
            label={t('Tooltip width')}
            value={tooltip.width * CELL}
            min={4 * CELL}
            max={30 * CELL}
            step={CELL}
            testId="auradata-tooltip-page-width"
            onChange={width =>
              saveTooltip(
                { ...tooltip, width: Math.round(width / CELL) },
                'width',
              )
            }
          />
          <RangeField
            label={t('Tooltip height')}
            value={tooltip.height * CELL}
            min={2 * CELL}
            max={24 * CELL}
            step={CELL}
            testId="auradata-tooltip-page-height"
            onChange={height =>
              saveTooltip(
                { ...tooltip, height: Math.round(height / CELL) },
                'height',
              )
            }
          />
          <Select
            mode="multiple"
            ariaLabel={t('Tooltip fields')}
            placeholder={t('Tooltip fields')}
            value={tooltip.columns}
            data-test="auradata-tooltip-page-columns"
            onChange={value =>
              saveTooltip(
                { ...tooltip, columns: (value as string[]).map(String) },
                'columns',
              )
            }
            options={columns.map(column => ({
              value: column,
              label: column,
            }))}
          />
          <Hint>
            {t(
              'Viewers do not see this page. It shows at this size over the marks of the charts that use it, filtered to the mark. Charts set to Auto use it when they have its tooltip fields.',
            )}
          </Hint>
        </>
      )}
      <Field label={t('Drill through to this page')}>
        <Switch
          size="small"
          checked={!!drillthrough}
          aria-label={t('Drill through to this page')}
          data-test="auradata-drillthrough-toggle"
          onChange={on => save(on ? { columns: [] } : undefined)}
        />
      </Field>
      {drillthrough && (
        <>
          <Select
            mode="multiple"
            ariaLabel={t('Drill through columns')}
            placeholder={t('Choose the columns')}
            value={drillthrough.columns}
            data-test="auradata-drillthrough-columns"
            onChange={value =>
              save({ columns: (value as string[]).map(String) })
            }
            options={columns.map(column => ({
              value: column,
              label: column,
            }))}
          />
          <Hint>
            {t(
              'On another page, right-click a data point and choose "Drill through" to open this page filtered to it.',
            )}
          </Hint>
        </>
      )}
    </Section>
  );
}
