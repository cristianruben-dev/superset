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
import { useTheme } from '@apache-superset/core/theme';
import { Switch } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { setVisualFormat } from './actions';
import { mergeVisualFormat } from './styles';
import { useSharedVisualFormat } from './useVisualFormat';
import { ColorField, Field, RangeField, Section, Segments } from './controls';
import { DEFAULT_RADIUS, type ShadowLevel, type VisualFormat } from './types';

/** Background, border, corners, shadow and padding of a chart or element box. */
export function BoxSections({ id }: { id: string }) {
  const theme = useTheme();
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

  return (
    <>
      <Section data-test="mibi-format-visual-background">
        <h4>{t('Background')}</h4>
        <Field label={t('Transparent')}>
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
          value={format.borderWidth ?? 1}
          min={0}
          max={8}
          onChange={borderWidth => update({ borderWidth }, 'border-width')}
          testId="mibi-format-border-width"
        />
        <RangeField
          label={t('Rounded corners')}
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
          ]}
        />
        <RangeField
          label={t('Inner padding')}
          value={format.padding ?? 16}
          min={0}
          max={40}
          onChange={padding => update({ padding }, 'padding')}
        />
      </Section>
    </>
  );
}
