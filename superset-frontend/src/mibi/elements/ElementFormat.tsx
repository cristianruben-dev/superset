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
import { ReactNode, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  Filter,
  getClientErrorObject,
  NativeFilterType,
} from '@superset-ui/core';
import { Button, Input, Select, Switch } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { RootState } from 'src/dashboard/types';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { BoxSections } from 'src/mibi/format/BoxSections';
import {
  ColorField,
  Field,
  RangeField,
  Section,
  Segments,
} from 'src/mibi/format/controls';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';
import {
  deleteElementImage,
  setElementConfig,
  uploadElementImage,
} from './actions';
import { isSafeUrl } from './render';
import {
  BUTTON_ICONS,
  ELEMENT_DEFAULTS,
  ELEMENT_KEY,
  elementKind,
  type ButtonElement,
  type ElementAction,
  type ElementConfig,
  type ElementKind,
  type Fill,
  type FilterElement,
  type HoverEffect,
  type ImageElement,
  type Interactive,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
  type TextStyle,
} from './types';
import { ShapeView } from './views';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const elementName = (kind: ElementKind) =>
  ({
    image: t('Image'),
    shape: t('Shape'),
    button: t('Button'),
    text: t('Text box'),
    filter: t('Filter'),
  })[kind];

const Grid = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: ${theme.sizeUnit * 1.5}px;
  `}
`;

const Tile = styled.button<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: ${theme.sizeUnit * 2}px;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid
      ${$selected ? theme.colorPrimary : theme.colorBorderSecondary};
    background: ${$selected ? theme.colorPrimaryBg : theme.colorBgContainer};
    color: ${theme.colorTextSecondary};
    cursor: pointer;

    &:hover {
      border-color: ${theme.colorPrimary};
    }
  `}
`;

const Toolbar = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorFillTertiary};

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 28px;
      padding: 0 ${theme.sizeUnit * 1.5}px;
      border: 0;
      border-radius: ${theme.borderRadiusSM}px;
      background: transparent;
      color: ${theme.colorText};
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: ${theme.colorBgContainer};
      }
    }
  `}
`;

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const Row = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

function ActionFields({
  action,
  onChange,
}: {
  action: ElementAction | undefined;
  onChange: (action: ElementAction) => void;
}) {
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const tabs = useMemo(() => topLevelTabs(layout), [layout]);
  const current = action ?? { type: 'none' as const };
  const urlInvalid =
    current.type === 'url' && !!current.url && !isSafeUrl(current.url);
  return (
    <Section>
      <h4>{t('On click')}</h4>
      <Select
        ariaLabel={t('On click')}
        value={current.type}
        data-test="mibi-element-action"
        onChange={value =>
          onChange({ ...current, type: value as ElementAction['type'] })
        }
        options={[
          { value: 'none', label: t('Nothing') },
          ...(tabs.length
            ? [{ value: 'page', label: t('Go to a page of the dashboard') }]
            : []),
          { value: 'url', label: t('Open a link') },
          { value: 'reset-filters', label: t('Reset the filters') },
          { value: 'top', label: t('Scroll to the top') },
        ]}
      />
      {current.type === 'page' && (
        <Select
          ariaLabel={t('Page')}
          value={current.tabId}
          placeholder={t('Choose a page')}
          onChange={value => onChange({ ...current, tabId: String(value) })}
          options={tabs.map(tab => ({ value: tab.id, label: tab.title }))}
        />
      )}
      {current.type === 'url' && (
        <>
          <Input
            value={current.url ?? ''}
            placeholder="https://"
            maxLength={2048}
            aria-label={t('Link')}
            status={urlInvalid ? 'error' : undefined}
            onChange={event =>
              onChange({ ...current, url: event.target.value })
            }
          />
          {urlInvalid && (
            <Hint>
              {t('Use a link that starts with https://, http:// or /')}
            </Hint>
          )}
          <Field label={t('Open in a new tab')}>
            <Switch
              size="small"
              checked={!!current.newTab}
              aria-label={t('Open in a new tab')}
              onChange={newTab => onChange({ ...current, newTab })}
            />
          </Field>
        </>
      )}
    </Section>
  );
}

/** Hover effect and tooltip of an image, shape or button. */
function InteractiveFields({
  config,
  update,
  children,
}: {
  config: Interactive;
  update: (patch: Partial<Interactive>, setting: string) => void;
  children?: ReactNode;
}) {
  return (
    <Section>
      <h4>{t('On hover')}</h4>
      {children}
      <Field label={t('Effect')} stacked>
        <Segments<HoverEffect>
          name={t('Effect')}
          value={config.hoverEffect ?? 'none'}
          testId="mibi-hover-effect"
          onChange={hoverEffect => update({ hoverEffect }, 'hover-effect')}
          options={[
            { value: 'none', label: t('None') },
            { value: 'lift', label: t('Lift') },
            { value: 'grow', label: t('Grow') },
            { value: 'brighten', label: t('Brighten') },
          ]}
        />
      </Field>
      <Input
        value={config.tooltip ?? ''}
        placeholder={t('Tooltip (optional)')}
        maxLength={500}
        aria-label={t('Tooltip')}
        data-test="mibi-element-tooltip"
        onChange={event => update({ tooltip: event.target.value }, 'tooltip')}
      />
    </Section>
  );
}

function TextStyleFields({
  style,
  onChange,
  vertical = true,
  title = t('Text'),
}: {
  style: TextStyle | undefined;
  onChange: (style: TextStyle, setting: string) => void;
  vertical?: boolean;
  title?: string;
}) {
  const theme = useTheme();
  const current = style ?? {};
  const set = (patch: TextStyle, setting: string) =>
    onChange({ ...current, ...patch }, setting);
  return (
    <Section>
      <h4>{title}</h4>
      <RangeField
        label={t('Size')}
        value={current.size ?? 14}
        min={8}
        max={72}
        onChange={size => set({ size }, 'size')}
      />
      <ColorField
        label={t('Color')}
        value={current.color || theme.colorText}
        onChange={color => set({ color }, 'color')}
      />
      <Field label={t('Weight')} stacked>
        <Segments<string>
          name={t('Weight')}
          value={String(current.weight ?? 400)}
          onChange={weight =>
            set({ weight: Number(weight) as TextStyle['weight'] }, 'weight')
          }
          options={[
            { value: '400', label: t('Regular') },
            { value: '500', label: t('Medium') },
            { value: '600', label: t('Semibold') },
            { value: '700', label: t('Bold') },
          ]}
        />
      </Field>
      <Field label={t('Alignment')}>
        <Segments<NonNullable<TextStyle['align']>>
          name={t('Alignment')}
          value={current.align ?? 'left'}
          onChange={align => set({ align }, 'align')}
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
      {vertical && (
        <Field label={t('Vertical position')}>
          <Segments<NonNullable<TextStyle['verticalAlign']>>
            name={t('Vertical position')}
            value={current.verticalAlign ?? 'top'}
            onChange={verticalAlign => set({ verticalAlign }, 'valign')}
            options={[
              {
                value: 'top',
                title: t('Top'),
                label: <Icons.VerticalAlignTopOutlined iconSize="m" />,
              },
              {
                value: 'middle',
                title: t('Middle'),
                label: <Icons.PicCenterOutlined iconSize="m" />,
              },
              {
                value: 'bottom',
                title: t('Bottom'),
                label: <Icons.VerticalAlignBottomOutlined iconSize="m" />,
              },
            ]}
          />
        </Field>
      )}
      <RangeField
        label={t('Line height')}
        value={current.lineHeight ?? 1.4}
        min={0.8}
        max={3}
        step={0.1}
        unit="×"
        onChange={lineHeight => set({ lineHeight }, 'line-height')}
      />
      <RangeField
        label={t('Letter spacing')}
        value={current.letterSpacing ?? 0}
        min={-2}
        max={10}
        step={0.5}
        onChange={letterSpacing => set({ letterSpacing }, 'letter-spacing')}
      />
      <Field label={t('Italic')}>
        <Switch
          size="small"
          checked={!!current.italic}
          aria-label={t('Italic')}
          onChange={italic => set({ italic }, 'italic')}
        />
      </Field>
      <Field label={t('Uppercase')}>
        <Switch
          size="small"
          checked={!!current.uppercase}
          aria-label={t('Uppercase')}
          onChange={uppercase => set({ uppercase }, 'uppercase')}
        />
      </Field>
    </Section>
  );
}

function FillFields({
  fill,
  onChange,
}: {
  fill: Fill | undefined;
  onChange: (fill: Fill, setting: string) => void;
}) {
  const theme = useTheme();
  const current = fill ?? { type: 'solid' as const };
  const set = (patch: Partial<Fill>, setting: string) =>
    onChange({ ...current, ...patch }, setting);
  return (
    <Section>
      <h4>{t('Fill')}</h4>
      <Segments<Fill['type']>
        name={t('Fill')}
        value={current.type}
        testId="mibi-shape-fill"
        onChange={type => set({ type }, 'type')}
        options={[
          { value: 'none', label: t('None') },
          { value: 'solid', label: t('Solid') },
          { value: 'gradient', label: t('Gradient') },
        ]}
      />
      {current.type !== 'none' && (
        <>
          <ColorField
            label={current.type === 'gradient' ? t('From') : t('Color')}
            value={current.color || theme.colorPrimary}
            onChange={color => set({ color }, 'color')}
          />
          {current.type === 'gradient' && (
            <>
              <ColorField
                label={t('To')}
                value={current.color2 || theme.colorPrimaryBg}
                onChange={color2 => set({ color2 }, 'color2')}
              />
              <RangeField
                label={t('Angle')}
                value={current.angle ?? 135}
                min={0}
                max={360}
                step={5}
                unit="°"
                onChange={angle => set({ angle }, 'angle')}
              />
            </>
          )}
          <RangeField
            label={t('Opacity')}
            value={current.opacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={opacity => set({ opacity }, 'opacity')}
          />
        </>
      )}
    </Section>
  );
}

const shapeOptions = (): { value: ShapeKind; label: string }[] => [
  { value: 'rectangle', label: t('Rectangle') },
  { value: 'ellipse', label: t('Ellipse') },
  { value: 'triangle', label: t('Triangle') },
  { value: 'diamond', label: t('Diamond') },
  { value: 'hexagon', label: t('Hexagon') },
  { value: 'arrow', label: t('Arrow') },
  { value: 'chevron', label: t('Chevron') },
  { value: 'star', label: t('Star') },
  { value: 'line', label: t('Line') },
];

function ShapeSection({
  config,
  update,
}: {
  config: ShapeElement;
  update: (patch: Partial<ShapeElement>, setting: string) => void;
}) {
  const theme = useTheme();
  return (
    <>
      <Section>
        <h4>{t('Shape')}</h4>
        <Grid role="radiogroup" aria-label={t('Shape')}>
          {shapeOptions().map(shape => (
            <Tile
              key={shape.value}
              type="button"
              role="radio"
              title={shape.label}
              aria-label={shape.label}
              aria-checked={config.shape === shape.value}
              $selected={config.shape === shape.value}
              data-test={`mibi-shape-option-${shape.value}`}
              onClick={() => update({ shape: shape.value }, 'shape')}
            >
              <ShapeView
                id={`preview-${shape.value}`}
                editMode
                config={{
                  kind: 'shape',
                  shape: shape.value,
                  fill: { type: 'solid', color: theme.colorTextTertiary },
                  stroke: { width: 2, color: theme.colorTextTertiary },
                  radius: 3,
                }}
              />
            </Tile>
          ))}
        </Grid>
      </Section>
      {config.shape !== 'line' && (
        <FillFields
          fill={config.fill}
          onChange={(fill, setting) => update({ fill }, `fill-${setting}`)}
        />
      )}
      <Section>
        <h4>{config.shape === 'line' ? t('Line') : t('Outline')}</h4>
        <ColorField
          label={t('Color')}
          value={config.stroke?.color || theme.colorPrimary}
          onChange={color =>
            update({ stroke: { ...config.stroke, color } }, 'stroke-color')
          }
        />
        <RangeField
          label={t('Width')}
          value={config.stroke?.width ?? (config.shape === 'line' ? 2 : 0)}
          min={0}
          max={16}
          onChange={width =>
            update({ stroke: { ...config.stroke, width } }, 'stroke-width')
          }
        />
        <Field label={t('Style')} stacked>
          <Segments<'solid' | 'dashed' | 'dotted'>
            name={t('Style')}
            value={config.stroke?.dash ?? 'solid'}
            onChange={dash =>
              update({ stroke: { ...config.stroke, dash } }, 'stroke-dash')
            }
            options={[
              { value: 'solid', label: t('Solid') },
              { value: 'dashed', label: t('Dashed') },
              { value: 'dotted', label: t('Dotted') },
            ]}
          />
        </Field>
        {config.shape === 'rectangle' && (
          <RangeField
            label={t('Rounded corners')}
            value={config.radius ?? 0}
            min={0}
            max={120}
            onChange={radius => update({ radius }, 'radius')}
          />
        )}
      </Section>
      <Section>
        <h4>{t('Position and effects')}</h4>
        <RangeField
          label={t('Rotation')}
          value={config.rotation ?? 0}
          min={0}
          max={360}
          step={5}
          unit="°"
          onChange={rotation => update({ rotation }, 'rotation')}
        />
        <Field label={t('Shadow')} stacked>
          <Segments<'none' | 'soft' | 'strong'>
            name={t('Shadow')}
            value={config.shadow ?? 'none'}
            onChange={shadow => update({ shadow }, 'shadow')}
            options={[
              { value: 'none', label: t('None') },
              { value: 'soft', label: t('Soft') },
              { value: 'strong', label: t('Strong') },
            ]}
          />
        </Field>
      </Section>
      {config.shape !== 'line' && (
        <>
          <Section>
            <h4>{t('Text inside')}</h4>
            <Input.TextArea
              value={config.text ?? ''}
              placeholder={t('Optional text')}
              maxLength={500}
              aria-label={t('Text inside')}
              autoSize={{ minRows: 2, maxRows: 6 }}
              onChange={event => update({ text: event.target.value }, 'text')}
            />
          </Section>
          {config.text && (
            <TextStyleFields
              title={t('Text style')}
              style={config.textStyle}
              onChange={(textStyle, setting) =>
                update({ textStyle }, `text-${setting}`)
              }
            />
          )}
        </>
      )}
      <InteractiveFields config={config} update={update}>
        {config.shape !== 'line' && config.fill?.type !== 'none' && (
          <>
            <Field label={t('Change the fill color')}>
              <Switch
                size="small"
                checked={!!config.hoverFill}
                aria-label={t('Change the fill color')}
                onChange={on =>
                  update(
                    { hoverFill: on ? theme.colorPrimaryHover : undefined },
                    'hover-fill',
                  )
                }
              />
            </Field>
            {config.hoverFill && (
              <ColorField
                label={t('Fill color')}
                value={config.hoverFill}
                onChange={hoverFill => update({ hoverFill }, 'hover-fill')}
              />
            )}
          </>
        )}
      </InteractiveFields>
      <ActionFields
        action={config.action}
        onChange={action => update({ action }, 'action')}
      />
    </>
  );
}

function ImageSection({
  id,
  config,
  update,
}: {
  id: string;
  config: ImageElement;
  update: (patch: Partial<ImageElement>, setting: string) => void;
}) {
  const { addDangerToast } = useToasts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const uploaded = config.src?.startsWith('/api/v1/dashboard_image/');

  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      addDangerToast(t('The image is larger than 2 MB'));
      return;
    }
    setUploading(true);
    try {
      const previous = config.imageId;
      const image = await uploadElementImage(dashboardId, file);
      update(
        { src: image.url, imageId: image.id, alt: config.alt ?? file.name },
        'src',
      );
      if (previous) deleteElementImage(dashboardId, previous).catch(() => {});
    } catch (error) {
      const { message, error: text } = await getClientErrorObject(error);
      logging.error(error);
      addDangerToast(message || text || t('The image could not be uploaded'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = () => {
    if (config.imageId) {
      deleteElementImage(dashboardId, config.imageId).catch(() => {});
    }
    update({ src: undefined, imageId: undefined }, 'src');
  };

  return (
    <>
      <Section>
        <h4>{t('Picture')}</h4>
        <Row>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            loading={uploading}
            data-test="mibi-element-upload"
            onClick={() => fileRef.current?.click()}
          >
            <Icons.UploadOutlined iconSize="m" />
            {config.src ? t('Change') : t('Upload image')}
          </Button>
          {config.src && (
            <Button buttonStyle="link" buttonSize="small" onClick={remove}>
              {t('Remove')}
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/gif,image/webp"
            data-test="mibi-element-file"
            onChange={event => onFile(event.target.files?.[0])}
          />
        </Row>
        <Input
          value={uploaded ? '' : (config.src ?? '')}
          placeholder={t('…or paste the link of a picture')}
          maxLength={2048}
          aria-label={t('Picture link')}
          onChange={event =>
            update(
              { src: event.target.value || undefined, imageId: undefined },
              'src-url',
            )
          }
        />
        <Input
          value={config.alt ?? ''}
          placeholder={t('Description for screen readers')}
          maxLength={500}
          aria-label={t('Description')}
          onChange={event => update({ alt: event.target.value }, 'alt')}
        />
      </Section>
      <Section>
        <h4>{t('Fit and position')}</h4>
        <Segments<NonNullable<ImageElement['fit']>>
          name={t('Fit')}
          value={config.fit ?? 'cover'}
          onChange={fit => update({ fit }, 'fit')}
          options={[
            { value: 'cover', label: t('Fill') },
            { value: 'contain', label: t('Fit') },
            { value: 'fill', label: t('Stretch') },
            { value: 'none', label: t('Original') },
          ]}
        />
        <Field label={t('Anchor')}>
          <Select
            ariaLabel={t('Anchor')}
            value={config.position ?? 'center'}
            onChange={value =>
              update(
                { position: value as ImageElement['position'] },
                'position',
              )
            }
            options={[
              { value: 'center', label: t('Center') },
              { value: 'top', label: t('Top') },
              { value: 'bottom', label: t('Bottom') },
              { value: 'left', label: t('Left') },
              { value: 'right', label: t('Right') },
            ]}
          />
        </Field>
      </Section>
      <Section>
        <h4>{t('Effects')}</h4>
        <RangeField
          label={t('Opacity')}
          value={config.opacity ?? 100}
          min={0}
          max={100}
          unit="%"
          onChange={opacity => update({ opacity }, 'opacity')}
        />
        <RangeField
          label={t('Rotation')}
          value={config.rotation ?? 0}
          min={0}
          max={360}
          step={5}
          unit="°"
          onChange={rotation => update({ rotation }, 'rotation')}
        />
        <RangeField
          label={t('Blur')}
          value={config.blur ?? 0}
          min={0}
          max={12}
          onChange={blur => update({ blur }, 'blur')}
        />
        <Field label={t('Black and white')}>
          <Switch
            size="small"
            checked={!!config.grayscale}
            aria-label={t('Black and white')}
            onChange={grayscale => update({ grayscale }, 'grayscale')}
          />
        </Field>
        <Field label={t('Mirror')}>
          <Switch
            size="small"
            checked={!!config.flip}
            aria-label={t('Mirror')}
            onChange={flip => update({ flip }, 'flip')}
          />
        </Field>
      </Section>
      <BoxSections id={id} />
      <InteractiveFields config={config} update={update} />
      <ActionFields
        action={config.action}
        onChange={action => update({ action }, 'action')}
      />
    </>
  );
}

const BUTTON_PRESETS = (
  theme: ReturnType<typeof useTheme>,
): { key: string; label: string; patch: Partial<ButtonElement> }[] => [
  {
    key: 'primary',
    label: t('Primary'),
    patch: {
      normal: {
        fill: theme.colorPrimary,
        color: theme.colorTextLightSolid,
        borderColor: theme.colorPrimary,
      },
      hover: { fill: theme.colorPrimaryHover },
      borderWidth: 0,
      shadow: 'soft',
    },
  },
  {
    key: 'secondary',
    label: t('Secondary'),
    patch: {
      normal: {
        fill: theme.colorPrimaryBg,
        color: theme.colorPrimary,
        borderColor: theme.colorPrimaryBg,
      },
      hover: { fill: theme.colorPrimaryBgHover },
      borderWidth: 0,
      shadow: 'none',
    },
  },
  {
    key: 'outline',
    label: t('Outline'),
    patch: {
      normal: {
        fill: 'transparent',
        color: theme.colorPrimary,
        borderColor: theme.colorPrimary,
      },
      hover: {
        fill: theme.colorPrimaryBg,
        color: theme.colorPrimary,
        borderColor: theme.colorPrimary,
      },
      borderWidth: 1,
      shadow: 'none',
    },
  },
  {
    key: 'ghost',
    label: t('Text only'),
    patch: {
      normal: {
        fill: 'transparent',
        color: theme.colorText,
        borderColor: 'transparent',
      },
      hover: { fill: theme.colorFillTertiary, color: theme.colorPrimary },
      borderWidth: 0,
      shadow: 'none',
    },
  },
];

function StateColors({
  title,
  state,
  fallback,
  onChange,
}: {
  title: string;
  state: ButtonElement['normal'];
  fallback: { fill: string; color: string; borderColor: string };
  onChange: (
    state: NonNullable<ButtonElement['normal']>,
    setting: string,
  ) => void;
}) {
  const current = state ?? {};
  return (
    <Section>
      <h4>{title}</h4>
      <ColorField
        label={t('Background')}
        value={current.fill || fallback.fill}
        onChange={fill => onChange({ ...current, fill }, 'fill')}
      />
      <ColorField
        label={t('Text and icon')}
        value={current.color || fallback.color}
        onChange={color => onChange({ ...current, color }, 'color')}
      />
      <ColorField
        label={t('Border')}
        value={current.borderColor || fallback.borderColor}
        onChange={borderColor =>
          onChange({ ...current, borderColor }, 'border')
        }
      />
    </Section>
  );
}

function ButtonSection({
  config,
  update,
}: {
  config: ButtonElement;
  update: (patch: Partial<ButtonElement>, setting: string) => void;
}) {
  const theme = useTheme();
  const IconsByName = Icons as Record<string, typeof Icons.ArrowRightOutlined>;
  return (
    <>
      <Section>
        <h4>{t('Content')}</h4>
        <Input
          value={config.label ?? t('Button')}
          aria-label={t('Label')}
          maxLength={200}
          data-test="mibi-button-label"
          onChange={event => update({ label: event.target.value }, 'label')}
        />
        <Field label={t('Icon')}>
          <Select
            ariaLabel={t('Icon')}
            value={config.icon ?? ''}
            allowClear
            showSearch
            onChange={value =>
              update({ icon: value ? String(value) : undefined }, 'icon')
            }
            options={[
              { value: '', label: t('No icon') },
              ...BUTTON_ICONS.filter(name => IconsByName[name]).map(name => {
                const IconComponent = IconsByName[name];
                return {
                  value: name,
                  label: (
                    <Row>
                      <IconComponent iconSize="m" />
                      {name
                        .replace(/Outlined$/, '')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </Row>
                  ),
                };
              }),
            ]}
          />
        </Field>
        {config.icon && (
          <Field label={t('Icon position')} stacked>
            <Segments<NonNullable<ButtonElement['iconPosition']>>
              name={t('Icon position')}
              value={config.iconPosition ?? 'left'}
              onChange={iconPosition =>
                update({ iconPosition }, 'icon-position')
              }
              options={[
                { value: 'left', label: t('Left') },
                { value: 'right', label: t('Right') },
                { value: 'only', label: t('Icon only') },
              ]}
            />
          </Field>
        )}
      </Section>
      <Section>
        <h4>{t('Style')}</h4>
        <Row style={{ flexWrap: 'wrap' }}>
          {BUTTON_PRESETS(theme).map(preset => (
            <Button
              key={preset.key}
              buttonStyle="secondary"
              buttonSize="small"
              data-test={`mibi-button-preset-${preset.key}`}
              onClick={() => update(preset.patch, `preset-${preset.key}`)}
            >
              {preset.label}
            </Button>
          ))}
        </Row>
        <RangeField
          label={t('Border width')}
          value={config.borderWidth ?? 0}
          min={0}
          max={8}
          onChange={borderWidth => update({ borderWidth }, 'border-width')}
        />
        <RangeField
          label={t('Rounded corners')}
          value={config.radius ?? 10}
          min={0}
          max={60}
          onChange={radius => update({ radius }, 'radius')}
        />
        <Field label={t('Shadow')} stacked>
          <Segments<'none' | 'soft' | 'strong'>
            name={t('Shadow')}
            value={config.shadow ?? 'soft'}
            onChange={shadow => update({ shadow }, 'shadow')}
            options={[
              { value: 'none', label: t('None') },
              { value: 'soft', label: t('Soft') },
              { value: 'strong', label: t('Strong') },
            ]}
          />
        </Field>
      </Section>
      <StateColors
        title={t('Colors')}
        state={config.normal}
        fallback={{
          fill: theme.colorPrimary,
          color: theme.colorTextLightSolid,
          borderColor: theme.colorPrimary,
        }}
        onChange={(normal, setting) => update({ normal }, `normal-${setting}`)}
      />
      <StateColors
        title={t('Colors on hover')}
        state={config.hover}
        fallback={{
          fill: config.normal?.fill || theme.colorPrimaryHover,
          color: config.normal?.color || theme.colorTextLightSolid,
          borderColor: config.normal?.borderColor || theme.colorPrimary,
        }}
        onChange={(hover, setting) => update({ hover }, `hover-${setting}`)}
      />
      <StateColors
        title={t('Colors while pressed')}
        state={config.pressed}
        fallback={{
          fill: config.hover?.fill || theme.colorPrimaryActive,
          color: config.hover?.color || theme.colorTextLightSolid,
          borderColor: config.hover?.borderColor || theme.colorPrimary,
        }}
        onChange={(pressed, setting) =>
          update({ pressed }, `pressed-${setting}`)
        }
      />
      <InteractiveFields config={config} update={update} />
      <TextStyleFields
        vertical={false}
        style={config.textStyle}
        onChange={(textStyle, setting) =>
          update({ textStyle }, `text-${setting}`)
        }
      />
      <ActionFields
        action={config.action}
        onChange={action => update({ action }, 'action')}
      />
    </>
  );
}

/** Formatting commands for the selected text; they keep the selection. */
const command =
  (name: string, value?: string) => (event: { preventDefault: () => void }) => {
    event.preventDefault();
    document.execCommand(name, false, value);
    // Saving happens in the text element's input handler
    document
      .querySelector('.mibi-selected .mibi-rich-text')
      ?.dispatchEvent(new Event('input', { bubbles: true }));
  };

function TextSection({
  id,
  config,
  update,
}: {
  id: string;
  config: TextElement;
  update: (patch: Partial<TextElement>, setting: string) => void;
}) {
  const theme = useTheme();
  const tool = (
    label: ReactNode,
    title: string,
    name: string,
    value?: string,
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={command(name, value)}
    >
      {label}
    </button>
  );
  const link = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    // eslint-disable-next-line no-alert
    const url = window.prompt(t('Link'), 'https://');
    if (url && isSafeUrl(url)) command('createLink', url)(event);
  };
  return (
    <>
      <Section>
        <h4>{t('Text')}</h4>
        <Hint>
          {t(
            'Write on the canvas. Select words and use these buttons to format them.',
          )}
        </Hint>
        <Toolbar data-test="mibi-text-toolbar">
          {tool(<Icons.BoldOutlined iconSize="m" />, t('Bold'), 'bold')}
          {tool(<Icons.ItalicOutlined iconSize="m" />, t('Italic'), 'italic')}
          {tool(
            <Icons.UnderlineOutlined iconSize="m" />,
            t('Underline'),
            'underline',
          )}
          {tool(
            <Icons.StrikethroughOutlined iconSize="m" />,
            t('Strikethrough'),
            'strikeThrough',
          )}
          {tool('H1', t('Title'), 'formatBlock', 'h1')}
          {tool('H2', t('Subtitle'), 'formatBlock', 'h2')}
          {tool('H3', t('Heading'), 'formatBlock', 'h3')}
          {tool('¶', t('Paragraph'), 'formatBlock', 'p')}
          {tool(
            <Icons.UnorderedListOutlined iconSize="m" />,
            t('Bulleted list'),
            'insertUnorderedList',
          )}
          {tool(
            <Icons.OrderedListOutlined iconSize="m" />,
            t('Numbered list'),
            'insertOrderedList',
          )}
          {tool('❝', t('Quote'), 'formatBlock', 'blockquote')}
          <button
            type="button"
            title={t('Link')}
            aria-label={t('Link')}
            onMouseDown={link}
          >
            <Icons.LinkOutlined iconSize="m" />
          </button>
          {tool(
            <Icons.ClearOutlined iconSize="m" />,
            t('Clear formatting'),
            'removeFormat',
          )}
        </Toolbar>
        <Row>
          {[
            theme.colorText,
            theme.colorTextSecondary,
            theme.colorPrimary,
            theme.colorSuccess,
            theme.colorWarning,
            theme.colorError,
          ].map(color => (
            <button
              key={color}
              type="button"
              title={t('Color of the selected text')}
              aria-label={t('Color of the selected text')}
              onMouseDown={command('foreColor', color)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                border: `1px solid ${theme.colorBorderSecondary}`,
                background: color,
                cursor: 'pointer',
              }}
            />
          ))}
        </Row>
      </Section>
      <TextStyleFields
        title={t('Base style')}
        style={config.textStyle}
        onChange={(textStyle, setting) =>
          update({ textStyle }, `text-${setting}`)
        }
      />
      <BoxSections id={id} />
    </>
  );
}

function FilterSection({
  id,
  config,
  update,
}: {
  id: string;
  config: FilterElement;
  update: (patch: Partial<FilterElement>, setting: string) => void;
}) {
  const filters = useFilters();
  const options = useMemo(
    () =>
      Object.values(filters)
        .filter(
          (item): item is Filter => item.type === NativeFilterType.NativeFilter,
        )
        .map(filter => ({ value: filter.id, label: filter.name })),
    [filters],
  );
  return (
    <>
      <Section>
        <h4>{t('Filter')}</h4>
        <Hint>
          {t(
            'Shows a filter of the dashboard on the canvas. Choices made here apply to the charts right away and also show in the filter bar.',
          )}
        </Hint>
        <Select
          ariaLabel={t('Filter to show')}
          data-test="mibi-filter-element-select"
          value={config.filterId}
          placeholder={
            options.length
              ? t('Choose a filter')
              : t('Add a filter to the dashboard first')
          }
          onChange={value => update({ filterId: String(value) }, 'filter')}
          options={options}
        />
        <Field label={t('Also show in the filter bar')}>
          <Switch
            size="small"
            checked={config.showInFilterBar !== false}
            aria-label={t('Also show in the filter bar')}
            onChange={showInFilterBar =>
              update({ showInFilterBar }, 'filter-bar')
            }
          />
        </Field>
      </Section>
      <BoxSections id={id} />
    </>
  );
}

/** Format pane settings of the selected design element. */
export function ElementSection({ id }: { id: string }) {
  const dispatch = useDispatch();
  const item = useSelector(
    (state: RootState) => state.dashboardLayout.present[id],
  );
  const kind = elementKind(item?.meta?.componentKey);
  if (!item || !kind) return null;
  const config = (item.meta[ELEMENT_KEY] ??
    ELEMENT_DEFAULTS[kind].element) as ElementConfig;
  const update = (patch: Partial<ElementConfig>, setting: string) =>
    dispatch(
      setElementConfig(
        id,
        { ...config, ...patch } as ElementConfig,
        `element:${id}:${setting}`,
      ),
    );

  switch (config.kind) {
    case 'image':
      return <ImageSection id={id} config={config} update={update} />;
    case 'button':
      return <ButtonSection config={config} update={update} />;
    case 'text':
      return <TextSection id={id} config={config} update={update} />;
    case 'filter':
      return <FilterSection id={id} config={config} update={update} />;
    default:
      return <ShapeSection config={config} update={update} />;
  }
}
