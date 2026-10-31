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
import { useEffect, useRef, useState } from 'react';
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
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type {
  LayoutItem,
  LayoutItemMeta,
  RootState,
} from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  deleteBackground,
  setSharedVisualFormat,
  setCanvasFormat,
  setVisualFormat,
  uploadBackground,
} from './actions';
import { ColorField, Field, RangeField, Section, Segments } from './controls';
import { selectVisual, useSelectedVisual } from './selection';
import { GridSection } from './GridSection';
import { mergeVisualFormat } from './styles';
import { useSharedVisualFormat } from './useVisualFormat';
import { setMobilePreview, useMobilePreview } from './mobile';
import { BoxSections } from './BoxSections';
import { ThemeSection } from './ThemeSection';
import { fitObjectsToPage } from './CanvasFrame';
import { useReportLook } from 'src/mibi/report/ReportTheme';
import { ObjectFlagToggles } from './ObjectFlags';
import { isCopyable, useClipboard } from './clipboard';
import { useObjectCommands } from './useObjectCommands';
import {
  canPasteFormat,
  cancelFormatPainter,
  copiedFormat,
  copyFormat,
  isPainterArmed,
  pasteFormat,
  useFormatPainter,
} from './formatPainter';
import { ElementSection, elementName } from 'src/mibi/elements/ElementFormat';
import { elementKind } from 'src/mibi/elements/types';
import {
  CANVAS_PRESETS,
  DEFAULT_APPEARANCE,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_GAP,
  DEFAULT_PADDING,
  MAX_CANVAS,
  MIN_CANVAS,
  type AreaStyle,
  type CanvasBackgroundType,
  type CanvasFormat,
  type CanvasSizeMode,
  type ImageFit,
  type ReportAppearance,
  type TitleAlign,
  type VisualFormat,
} from './types';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

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

    .painter-bar {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};

      > .ant-btn {
        flex: 1 1 0;
        min-width: 0;
        justify-content: center;
      }
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

function VisualSection({ id }: { id: string }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const item = useSelector(
    (state: RootState) => state.dashboardLayout.present[id],
  );
  const own: VisualFormat = item?.meta?.mibiFormat ?? {};
  const shared = useSharedVisualFormat();
  const format: VisualFormat = mergeVisualFormat(shared, own) ?? {};
  const update = (patch: Partial<VisualFormat>, setting: string) =>
    dispatch(
      setVisualFormat(id, { ...own, ...patch }, `visual:${id}:${setting}`),
    );
  const updateTitle = (patch: VisualFormat['title'], setting: string) =>
    update({ title: { ...own.title, ...patch } }, `title-${setting}`);
  const titleShown = format.title?.show !== false;

  return (
    <>
      <BoxSections id={id} />

      <Section>
        <h4>{t('Title')}</h4>
        <Field
          label={t('Show title')}
          help={{
            kind: 'cardTitle',
            text: t(
              'Shows the name of the chart above it, with the size, color and alignment you choose.',
            ),
          }}
        >
          <Switch
            size="small"
            checked={titleShown}
            aria-label={t('Show title')}
            data-test="mibi-format-title-show"
            onChange={show => updateTitle({ show }, 'show')}
          />
        </Field>
        {titleShown && (
          <>
            <RangeField
              label={t('Size')}
              value={format.title?.size ?? 14}
              min={10}
              max={28}
              onChange={size => updateTitle({ size }, 'size')}
            />
            <ColorField
              label={t('Color')}
              value={format.title?.color || theme.colorText}
              onChange={color => updateTitle({ color }, 'color')}
            />
            <Field label={t('Alignment')}>
              <Segments<TitleAlign>
                name={t('Alignment')}
                value={format.title?.align ?? 'left'}
                onChange={align => updateTitle({ align }, 'align')}
                options={[
                  {
                    value: 'left',
                    title: t('Left'),
                    label: <Icons.AlignLeftOutlined iconSize="m" />,
                  },
                  {
                    value: 'center',
                    title: t('Center'),
                    label: <Icons.AlignCenterOutlined iconSize="m" />,
                  },
                  {
                    value: 'right',
                    title: t('Right'),
                    label: <Icons.AlignRightOutlined iconSize="m" />,
                  },
                ]}
              />
            </Field>
            <Input
              value={format.title?.subtitle ?? ''}
              placeholder={t('Subtitle (optional)')}
              maxLength={300}
              aria-label={t('Subtitle')}
              data-test="mibi-format-subtitle"
              onChange={event =>
                updateTitle({ subtitle: event.target.value }, 'subtitle')
              }
            />
            {format.title?.subtitle && (
              <>
                <RangeField
                  label={t('Subtitle size')}
                  value={format.title?.subtitleSize ?? 12}
                  min={9}
                  max={20}
                  onChange={subtitleSize =>
                    updateTitle({ subtitleSize }, 'subtitle-size')
                  }
                />
                <ColorField
                  label={t('Subtitle color')}
                  value={format.title?.subtitleColor || theme.colorTextTertiary}
                  onChange={subtitleColor =>
                    updateTitle({ subtitleColor }, 'subtitle-color')
                  }
                />
              </>
            )}
            <Field
              label={t('Line under the header')}
              help={{
                kind: 'headerLine',
                text: t('Draws a line between the title and the chart.'),
              }}
            >
              <Switch
                size="small"
                checked={!!format.title?.divider}
                aria-label={t('Line under the header')}
                data-test="mibi-format-divider"
                onChange={divider => updateTitle({ divider }, 'divider')}
              />
            </Field>
            {format.title?.divider && (
              <ColorField
                label={t('Line color')}
                value={format.title?.dividerColor || theme.colorBorderSecondary}
                onChange={dividerColor =>
                  updateTitle({ dividerColor }, 'divider-color')
                }
              />
            )}
          </>
        )}
      </Section>

      <Section>
        <h4>{t('Header icons')}</h4>
        <Field label={t('Chart menu')}>
          <Switch
            size="small"
            checked={format.header?.menu !== false}
            aria-label={t('Chart menu')}
            data-test="mibi-format-menu"
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
      </Section>

      <div className="actions">
        <Button
          buttonStyle="secondary"
          data-test="mibi-format-apply-all"
          onClick={() => dispatch(setSharedVisualFormat(format))}
        >
          {t('Apply to all charts')}
        </Button>
        <Button
          buttonStyle="link"
          data-test="mibi-format-reset-visual"
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
    <Section data-test={`mibi-format-${area}`}>
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
          data-test={`mibi-format-${area}-reset`}
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
        state.dashboardLayout.present[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas,
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
  const mobilePreview = useMobilePreview();

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
      <ThemeSection />

      <Section data-test="mibi-format-appearance">
        <h4>{t('Appearance')}</h4>
        <Segments<ReportAppearance>
          name={t('Appearance')}
          value={canvas.appearance ?? DEFAULT_APPEARANCE}
          testId="mibi-format-appearance-mode"
          onChange={appearance => update({ appearance }, 'appearance')}
          options={[
            { value: 'light', label: t('Light') },
            { value: 'dark', label: t('Dark') },
            { value: 'app', label: t('Like the app') },
          ]}
        />
        <Hint>
          {t(
            'The report keeps this look whatever theme the app uses. Light by default, like a sheet of paper.',
          )}
        </Hint>
      </Section>

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

      <Section data-test="mibi-format-canvas-background">
        <h4>{t('Background')}</h4>
        <Segments<CanvasBackgroundType>
          name={t('Background')}
          value={background.type}
          testId="mibi-format-canvas-type"
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
            testId="mibi-format-canvas-color"
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
                data-test="mibi-format-upload"
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
                data-test="mibi-format-file"
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
          data-test="mibi-format-size"
          onChange={value => {
            const mode = value as CanvasSizeMode;
            update(
              {
                size:
                  mode === 'custom'
                    ? {
                        mode,
                        width: canvas.size?.width ?? 1280,
                        height: canvas.size?.height ?? 720,
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
              min={MIN_CANVAS}
              max={MAX_CANVAS}
              value={canvas.size?.width ?? 1280}
              aria-label={t('Width')}
              addonAfter="px"
              onChange={width =>
                width &&
                update(
                  {
                    size: {
                      ...canvas.size,
                      mode: 'custom',
                      width: Number(width),
                    },
                  },
                  'size-width',
                )
              }
            />
            ×
            <InputNumber
              min={MIN_CANVAS}
              max={MAX_CANVAS}
              value={canvas.size?.height ?? 720}
              aria-label={t('Height')}
              addonAfter="px"
              onChange={height =>
                height &&
                update(
                  {
                    size: {
                      ...canvas.size,
                      mode: 'custom',
                      height: Number(height),
                    },
                  },
                  'size-height',
                )
              }
            />
          </div>
        )}
        <Button
          buttonStyle="secondary"
          data-test="mibi-fit-page"
          onClick={fitObjectsToPage}
        >
          {t('Fit the objects to the page height')}
        </Button>
      </Section>

      <Section>
        <h4>{t('Editing')}</h4>
        <Field
          label={t('View')}
          stacked
          help={{
            kind: 'mobileView',
            text: t(
              'On phones every object takes the full width, in the order of the canvas.',
            ),
          }}
        >
          <Segments<'desktop' | 'mobile'>
            name={t('View')}
            value={mobilePreview ? 'mobile' : 'desktop'}
            testId="mibi-format-preview"
            onChange={value => setMobilePreview(value === 'mobile')}
            options={[
              {
                value: 'desktop',
                label: (
                  <>
                    <Icons.DesktopOutlined iconSize="m" />
                    {t('Desktop')}
                  </>
                ),
              },
              {
                value: 'mobile',
                label: (
                  <>
                    <Icons.MobileOutlined iconSize="m" />
                    {t('Mobile')}
                  </>
                ),
              },
            ]}
          />
        </Field>
        {mobilePreview && (
          <Hint>
            {t(
              'On phones every object takes the full width, in the order of the canvas. Hide objects there with the phone button of the Format pane.',
            )}
          </Hint>
        )}
      </Section>

      <GridSection />

      <Section>
        <h4>{t('Spacing')}</h4>
        <RangeField
          label={t('Margins')}
          help={{
            kind: 'canvasMargins',
            text: t('Space between the edge of the page and the charts.'),
          }}
          value={canvas.padding ?? DEFAULT_PADDING}
          min={0}
          max={64}
          onChange={padding => update({ padding }, 'padding')}
          testId="mibi-format-margins"
        />
        <RangeField
          label={t('Space between charts')}
          help={{
            kind: 'canvasGap',
            text: t('Distance between neighboring charts and elements.'),
          }}
          value={canvas.gap ?? DEFAULT_GAP}
          min={0}
          max={48}
          step={2}
          onChange={gap => update({ gap }, 'gap')}
          testId="mibi-format-gap"
        />
      </Section>

      <div className="actions">
        <Button
          buttonStyle="link"
          data-test="mibi-format-reset-canvas"
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
/** Copy, paste and duplicate the selected object, or paste on the canvas. */
function ObjectBar({ item }: { item?: LayoutItem }) {
  const clipboard = useClipboard();
  const { copy, paste, duplicate } = useObjectCommands();
  if (!item && !clipboard) return null;
  return (
    <div className="painter-bar" data-test="mibi-object-bar">
      {item && isCopyable(item) && (
        <>
          <Tooltip title={t('Duplicate (Ctrl+D)')}>
            <Button
              buttonStyle="secondary"
              buttonSize="small"
              data-test="mibi-duplicate"
              onClick={() => duplicate(item.id)}
            >
              <Icons.CopyOutlined iconSize="m" />
              {t('Duplicate')}
            </Button>
          </Tooltip>
          <Tooltip title={t('Copy (Ctrl+C)')}>
            <Button
              buttonStyle="secondary"
              buttonSize="small"
              data-test="mibi-copy"
              onClick={() => copy(item.id)}
            >
              {t('Copy')}
            </Button>
          </Tooltip>
        </>
      )}
      {clipboard && (
        <Tooltip title={t('Paste (Ctrl+V)')}>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            data-test="mibi-paste"
            onClick={() => paste(item?.id ?? null)}
          >
            {t('Paste')}
          </Button>
        </Tooltip>
      )}
    </div>
  );
}

/** Copy format and paste format, for the selected object. */
function PainterBar({ item }: { item: LayoutItem }) {
  const dispatch = useDispatch();
  const { armed } = useFormatPainter();
  return (
    <div className="painter-bar">
      <Button
        buttonStyle={armed ? 'primary' : 'secondary'}
        buttonSize="small"
        data-test="mibi-copy-format"
        onClick={() => (armed ? cancelFormatPainter() : copyFormat(item))}
      >
        <Icons.FormatPainterOutlined iconSize="m" />
        {armed ? t('Cancel') : t('Copy format')}
      </Button>
      <Button
        buttonStyle="secondary"
        buttonSize="small"
        disabled={!canPasteFormat(item)}
        data-test="mibi-paste-format"
        onClick={() => dispatch(pasteFormat(item.id))}
      >
        {t('Paste format')}
      </Button>
    </div>
  );
}

export function FormatPane() {
  const selected = useSelectedVisual();
  const dispatch = useDispatch();
  const { armed } = useFormatPainter();

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

  return (
    <Pane data-test="mibi-format-pane">
      <div className="pane-header">
        {visual && (
          <button
            type="button"
            className="back"
            aria-label={t('Back to the canvas')}
            data-test="mibi-format-back"
            onClick={() => selectVisual(null)}
          >
            <Icons.LeftOutlined iconSize="s" />
          </button>
        )}
        <div className="crumbs">
          {visual && <span className="crumb-parent">{t('Canvas')}</span>}
          <span className="crumb-current" data-test="mibi-format-title">
            {visual
              ? kind
                ? elementName(kind)
                : visualName(item?.meta)
              : t('Canvas')}
          </span>
        </div>
        {visual && item && (
          <div className="header-actions">
            <ObjectFlagToggles item={item} />
          </div>
        )}
      </div>
      {armed && (
        <div className="painter-tip" role="status" data-test="mibi-painter-tip">
          <Icons.FormatPainterOutlined iconSize="m" />
          {t('Click another object to give it this format. Esc cancels.')}
        </div>
      )}
      <ObjectBar item={visual && item ? item : undefined} />
      {visual && item && <PainterBar item={item} />}
      <div className="pane-body">
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
      </div>
    </Pane>
  );
}
