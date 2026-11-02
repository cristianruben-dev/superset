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
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { FONT_FAMILY_OPTIONS } from '@superset-ui/core';
import { Input, Select, Switch } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import { ActionFields } from 'src/mibi/elements/ElementFormat';
import { setVisualFormat } from './actions';
import {
  ColorField,
  Field,
  Hint,
  RangeField,
  Section,
  Segments,
} from './controls';
import { mergeVisualFormat } from './styles';
import type {
  ActionButtonFormat,
  ButtonEffect,
  ChartTooltipFormat,
  EffectPosition,
  HeaderTooltipFormat,
  TitleSpacing,
  VisualFormat,
} from './types';
import { TOOLTIP_FORMAT_KEY, SAMPLING_FORMAT_KEY } from './types';
import { useSharedVisualFormat } from './useVisualFormat';

const FONT_CHOICES = FONT_FAMILY_OPTIONS.map(([value, label]) => ({
  value,
  label,
}));

function useFormat(id: string) {
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
  return { own, format, update };
}

function Toggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId?: string;
}) {
  return (
    <Field label={label}>
      <Switch
        size="small"
        checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        data-test={testId}
        onChange={onChange}
      />
    </Field>
  );
}

/** Font family, size, bold, italic and underline of a piece of text. */
function TextFields({
  value,
  onChange,
  size = 12,
}: {
  value: {
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
  onChange: (patch: Partial<typeof value>) => void;
  size?: number;
}) {
  return (
    <>
      <Field label={t('Font')} stacked>
        <Select
          ariaLabel={t('Font')}
          allowClear
          placeholder={t('Theme font')}
          value={value.fontFamily}
          options={FONT_CHOICES}
          onChange={next =>
            onChange({ fontFamily: (next as string | null) ?? undefined })
          }
        />
      </Field>
      <RangeField
        label={t('Size')}
        value={value.fontSize ?? size}
        min={8}
        max={40}
        onChange={fontSize => onChange({ fontSize })}
      />
      <Toggle
        label={t('Bold')}
        checked={!!value.bold}
        onChange={bold => onChange({ bold })}
      />
      <Toggle
        label={t('Italic')}
        checked={!!value.italic}
        onChange={italic => onChange({ italic })}
      />
      <Toggle
        label={t('Underline')}
        checked={!!value.underline}
        onChange={underline => onChange({ underline })}
      />
    </>
  );
}

/** Space around the title, subtitle and divider of a chart. */
export function SpacingSection({ id }: { id: string }) {
  const { own, format, update } = useFormat(id);
  const spacing = format.title?.spacing ?? {};
  const set = (patch: Partial<TitleSpacing>, setting: string) =>
    update(
      { title: { ...own.title, spacing: { ...spacing, ...patch } } },
      `spacing-${setting}`,
    );
  const fields: [keyof TitleSpacing, string, number][] = [
    ['belowTitle', t('Space below title'), 0],
    ['aboveSubtitle', t('Space above subtitle'), 2],
    ['belowSubtitle', t('Space below subtitle'), 0],
    ['aboveDivider', t('Space above divider'), 8],
    ['abovePlot', t('Space above plot area'), 0],
    ['cardValue', t('Space between label and value'), 0],
  ];
  return (
    <Section collapsedByDefault data-test="mibi-format-spacing">
      <h4>{t('Spacing')}</h4>
      <Toggle
        label={t('Customize spacing')}
        checked={!!spacing.customize}
        testId="mibi-format-spacing-custom"
        onChange={customize => set({ customize }, 'customize')}
      />
      {spacing.customize &&
        fields.map(([key, label, base]) => (
          <RangeField
            key={key}
            label={label}
            value={(spacing[key] as number | undefined) ?? base}
            min={0}
            max={48}
            onChange={value => set({ [key]: value }, key)}
          />
        ))}
    </Section>
  );
}

/** Which icons a chart shows in its header, and how they look. */
export function HeaderIconsFields({ id }: { id: string }) {
  const { own, format, update } = useFormat(id);
  const theme = useTheme();
  const header = format.header ?? {};
  const set = (patch: NonNullable<VisualFormat['header']>, setting: string) =>
    update({ header: { ...own.header, ...patch } }, `header-${setting}`);
  return (
    <>
      <Toggle
        label={t('Show the header icons')}
        checked={header.show !== false}
        testId="mibi-format-header-show"
        onChange={show => set({ show }, 'show')}
      />
      <ColorField
        label={t('Icon border')}
        value={header.iconBorder || theme.colorBorderSecondary}
        onChange={iconBorder => set({ iconBorder }, 'border')}
      />
      <RangeField
        label={t('Icon opacity')}
        value={header.iconOpacity ?? 100}
        min={0}
        max={100}
        unit="%"
        onChange={iconOpacity => set({ iconOpacity }, 'opacity')}
      />
      <Toggle
        label={t('Focus mode icon')}
        checked={!!header.focus}
        testId="mibi-format-header-focus"
        onChange={focus => set({ focus }, 'focus')}
      />
      <Toggle
        label={t('See data icon')}
        checked={!!header.seeData}
        onChange={seeData => set({ seeData }, 'see-data')}
      />
      <Toggle
        label={t('Copy image icon')}
        checked={!!header.copy}
        onChange={copy => set({ copy }, 'copy')}
      />
      <Toggle
        label={t('Information icon')}
        checked={!!header.info}
        onChange={info => set({ info }, 'info')}
      />
      <Toggle
        label={t('Warning icon')}
        checked={header.warning !== false}
        onChange={warning => set({ warning }, 'warning')}
      />
      <Toggle
        label={t('Error icon')}
        checked={!!header.error}
        onChange={error => set({ error }, 'error')}
      />
    </>
  );
}

/** The icon with a text of its own in the header of a chart. */
export function HeaderTooltipSection({ id }: { id: string }) {
  const { own, format, update } = useFormat(id);
  const theme = useTheme();
  const tooltip: HeaderTooltipFormat = format.header?.tooltip ?? {};
  const set = (patch: Partial<HeaderTooltipFormat>, setting: string) =>
    update(
      {
        header: { ...own.header, tooltip: { ...tooltip, ...patch } },
      },
      `header-tooltip-${setting}`,
    );
  const on = !!format.header?.tooltipIcon;
  return (
    <Section collapsedByDefault data-test="mibi-format-header-tooltip">
      <h4>{t('Header tooltip')}</h4>
      <Toggle
        label={t('Show the tooltip icon')}
        checked={on}
        testId="mibi-format-header-tooltip-show"
        onChange={tooltipIcon =>
          update(
            { header: { ...own.header, tooltipIcon } },
            'header-tooltip-show',
          )
        }
      />
      {on && (
        <>
          <Input.TextArea
            rows={2}
            value={tooltip.text ?? ''}
            placeholder={t('Tooltip text')}
            aria-label={t('Tooltip text')}
            data-test="mibi-format-header-tooltip-text"
            onChange={event => set({ text: event.target.value }, 'text')}
          />
          <TextFields
            value={tooltip}
            onChange={patch => set(patch, 'text-style')}
          />
          <ColorField
            label={t('Text color')}
            value={tooltip.color || theme.colorTextLightSolid}
            onChange={color => set({ color }, 'color')}
          />
          <ColorField
            label={t('Background')}
            value={tooltip.background || theme.colorBgSpotlight}
            onChange={background => set({ background }, 'background')}
          />
          <RangeField
            label={t('Opacity')}
            value={tooltip.opacity ?? 100}
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

/** What the tooltips of the marks of a chart look like. */
export function ChartTooltipSection({ id }: { id: string }) {
  const { own, format, update } = useFormat(id);
  const theme = useTheme();
  const tooltip = (format.chart?.[TOOLTIP_FORMAT_KEY] ??
    {}) as ChartTooltipFormat;
  const set = (patch: Partial<ChartTooltipFormat>, setting: string) =>
    update(
      {
        chart: {
          ...own.chart,
          [TOOLTIP_FORMAT_KEY]: { ...tooltip, ...patch },
        },
      },
      `tooltip-${setting}`,
    );
  const shown = tooltip.show !== false;
  return (
    <Section
      collapsedByDefault
      data-test="mibi-format-tooltip"
      headExtra={
        <Switch
          size="small"
          checked={shown}
          aria-label={t('Tooltips')}
          data-test="mibi-format-tooltip-show"
          onChange={show => set({ show }, 'show')}
        />
      }
    >
      <h4>{t('Tooltips')}</h4>
      {shown && (
        <>
          <TextFields value={tooltip} onChange={patch => set(patch, 'text')} />
          <ColorField
            label={t('Label color')}
            value={tooltip.labelColor || theme.colorText}
            onChange={labelColor => set({ labelColor }, 'label-color')}
          />
          <ColorField
            label={t('Value color')}
            value={tooltip.valueColor || theme.colorText}
            onChange={valueColor => set({ valueColor }, 'value-color')}
          />
          <Toggle
            label={t('Bold values')}
            checked={!!tooltip.boldValues}
            onChange={boldValues => set({ boldValues }, 'bold-values')}
          />
          <ColorField
            label={t('Background')}
            value={tooltip.background || theme.colorBgElevated}
            onChange={background => set({ background }, 'background')}
          />
          <RangeField
            label={t('Opacity')}
            value={tooltip.opacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={opacity => set({ opacity }, 'opacity')}
          />
          <Input
            value={tooltip.sentence ?? ''}
            placeholder={t('Sentence, e.g. {series} in {name}: {value}')}
            maxLength={300}
            aria-label={t('Sentence template')}
            data-test="mibi-format-tooltip-sentence"
            onChange={event =>
              set({ sentence: event.target.value || undefined }, 'sentence')
            }
          />
          <Hint>
            {t(
              'With a sentence, the tooltip only shows it. Tokens: {series}, {name} and {value}.',
            )}
          </Hint>
        </>
      )}
    </Section>
  );
}

/** What a chart does through its link icon or its action button. */
export function ActionSection({ id }: { id: string }) {
  const { own, format, update } = useFormat(id);
  const link = format.link ?? {};
  const set = (patch: NonNullable<VisualFormat['link']>, setting: string) =>
    update({ link: { ...own.link, ...patch } }, `link-${setting}`);
  return (
    <>
      <Section
        collapsedByDefault
        data-test="mibi-format-action"
        headExtra={
          <Switch
            size="small"
            checked={!!link.show}
            aria-label={t('Action')}
            data-test="mibi-format-action-show"
            onChange={show => set({ show }, 'show')}
          />
        }
      >
        <h4>{t('Action')}</h4>
        {link.show && (
          <>
            <Input
              value={link.tooltip ?? ''}
              placeholder={t('Tooltip')}
              aria-label={t('Tooltip')}
              onChange={event =>
                set({ tooltip: event.target.value }, 'tooltip')
              }
            />
            <Input
              value={link.disabledTooltip ?? ''}
              placeholder={t('Tooltip while it is not available')}
              aria-label={t('Tooltip while it is not available')}
              onChange={event =>
                set({ disabledTooltip: event.target.value }, 'disabled-tooltip')
              }
            />
            <ActionFields
              action={link.action}
              onChange={action => set({ action }, 'action')}
            />
          </>
        )}
      </Section>
    </>
  );
}

const POSITIONS: { value: EffectPosition; label: string }[] = [
  { value: 'top-left', label: '↖' },
  { value: 'top', label: '↑' },
  { value: 'top-right', label: '↗' },
  { value: 'left', label: '←' },
  { value: 'center', label: '•' },
  { value: 'right', label: '→' },
  { value: 'bottom-left', label: '↙' },
  { value: 'bottom', label: '↓' },
  { value: 'bottom-right', label: '↘' },
];

/** Color, blur and position of the glow or the shadow of the action button. */
function EffectFields({
  effect,
  onChange,
}: {
  effect: ButtonEffect;
  onChange: (patch: Partial<ButtonEffect>) => void;
}) {
  const theme = useTheme();
  return (
    <>
      <ColorField
        label={t('Color')}
        value={effect.color || theme.colorText}
        onChange={color => onChange({ color })}
      />
      <RangeField
        label={t('Opacity')}
        value={effect.opacity ?? 40}
        min={0}
        max={100}
        unit="%"
        onChange={opacity => onChange({ opacity })}
      />
      <RangeField
        label={t('Blur')}
        value={effect.blur ?? 8}
        min={0}
        max={40}
        onChange={blur => onChange({ blur })}
      />
      <Toggle
        label={t('Inside the box')}
        checked={!!effect.inset}
        onChange={inset => onChange({ inset })}
      />
      <Field label={t('Position')} stacked>
        <Select
          ariaLabel={t('Position')}
          value={effect.position ?? 'center'}
          options={POSITIONS.map(({ value, label }) => ({
            value,
            label: `${label} ${value}`,
          }))}
          onChange={position =>
            onChange({ position: position as EffectPosition })
          }
        />
      </Field>
    </>
  );
}

/** Padding, on all sides or side by side. */
function PaddingFields({
  label,
  value,
  sides,
  onChange,
  base = 4,
}: {
  label: string;
  value: number | undefined;
  sides: ActionButtonFormat['paddingSides'];
  onChange: (patch: {
    padding?: number;
    paddingSides?: ActionButtonFormat['paddingSides'];
  }) => void;
  base?: number;
}) {
  const all = value ?? base;
  return (
    <>
      <Toggle
        label={t('%s by side', label)}
        checked={!!sides}
        onChange={bySide =>
          onChange({
            paddingSides: bySide
              ? { top: all, right: all, bottom: all, left: all }
              : undefined,
          })
        }
      />
      {sides ? (
        (
          [
            ['top', t('Top')],
            ['right', t('Right')],
            ['bottom', t('Bottom')],
            ['left', t('Left')],
          ] as const
        ).map(([side, name]) => (
          <RangeField
            key={side}
            label={name}
            value={sides[side] ?? all}
            min={0}
            max={32}
            onChange={next =>
              onChange({ paddingSides: { ...sides, [side]: next } })
            }
          />
        ))
      ) : (
        <RangeField
          label={label}
          value={all}
          min={0}
          max={32}
          onChange={padding => onChange({ padding })}
        />
      )}
    </>
  );
}

/** A button in the title area that runs the action of the chart. */
export function ActionButtonSection({ id }: { id: string }) {
  const { own, format, update } = useFormat(id);
  const theme = useTheme();
  const button: ActionButtonFormat = format.actionButton ?? {};
  const set = (patch: Partial<ActionButtonFormat>, setting: string) =>
    update(
      { actionButton: { ...own.actionButton, ...button, ...patch } },
      `button-${setting}`,
    );
  const nested = <
    K extends 'fill' | 'background' | 'border' | 'glow' | 'shadow',
  >(
    key: K,
    patch: Partial<NonNullable<ActionButtonFormat[K]>>,
  ) => set({ [key]: { ...button[key], ...patch } }, `${key}`);
  return (
    <Section
      collapsedByDefault
      data-test="mibi-format-action-button"
      headExtra={
        <Switch
          size="small"
          checked={!!button.show}
          aria-label={t('Action button')}
          data-test="mibi-format-action-button-show"
          onChange={show => set({ show }, 'show')}
        />
      }
    >
      <h4>{t('Action button')}</h4>
      {button.show && (
        <>
          <Hint>{t('It runs the action of the chart, set above.')}</Hint>
          <Field label={t('Position')} stacked>
            <Segments<NonNullable<ActionButtonFormat['position']>>
              name={t('Position')}
              value={button.position ?? 'within'}
              onChange={position => set({ position }, 'position')}
              options={[
                { value: 'above', label: t('Above title') },
                { value: 'within', label: t('In title') },
                { value: 'below', label: t('Below title') },
              ]}
            />
          </Field>
          <Toggle
            label={t('Icon only')}
            checked={!!button.iconOnly}
            onChange={iconOnly => set({ iconOnly }, 'icon-only')}
          />

          <Toggle
            label={t('Show the text')}
            checked={button.textShow !== false}
            onChange={textShow => set({ textShow }, 'text-show')}
          />
          <Input
            value={button.text ?? ''}
            placeholder={t('Button text')}
            aria-label={t('Button text')}
            data-test="mibi-format-action-button-text"
            onChange={event => set({ text: event.target.value }, 'text')}
          />
          <TextFields
            value={button}
            onChange={patch => set(patch, 'text-style')}
          />
          <ColorField
            label={t('Text color')}
            value={button.textColor || theme.colorText}
            onChange={textColor => set({ textColor }, 'text-color')}
          />
          <RangeField
            label={t('Text opacity')}
            value={button.textOpacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={textOpacity => set({ textOpacity }, 'text-opacity')}
          />
          <Field label={t('Horizontal alignment')} stacked>
            <Segments<NonNullable<ActionButtonFormat['alignHorizontal']>>
              name={t('Horizontal alignment')}
              value={button.alignHorizontal ?? 'center'}
              onChange={alignHorizontal =>
                set({ alignHorizontal }, 'align-horizontal')
              }
              options={[
                { value: 'left', label: t('Left') },
                { value: 'center', label: t('Center') },
                { value: 'right', label: t('Right') },
              ]}
            />
          </Field>
          <Field label={t('Vertical alignment')} stacked>
            <Segments<NonNullable<ActionButtonFormat['alignVertical']>>
              name={t('Vertical alignment')}
              value={button.alignVertical ?? 'middle'}
              onChange={alignVertical =>
                set({ alignVertical }, 'align-vertical')
              }
              options={[
                { value: 'top', label: t('Top') },
                { value: 'middle', label: t('Middle') },
                { value: 'bottom', label: t('Bottom') },
              ]}
            />
          </Field>
          <PaddingFields
            label={t('Text padding')}
            value={button.textPadding}
            sides={button.textPaddingSides}
            base={0}
            onChange={({ padding, paddingSides }) =>
              set(
                padding !== undefined
                  ? { textPadding: padding }
                  : { textPaddingSides: paddingSides },
                'text-padding',
              )
            }
          />

          <Toggle
            label={t('Show the icon')}
            checked={button.iconShow !== false}
            onChange={iconShow => set({ iconShow }, 'icon-show')}
          />
          <ColorField
            label={t('Icon color')}
            value={button.iconColor || theme.colorPrimary}
            onChange={iconColor => set({ iconColor }, 'icon-color')}
          />
          <RangeField
            label={t('Icon size')}
            value={button.iconSize ?? 14}
            min={8}
            max={40}
            onChange={iconSize => set({ iconSize }, 'icon-size')}
          />
          <RangeField
            label={t('Icon opacity')}
            value={button.iconOpacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={iconOpacity => set({ iconOpacity }, 'icon-opacity')}
          />
          <PaddingFields
            label={t('Icon padding')}
            value={button.iconPadding}
            sides={button.iconPaddingSides}
            base={0}
            onChange={({ padding, paddingSides }) =>
              set(
                padding !== undefined
                  ? { iconPadding: padding }
                  : { iconPaddingSides: paddingSides },
                'icon-padding',
              )
            }
          />

          <Toggle
            label={t('Show the fill')}
            checked={button.fill?.show !== false}
            onChange={show => nested('fill', { show })}
          />
          <ColorField
            label={t('Fill')}
            value={button.fill?.color || theme.colorFillTertiary}
            onChange={color => nested('fill', { color })}
          />
          <RangeField
            label={t('Fill opacity')}
            value={button.fill?.opacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={opacity => nested('fill', { opacity })}
          />
          <Toggle
            label={t('Show the background')}
            checked={!!button.background?.show}
            onChange={show => nested('background', { show })}
          />
          <Toggle
            label={t('Match the chart background')}
            checked={!!button.matchBackground}
            onChange={matchBackground =>
              set({ matchBackground }, 'match-background')
            }
          />
          <ColorField
            label={t('Background')}
            value={button.background?.color || theme.colorBgContainer}
            onChange={color => nested('background', { color })}
          />
          <RangeField
            label={t('Background opacity')}
            value={button.background?.opacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={opacity => nested('background', { opacity })}
          />

          <Toggle
            label={t('Show the border')}
            checked={!!button.border?.show}
            onChange={show => nested('border', { show })}
          />
          <ColorField
            label={t('Border color')}
            value={button.border?.color || theme.colorBorder}
            onChange={color => nested('border', { color })}
          />
          <RangeField
            label={t('Border width')}
            value={button.border?.width ?? 1}
            min={0}
            max={8}
            onChange={width => nested('border', { width })}
          />
          <RangeField
            label={t('Border opacity')}
            value={button.border?.opacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={opacity => nested('border', { opacity })}
          />

          <Toggle
            label={t('Show the glow')}
            checked={!!button.glow?.show}
            onChange={show => nested('glow', { show })}
          />
          {button.glow?.show && (
            <EffectFields
              effect={button.glow}
              onChange={patch => nested('glow', patch)}
            />
          )}
          <Toggle
            label={t('Show the shadow')}
            checked={!!button.shadow?.show}
            onChange={show => nested('shadow', { show })}
          />
          {button.shadow?.show && (
            <EffectFields
              effect={button.shadow}
              onChange={patch => nested('shadow', patch)}
            />
          )}
          <PaddingFields
            label={t('Padding')}
            value={button.padding}
            sides={button.paddingSides}
            onChange={({ padding, paddingSides }) =>
              set(
                padding !== undefined ? { padding } : { paddingSides },
                'padding',
              )
            }
          />
        </>
      )}
    </Section>
  );
}

/** How a chart behaves on the page. */
export function PropertiesSection({ id }: { id: string }) {
  const { own, format, update } = useFormat(id);
  return (
    <Section collapsedByDefault data-test="mibi-format-properties">
      <h4>{t('Properties')}</h4>
      <Toggle
        label={t('Lock aspect')}
        checked={!!format.lockAspect}
        testId="mibi-format-lock-aspect"
        onChange={lockAspect => update({ lockAspect }, 'lock-aspect')}
      />
      <Toggle
        label={t('Maintain layer order')}
        checked={!!format.keepLayerOrder}
        testId="mibi-format-keep-layer"
        onChange={keepLayerOrder => update({ keepLayerOrder }, 'keep-layer')}
      />
      <Toggle
        label={t('High density sampling')}
        checked={!!format.chart?.[SAMPLING_FORMAT_KEY]}
        testId="mibi-format-sampling"
        onChange={sampling =>
          update(
            { chart: { ...own.chart, [SAMPLING_FORMAT_KEY]: sampling } },
            'sampling',
          )
        }
      />
    </Section>
  );
}
