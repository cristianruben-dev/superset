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
import { setPaneCollapsed } from './panes';
import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { getClientErrorObject } from '@superset-ui/core';
import {
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { LayoutItemMeta, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import {
  deleteBackground,
  setComponentMeta,
  setSharedVisualFormat,
  setCanvasFormat,
  setVisualFormat,
  uploadBackground,
} from './actions';
import {
  Hint,
  ColorField,
  Field,
  FormatSearchContext,
  RangeField,
  Section,
  Segments,
} from './controls';
import {
  selectVisual,
  useSelectedVisual,
  useSelectedVisuals,
} from './selection';
import { MultiSection } from './ArrangeSection';
import { GridSection } from './GridSection';
import { canvasSize, mergeVisualFormat } from './styles';
import { useSharedVisualFormat } from './useVisualFormat';
import { BoxSections } from './BoxSections';
import { TitleSections } from './TitleSections';
import {
  ActionButtonSection,
  ActionSection,
  ChartTooltipSection,
  HeaderIconsFields,
  HeaderTooltipSection,
  PropertiesSection,
  SpacingSection,
} from './GeneralSections';
import {
  useReportLook,
  useReportTokens,
} from 'src/auradata/report/ReportTheme';
import { EditInteractionsToggle } from 'src/auradata/report/InteractionControl';
import { setEditingInteractions } from 'src/auradata/report/interactions';
import { PageSection } from 'src/auradata/report/PageSection';
import {
  cancelFormatPainter,
  copiedFormat,
  isPainterArmed,
  pasteFormat,
  useFormatPainter,
} from './formatPainter';
import {
  ElementSection,
  elementName,
} from 'src/auradata/elements/ElementFormat';
import { elementKind } from 'src/auradata/elements/types';
import {
  CANVAS_PRESETS,
  DEFAULT_CANVAS_SIZE,
  CELL,
  MAX_CANVAS,
  MIN_CANVAS,
  type AreaStyle,
  type CanvasBackgroundType,
  type CanvasFormat,
  type CanvasSizeMode,
  type ImageFit,
  type VisualFormat,
} from './types';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const Pane = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    .pane-header {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      min-height: 48px;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }

    .pane-search {
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }

    .format-level {
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }

    .painter-tip {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimaryText};
      font-size: ${theme.fontSizeSM}px;
    }

    .header-actions {
      display: flex;
      gap: ${theme.sizeUnit}px;
      margin-left: auto;
    }

    .crumbs {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.3;
    }

    .crumb-parent {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }

    .crumb-current {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-weight: 600;
      color: ${theme.colorText};
    }

    .back {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorFillTertiary};
      color: ${theme.colorTextSecondary};
      cursor: pointer;

      &:hover {
        color: ${theme.colorPrimary};
      }
    }

    .pane-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-bottom: ${theme.sizeUnit * 16}px;

      /* Compact styling for Explore controls inside Visual and Analytics tabs */
      .auradata-chart-format-card,
      section[data-test^='auradata-chart-format-'] {
        gap: ${theme.sizeUnit * 1.5}px !important;

        div[class*='StyledControl'],
        .StyledControl {
          padding-bottom: ${theme.sizeUnit * 1.5}px !important;
          margin-bottom: 0 !important;
        }

        .ControlHeader {
          margin-bottom: ${theme.sizeUnit * 0.5}px !important;
          .FormLabel {
            margin-bottom: ${theme.sizeUnit * 0.5}px !important;
            font-size: ${theme.fontSizeSM}px !important;
            font-weight: 500 !important;
            color: ${theme.colorTextSecondary} !important;
          }
        }

        h5 {
          margin: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit}px !important;
          font-size: ${theme.fontSizeSM}px !important;
          font-weight: 600 !important;
          color: ${theme.colorText} !important;
        }

        .ant-select-single:not(.ant-select-customize-input) .ant-select-selector {
          height: 28px !important;
          padding: 0 8px !important;
        }

        .ant-slider {
          margin: ${theme.sizeUnit}px 0 !important;
        }
      }
    }

    .tip {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      margin: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px 0;
      padding: ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorFillQuaternary};
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }

    .image-box {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
    }

    .thumb {
      flex: none;
      width: 64px;
      height: 40px;
      border-radius: ${theme.borderRadiusSM}px;
      border: 1px solid ${theme.colorBorderSecondary};
      background-size: cover;
      background-position: center;
      background-color: ${theme.colorFillTertiary};
    }

    .size-inputs {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      color: ${theme.colorTextTertiary};

      .ant-input-number {
        width: 100%;
      }
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 4}px;
    }

    .full-select {
      width: 100%;
    }
  `}
`;

const visualName = (meta: LayoutItemMeta | undefined) =>
  String(meta?.sliceNameOverride || meta?.sliceName || t('Chart'));

// The controls of Explore load when a chart asks for them, not with the report
const ChartFieldsSections = lazy(() =>
  import('./ChartFieldsSections').then(module => ({
    default: module.ChartFieldsSections,
  })),
);
const ChartFormatSections = lazy(() =>
  import('./ChartFormatSections').then(module => ({
    default: module.ChartFormatSections,
  })),
);

type FormatLevel = 'fields' | 'visual' | 'analytics' | 'general';

/** The level stays while going through objects. */
let shownLevel: FormatLevel = 'visual';

function VisualSection({ id }: { id: string }) {
  const look = useReportTokens();
  const dispatch = useDispatch();
  const item = useSelector(
    (state: RootState) => state.dashboardLayout.present[id],
  );
  const own: VisualFormat = item?.meta?.auradataFormat ?? {};
  const shared = useSharedVisualFormat();
  const format: VisualFormat = mergeVisualFormat(shared, own) ?? {};
  const update = (patch: Partial<VisualFormat>, setting: string) =>
    dispatch(
      setVisualFormat(id, { ...own, ...patch }, `visual:${id}:${setting}`),
    );
  const chartId = item?.meta?.chartId;
  const [chosenLevel, setLevelState] = useState(shownLevel);
  const setLevel = (next: FormatLevel) => {
    shownLevel = next;
    setLevelState(next);
    // Fields are dragged from the Data pane
    if (next === 'fields') setPaneCollapsed('data', false);
  };
  // What only charts have shows their look on any other object
  const level =
    chartId === undefined &&
    (chosenLevel === 'fields' || chosenLevel === 'analytics')
      ? 'visual'
      : chosenLevel;
  const searching = !!useContext(FormatSearchContext).trim();
  const showVisual = searching || level === 'visual';
  const showGeneral = searching || level === 'general';

  return (
    <>
      <div className="format-level">
        <Segments<FormatLevel>
          name={t('Format level')}
          value={level}
          testId="auradata-format-level"
          onChange={setLevel}
          options={[
            ...(chartId !== undefined
              ? [{ value: 'fields' as const, label: t('Fields') }]
              : []),
            { value: 'visual', label: t('Visual') },
            ...(chartId !== undefined
              ? [{ value: 'analytics' as const, label: t('Analytics') }]
              : []),
            { value: 'general', label: t('General') },
          ]}
        />
      </div>
      {level === 'fields' && !searching && chartId !== undefined && (
        <Suspense fallback={<Hint>{t('Loading...')}</Hint>}>
          <ChartFieldsSections id={id} chartId={chartId} />
        </Suspense>
      )}
      {(showVisual || level === 'analytics') && chartId !== undefined && (
        <Suspense fallback={<Hint>{t('Loading...')}</Hint>}>
          <ChartFormatSections
            id={id}
            chartId={chartId}
            level={searching ? undefined : (level as 'visual' | 'analytics')}
          />
        </Suspense>
      )}

      {showGeneral && <BoxSections id={id} />}

      {showGeneral && <TitleSections id={id} />}

      {showGeneral && (
        <Section>
          <h4>{t('Header icons')}</h4>
          <Field label={t('Chart menu')}>
            <Switch
              size="small"
              checked={format.header?.menu !== false}
              aria-label={t('Chart menu')}
              data-test="auradata-format-menu"
              onChange={menu =>
                update({ header: { ...own.header, menu } }, 'header-menu')
              }
            />
          </Field>
          <Field label={t('Filter and cross-filter badges')}>
            <Switch
              size="small"
              checked={format.header?.badges !== false}
              aria-label={t('Filter and cross-filter badges')}
              onChange={badges =>
                update({ header: { ...own.header, badges } }, 'header-badges')
              }
            />
          </Field>
          <ColorField
            label={t('Icon color')}
            value={format.header?.iconColor || look.colorTextSecondary}
            onChange={iconColor =>
              update({ header: { ...own.header, iconColor } }, 'header-color')
            }
          />
          <HeaderIconsFields id={id} />
          <ColorField
            label={t('Icon background')}
            value={format.header?.iconBackground || look.colorBgContainer}
            onChange={iconBackground =>
              update(
                { header: { ...own.header, iconBackground } },
                'header-background',
              )
            }
          />
        </Section>
      )}

      {showGeneral && <SpacingSection id={id} />}
      {showGeneral && <HeaderTooltipSection id={id} />}
      {showGeneral && <ChartTooltipSection id={id} />}
      {showGeneral && <ActionSection id={id} />}
      {showGeneral && <ActionButtonSection id={id} />}
      {showGeneral && <PropertiesSection id={id} />}

      {showGeneral && (
        <Section>
          <h4>{t('Alt text')}</h4>
          <Input.TextArea
            rows={2}
            value={String(item?.meta?.auradataAltText ?? '')}
            placeholder={t('Describes the chart for screen readers')}
            aria-label={t('Alt text')}
            data-test="auradata-format-alt-text"
            onChange={event =>
              dispatch(
                setComponentMeta(
                  id,
                  'auradataAltText',
                  event.target.value || undefined,
                ),
              )
            }
          />
        </Section>
      )}

      <div className="actions">
        <Button
          buttonStyle="secondary"
          data-test="auradata-format-apply-all"
          onClick={() => dispatch(setSharedVisualFormat(format))}
        >
          {t('Apply to all charts')}
        </Button>
        <Button
          buttonStyle="link"
          data-test="auradata-format-reset-visual"
          onClick={() => dispatch(setVisualFormat(id, undefined))}
        >
          {t('Reset format')}
        </Button>
      </div>
    </>
  );
}

/** Colors of the filter panel or of the tabs, over the report's own look. */
function AreaColorsSection({
  area,
  title,
  canvas,
  update,
}: {
  area: 'filterBar' | 'tabs';
  title: string;
  canvas: CanvasFormat;
  update: (patch: Partial<CanvasFormat>, setting: string) => void;
}) {
  const appTheme = useTheme();
  // Show the colors the report really has, not the app's
  const theme = useReportLook(area)?.theme ?? appTheme;
  const style: AreaStyle = canvas[area] ?? {};
  const set = (patch: Partial<AreaStyle>, setting: string) => {
    const next = { ...style, ...patch };
    update(
      { [area]: Object.keys(next).length ? next : undefined },
      `${area}-${setting}`,
    );
  };
  return (
    <Section data-test={`auradata-format-${area}`}>
      <h4>{title}</h4>
      <ColorField
        label={t('Background')}
        value={style.background ?? theme.colorBgContainer}
        onChange={background => set({ background }, 'background')}
      />
      <ColorField
        label={t('Text')}
        value={style.text ?? theme.colorText}
        onChange={text => set({ text }, 'text')}
      />
      <ColorField
        label={t('Accent')}
        value={style.accent ?? theme.colorPrimary}
        onChange={accent => set({ accent }, 'accent')}
      />
      {Object.keys(style).length > 0 && (
        <Button
          buttonStyle="link"
          data-test={`auradata-format-${area}-reset`}
          onClick={() => update({ [area]: undefined }, `${area}-reset`)}
        >
          {t('Restore colors')}
        </Button>
      )}
    </Section>
  );
}

function CanvasSection() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { addDangerToast } = useToasts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const canvas: CanvasFormat =
    useSelector(
      (state: RootState) =>
        state.dashboardLayout.present[DASHBOARD_ROOT_ID]?.meta?.auradataCanvas,
    ) ?? {};
  const background = canvas.background ?? { type: 'none' as const };
  const update = (patch: Partial<CanvasFormat>, setting: string) =>
    dispatch(setCanvasFormat({ ...canvas, ...patch }, `canvas:${setting}`));
  const updateBackground = (
    patch: Partial<NonNullable<CanvasFormat['background']>>,
    setting: string,
  ) =>
    update(
      { background: { ...background, ...patch } },
      `background-${setting}`,
    );
  const sizeMode: CanvasSizeMode =
    canvas.size &&
    ['16:9', '4:3', 'letter', 'custom'].includes(canvas.size.mode)
      ? canvas.size.mode
      : DEFAULT_CANVAS_SIZE;

  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      addDangerToast(t('The image is larger than 2 MB'));
      return;
    }
    setUploading(true);
    try {
      const image = await uploadBackground(dashboardId, file);
      updateBackground({ type: 'image', image }, 'image');
    } catch (error) {
      const { message, error: text } = await getClientErrorObject(error);
      logging.error(error);
      addDangerToast(message || text || t('The image could not be uploaded'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = async () => {
    try {
      await deleteBackground(dashboardId);
    } catch (error) {
      logging.error(error);
    }
    update({ background: { type: 'none' } }, 'background-image');
  };

  return (
    <>
      <PageSection />

      <AreaColorsSection
        area="filterBar"
        title={t('Filter panel')}
        canvas={canvas}
        update={update}
      />
      <AreaColorsSection
        area="tabs"
        title={t('Tabs')}
        canvas={canvas}
        update={update}
      />

      <Section data-test="auradata-format-canvas-background">
        <h4>{t('Background')}</h4>
        <Segments<CanvasBackgroundType>
          name={t('Background')}
          value={background.type}
          testId="auradata-format-canvas-type"
          onChange={type => updateBackground({ type }, 'type')}
          options={[
            { value: 'none', label: t('None') },
            { value: 'color', label: t('Color') },
            { value: 'gradient', label: t('Gradient') },
            { value: 'image', label: t('Image') },
          ]}
        />
        {background.type === 'color' && (
          <ColorField
            label={t('Color')}
            value={background.color || theme.colorBgLayout}
            onChange={color => updateBackground({ color }, 'color')}
            testId="auradata-format-canvas-color"
          />
        )}
        {background.type === 'gradient' && (
          <>
            <ColorField
              label={t('From')}
              value={background.color || theme.colorBgLayout}
              onChange={color => updateBackground({ color }, 'color')}
            />
            <ColorField
              label={t('To')}
              value={background.color2 || theme.colorPrimaryBg}
              onChange={color2 => updateBackground({ color2 }, 'color2')}
            />
            <RangeField
              label={t('Angle')}
              value={background.angle ?? 135}
              min={0}
              max={360}
              step={5}
              unit="°"
              onChange={angle => updateBackground({ angle }, 'angle')}
            />
          </>
        )}
        {background.type === 'image' && (
          <>
            <div className="image-box">
              <span
                className="thumb"
                style={
                  background.image
                    ? { backgroundImage: `url("${background.image}")` }
                    : undefined
                }
              />
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
                data-test="auradata-format-upload"
              >
                <Icons.UploadOutlined iconSize="m" />
                {background.image ? t('Change') : t('Upload image')}
              </Button>
              {background.image && (
                <Button
                  buttonStyle="link"
                  buttonSize="small"
                  onClick={removeImage}
                >
                  {t('Remove')}
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                hidden
                data-test="auradata-format-file"
                onChange={event => onFile(event.target.files?.[0])}
              />
            </div>
            <Field label={t('Fit')}>
              <Segments<ImageFit>
                name={t('Fit')}
                value={background.fit ?? 'cover'}
                onChange={fit => updateBackground({ fit }, 'fit')}
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
              unit="%"
              onChange={opacity => updateBackground({ opacity }, 'opacity')}
            />
          </>
        )}
      </Section>

      <Section>
        <h4>{t('Canvas size')}</h4>
        <Select
          className="full-select"
          ariaLabel={t('Canvas size')}
          value={sizeMode}
          data-test="auradata-format-size"
          onChange={value => {
            const mode = value as CanvasSizeMode;
            update(
              {
                size:
                  mode === 'custom'
                    ? {
                        mode,
                        width: canvasSize(canvas).width,
                        height: canvasSize(canvas).height,
                      }
                    : { mode },
              },
              'size',
            );
          }}
          options={[
            {
              value: '16:9',
              label: t('16:9 (%s × %s)', ...CANVAS_PRESETS['16:9']),
            },
            {
              value: '4:3',
              label: t('4:3 (%s × %s)', ...CANVAS_PRESETS['4:3']),
            },
            {
              value: 'letter',
              label: t('Letter (%s × %s)', ...CANVAS_PRESETS.letter),
            },
            { value: 'custom', label: t('Custom') },
          ]}
        />
        {sizeMode === 'custom' && (
          <div className="size-inputs">
            <InputNumber
              min={MIN_CANVAS / CELL}
              max={MAX_CANVAS / CELL}
              precision={0}
              value={canvasSize(canvas).width / CELL}
              aria-label={t('Width')}
              addonAfter={t('squares')}
              onChange={width =>
                width &&
                update(
                  {
                    size: {
                      ...canvasSize(canvas),
                      mode: 'custom',
                      width: Math.round(Number(width)) * CELL,
                    },
                  },
                  'size-width',
                )
              }
            />
            ×
            <InputNumber
              min={MIN_CANVAS / CELL}
              max={MAX_CANVAS / CELL}
              precision={0}
              value={canvasSize(canvas).height / CELL}
              aria-label={t('Height')}
              addonAfter={t('squares')}
              onChange={height =>
                height &&
                update(
                  {
                    size: {
                      ...canvasSize(canvas),
                      mode: 'custom',
                      height: Math.round(Number(height)) * CELL,
                    },
                  },
                  'size-height',
                )
              }
            />
          </div>
        )}
      </Section>

      <GridSection />

      <div className="actions">
        <Button
          buttonStyle="link"
          data-test="auradata-format-reset-canvas"
          onClick={() => dispatch(setCanvasFormat(undefined))}
        >
          {t('Reset canvas')}
        </Button>
      </div>
    </>
  );
}

/**
 * The Format tab of the dashboard builder: the canvas when nothing is
 * selected, the selected chart otherwise.
 */
export function FormatPane() {
  const selected = useSelectedVisual();
  const many = useSelectedVisuals().length > 1;
  const dispatch = useDispatch();
  const { armed } = useFormatPainter();
  const [query, setQuery] = useState('');

  // The format painter gives its format to the next object selected
  useEffect(() => {
    if (!selected || !isPainterArmed()) return;
    if (copiedFormat()?.sourceId === selected) return;
    dispatch(pasteFormat(selected));
    cancelFormatPainter();
  }, [dispatch, selected]);

  useEffect(() => {
    if (!armed) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelFormatPainter();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [armed]);
  const item = useSelector((state: RootState) =>
    selected ? state.dashboardLayout.present[selected] : undefined,
  );
  const visual = selected && item ? selected : null;
  const kind = elementKind(item?.meta?.componentKey);

  // "Edit interactions" ends with the editing session
  useEffect(() => () => setEditingInteractions(false), []);

  return (
    <Pane data-test="auradata-format-pane">
      <div className="pane-header">
        {visual && (
          <button
            type="button"
            className="back"
            aria-label={t('Back to the canvas')}
            data-test="auradata-format-back"
            onClick={() => selectVisual(null)}
          >
            <Icons.LeftOutlined iconSize="s" />
          </button>
        )}
        <div className="crumbs">
          {visual && <span className="crumb-parent">{t('Canvas')}</span>}
          <span className="crumb-current" data-test="auradata-format-title">
            {visual
              ? kind
                ? elementName(kind)
                : visualName(item?.meta)
              : t('Canvas')}
          </span>
        </div>
        {visual && item && (
          <div className="header-actions">
            {item.type === CHART_TYPE && (
              <EditInteractionsToggle chartId={item.meta.chartId} />
            )}
          </div>
        )}
      </div>
      {armed && (
        <div
          className="painter-tip"
          role="status"
          data-test="auradata-painter-tip"
        >
          <Icons.FormatPainterOutlined iconSize="m" />
          {t('Click another object to give it this format. Esc cancels.')}
        </div>
      )}
      <div className="pane-search">
        <Input
          allowClear
          size="small"
          value={query}
          placeholder={t('Search')}
          prefix={<Icons.SearchOutlined iconSize="s" />}
          aria-label={t('Search settings')}
          data-test="auradata-format-search"
          onChange={event => setQuery(event.target.value)}
        />
      </div>
      <div className="pane-body">
        <FormatSearchContext.Provider value={query}>
          {many && <MultiSection />}
          {visual && kind ? (
            <ElementSection id={visual} />
          ) : visual ? (
            <VisualSection id={visual} />
          ) : (
            <>
              <div className="tip">
                <Icons.InfoCircleOutlined iconSize="m" />
                {t('Select a chart on the canvas to change its style.')}
              </div>
              <CanvasSection />
            </>
          )}
        </FormatSearchContext.Provider>
      </div>
    </Pane>
  );
}
