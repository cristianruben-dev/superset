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
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { useReportTokens } from 'src/mibi/report/ReportTheme';
import { Switch } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { setVisualFormat } from './actions';
import { BASE_VISUAL_PADDING, mergeVisualFormat } from './styles';
import { useSharedVisualFormat } from './useVisualFormat';
import { ColorField, Field, RangeField, Section, Segments } from './controls';
import {
  DEFAULT_RADIUS,
  type ShadowDetail,
  type ShadowLevel,
  type VisualFormat,
} from './types';

/** Background, border, corners, shadow and padding of a chart or element box. */
export function BoxSections({ id }: { id: string }) {
  const theme = useReportTokens();
  const dispatch = useDispatch();
  const item = useSelector(
    (state: RootState) => state.dashboardLayout.present[id],
  );
  const own: VisualFormat = item?.meta?.mibiFormat ?? {};
  // Charts show the style every chart shares under their own
  const shared = useSharedVisualFormat();
  const format: VisualFormat =
    (item?.type === CHART_TYPE ? mergeVisualFormat(shared, own) : own) ?? {};
  const update = (patch: Partial<VisualFormat>, setting: string) =>
    dispatch(
      setVisualFormat(id, { ...own, ...patch }, `visual:${id}:${setting}`),
    );
  const transparent = format.background === 'transparent';
  const shadow = format.shadowDetail ?? {};
  const updateShadow = (patch: ShadowDetail, setting: string) =>
    update({ shadowDetail: { ...shadow, ...patch } }, `shadow-${setting}`);
  const allPadding = format.padding ?? BASE_VISUAL_PADDING;

  return (
    <>
      <Section data-test="mibi-format-visual-background">
        <h4>{t('Background')}</h4>
        <Field
          label={t('Transparent')}
          help={{
            kind: 'cardBackground',
            text: t(
              'Removes the chart background so it sits directly on the page.',
            ),
          }}
        >
          <Switch
            size="small"
            checked={transparent}
            aria-label={t('Transparent')}
            onChange={checked =>
              update(
                {
                  background: checked ? 'transparent' : theme.colorBgContainer,
                },
                'background',
              )
            }
          />
        </Field>
        <ColorField
          label={t('Color')}
          value={
            transparent
              ? theme.colorBgContainer
              : format.background || theme.colorBgContainer
          }
          disabled={transparent}
          onChange={background => update({ background }, 'background')}
          testId="mibi-format-visual-color"
        />
        {!transparent && (
          <RangeField
            label={t('Opacity')}
            help={{
              kind: 'opacity',
              text: t(
                'Makes the chart background see-through so the page shows behind it.',
              ),
            }}
            value={format.backgroundOpacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={backgroundOpacity =>
              update(
                {
                  backgroundOpacity,
                  background: format.background ?? theme.colorBgContainer,
                },
                'opacity',
              )
            }
          />
        )}
      </Section>

      <Section>
        <h4>{t('Border')}</h4>
        <ColorField
          label={t('Color')}
          value={format.borderColor || theme.colorBorderSecondary}
          onChange={borderColor => update({ borderColor }, 'border-color')}
        />
        <RangeField
          label={t('Width')}
          help={{
            kind: 'cardBorder',
            text: t('Thickness of the outline drawn around the chart.'),
          }}
          value={format.borderWidth ?? 1}
          min={0}
          max={8}
          onChange={borderWidth => update({ borderWidth }, 'border-width')}
          testId="mibi-format-border-width"
        />
        <RangeField
          label={t('Opacity')}
          value={format.borderOpacity ?? 100}
          min={0}
          max={100}
          unit="%"
          onChange={borderOpacity =>
            update({ borderOpacity }, 'border-opacity')
          }
          testId="mibi-format-border-opacity"
        />
        <RangeField
          label={t('Rounded corners')}
          help={{
            kind: 'cardRadius',
            text: t('How round the corners of the chart are.'),
          }}
          value={format.radius ?? DEFAULT_RADIUS}
          min={0}
          max={32}
          onChange={radius => update({ radius }, 'radius')}
          testId="mibi-format-radius"
        />
      </Section>

      <Section>
        <h4>{t('Shadow and spacing')}</h4>
        <Segments<ShadowLevel>
          name={t('Shadow')}
          value={format.shadow ?? 'soft'}
          onChange={shadow => update({ shadow }, 'shadow')}
          testId="mibi-format-shadow"
          options={[
            { value: 'none', label: t('None') },
            { value: 'soft', label: t('Soft') },
            { value: 'strong', label: t('Strong') },
            { value: 'custom', label: t('Custom') },
          ]}
        />
        {format.shadow === 'custom' && (
          <>
            <ColorField
              label={t('Color')}
              value={shadow.color ?? '#000000'}
              onChange={color => updateShadow({ color }, 'color')}
              testId="mibi-format-shadow-color"
            />
            <RangeField
              label={t('Opacity')}
              value={shadow.opacity ?? 25}
              min={0}
              max={100}
              unit="%"
              onChange={opacity => updateShadow({ opacity }, 'opacity')}
            />
            <RangeField
              label={t('Angle')}
              value={shadow.angle ?? 90}
              min={0}
              max={360}
              unit="°"
              onChange={angle => updateShadow({ angle }, 'angle')}
            />
            <RangeField
              label={t('Distance')}
              value={shadow.distance ?? 4}
              min={0}
              max={40}
              onChange={distance => updateShadow({ distance }, 'distance')}
            />
            <RangeField
              label={t('Blur')}
              value={shadow.blur ?? 12}
              min={0}
              max={60}
              onChange={blur => updateShadow({ blur }, 'blur')}
            />
            <RangeField
              label={t('Spread')}
              value={shadow.spread ?? 0}
              min={0}
              max={30}
              onChange={spread => updateShadow({ spread }, 'spread')}
            />
            <Field label={t('Inside the box')}>
              <Switch
                size="small"
                checked={!!shadow.inset}
                aria-label={t('Inside the box')}
                onChange={inset => updateShadow({ inset }, 'inset')}
              />
            </Field>
          </>
        )}
        <Field label={t('Padding by side')}>
          <Switch
            size="small"
            checked={!!format.paddingSides}
            aria-label={t('Padding by side')}
            data-test="mibi-format-padding-sides"
            onChange={bySide =>
              update(
                {
                  paddingSides: bySide
                    ? {
                        top: allPadding,
                        right: allPadding,
                        bottom: allPadding,
                        left: allPadding,
                      }
                    : undefined,
                },
                'padding-sides',
              )
            }
          />
        </Field>
        {format.paddingSides ? (
          (
            [
              ['top', t('Top')],
              ['right', t('Right')],
              ['bottom', t('Bottom')],
              ['left', t('Left')],
            ] as const
          ).map(([side, label]) => (
            <RangeField
              key={side}
              label={label}
              value={format.paddingSides?.[side] ?? allPadding}
              min={0}
              max={40}
              onChange={value =>
                update(
                  { paddingSides: { ...format.paddingSides, [side]: value } },
                  `padding-${side}`,
                )
              }
            />
          ))
        ) : (
          <RangeField
            label={t('Inner padding')}
            help={{
              kind: 'cardPadding',
              text: t('Space between the edge of the chart and its content.'),
            }}
            value={allPadding}
            min={0}
            max={40}
            onChange={padding => update({ padding }, 'padding')}
          />
        )}
      </Section>
    </>
  );
}
