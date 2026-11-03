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
import { FONT_FAMILY_OPTIONS } from '@superset-ui/core';
import { Input, Select, Switch } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { elementKind } from 'src/mibi/elements/types';
import { useReportTokens } from 'src/mibi/report/ReportTheme';
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
import type { LineStyle, TitleAlign, VisualFormat } from './types';
import { useSharedVisualFormat } from './useVisualFormat';

export const HEADING_CHOICES = () => [
  { value: 0, label: t('Normal text') },
  ...[2, 3, 4, 5, 6].map(level => ({
    value: level,
    label: t('Heading %s', level),
  })),
];

const FONT_FAMILY_CHOICES = FONT_FAMILY_OPTIONS.map(([value, label]) => ({
  value,
  label,
}));

export function FontFamilyField({
  value,
  onChange,
  testId,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  testId?: string;
}) {
  return (
    <Field label={t('Font')} stacked>
      <span className="full-select" data-test={testId}>
        <Select
          ariaLabel={t('Font')}
          allowClear
          placeholder={t('Theme font')}
          value={value}
          options={FONT_FAMILY_CHOICES}
          onChange={next => onChange((next as string | null) ?? undefined)}
        />
      </span>
    </Field>
  );
}

/**
 * Title, subtitle, divider and the space under the header of a chart or a
 * design element. A chart shows its name by default; an element has no title
 * until one is turned on.
 */
export function TitleSections({ id }: { id: string }) {
  const look = useReportTokens();
  const dispatch = useDispatch();
  const item = useSelector(
    (state: RootState) => state.dashboardLayout.present[id],
  );
  // Design elements have no title until one is turned on; charts and text
  // boxes show theirs and take the style every chart shares
  const forChart = !elementKind(item?.meta?.componentKey);
  const own: VisualFormat = item?.meta?.mibiFormat ?? {};
  // Charts show the style every chart shares under their own
  const shared = useSharedVisualFormat();
  const format: VisualFormat =
    (forChart ? mergeVisualFormat(shared, own) : own) ?? {};
  const updateTitle = (patch: VisualFormat['title'], setting: string) =>
    dispatch(
      setVisualFormat(
        id,
        { ...own, title: { ...own.title, ...patch } },
        `visual:${id}:title-${setting}`,
      ),
    );
  const titleShown = forChart
    ? format.title?.show !== false
    : !!format.title?.show;

  return (
    <>
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
              value={format.title?.color || look.colorText}
              onChange={color => updateTitle({ color }, 'color')}
            />
            <ColorField
              label={t('Header fill')}
              value={format.title?.background || look.colorBgContainer}
              onChange={background => updateTitle({ background }, 'fill')}
            />
            <Input
              value={format.title?.template ?? ''}
              placeholder={
                forChart
                  ? t('Dynamic title, e.g. Employees: {value}')
                  : t('Title text')
              }
              maxLength={300}
              aria-label={forChart ? t('Dynamic title') : t('Title text')}
              onChange={event =>
                updateTitle(
                  { template: event.target.value || undefined },
                  'template',
                )
              }
            />
            {forChart && (
              <Hint>
                {t(
                  'Tokens: {value} the first number of the chart, {filters} the selections of the page, {filter:Name} one filter and {chart} the chart name.',
                )}
              </Hint>
            )}
            <Field label={t('Bold')}>
              <Switch
                size="small"
                checked={format.title?.bold ?? true}
                aria-label={t('Bold title')}
                onChange={bold => updateTitle({ bold }, 'bold')}
              />
            </Field>
            <Field label={t('Italic')}>
              <Switch
                size="small"
                checked={format.title?.italic ?? false}
                aria-label={t('Italic title')}
                onChange={italic => updateTitle({ italic }, 'italic')}
              />
            </Field>
            <Field label={t('Underline')}>
              <Switch
                size="small"
                checked={format.title?.underline ?? false}
                aria-label={t('Underline title')}
                data-test="mibi-format-title-underline"
                onChange={underline => updateTitle({ underline }, 'underline')}
              />
            </Field>
            <Field label={t('Wrap text')}>
              <Switch
                size="small"
                checked={format.title?.wrap ?? false}
                aria-label={t('Wrap text')}
                onChange={wrap => updateTitle({ wrap }, 'wrap')}
              />
            </Field>
            <Field label={t('Heading level')} stacked>
              <Select
                ariaLabel={t('Heading level')}
                value={format.title?.heading ?? 0}
                options={HEADING_CHOICES()}
                onChange={heading =>
                  updateTitle(
                    { heading: Number(heading) || undefined },
                    'heading',
                  )
                }
              />
            </Field>
            <FontFamilyField
              value={format.title?.fontFamily}
              testId="mibi-format-title-family"
              onChange={fontFamily => updateTitle({ fontFamily }, 'family')}
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
          </>
        )}
      </Section>

      {titleShown && (
        <Section>
          <h4>{t('Subtitle')}</h4>
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
                value={format.title?.subtitleColor || look.colorTextTertiary}
                onChange={subtitleColor =>
                  updateTitle({ subtitleColor }, 'subtitle-color')
                }
              />
              <Field label={t('Heading level')} stacked>
                <Select
                  ariaLabel={t('Subtitle heading level')}
                  value={format.title?.subtitleHeading ?? 0}
                  options={HEADING_CHOICES()}
                  onChange={subtitleHeading =>
                    updateTitle(
                      { subtitleHeading: Number(subtitleHeading) || undefined },
                      'subtitle-heading',
                    )
                  }
                />
              </Field>
              <Field label={t('Wrap text')}>
                <Switch
                  size="small"
                  checked={format.title?.subtitleWrap ?? false}
                  aria-label={t('Wrap the subtitle')}
                  onChange={subtitleWrap =>
                    updateTitle({ subtitleWrap }, 'subtitle-wrap')
                  }
                />
              </Field>
              <FontFamilyField
                value={format.title?.subtitleFamily}
                onChange={subtitleFamily =>
                  updateTitle({ subtitleFamily }, 'subtitle-family')
                }
              />
              <Field label={t('Bold')}>
                <Switch
                  size="small"
                  checked={format.title?.subtitleBold ?? false}
                  aria-label={t('Bold subtitle')}
                  onChange={subtitleBold =>
                    updateTitle({ subtitleBold }, 'subtitle-bold')
                  }
                />
              </Field>
              <Field label={t('Italic')}>
                <Switch
                  size="small"
                  checked={format.title?.subtitleItalic ?? false}
                  aria-label={t('Italic subtitle')}
                  onChange={subtitleItalic =>
                    updateTitle({ subtitleItalic }, 'subtitle-italic')
                  }
                />
              </Field>
              <Field label={t('Underline')}>
                <Switch
                  size="small"
                  checked={format.title?.subtitleUnderline ?? false}
                  aria-label={t('Underline subtitle')}
                  onChange={subtitleUnderline =>
                    updateTitle({ subtitleUnderline }, 'subtitle-underline')
                  }
                />
              </Field>
              <Field label={t('Alignment')}>
                <Segments<TitleAlign>
                  name={t('Subtitle alignment')}
                  value={
                    format.title?.subtitleAlign ?? format.title?.align ?? 'left'
                  }
                  onChange={subtitleAlign =>
                    updateTitle({ subtitleAlign }, 'subtitle-align')
                  }
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
            </>
          )}
        </Section>
      )}

      <Section>
        <h4>{t('Divider and spacing')}</h4>
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
          <>
            <ColorField
              label={t('Line color')}
              value={format.title?.dividerColor || look.colorBorderSecondary}
              onChange={dividerColor =>
                updateTitle({ dividerColor }, 'divider-color')
              }
            />
            <RangeField
              label={t('Line width')}
              value={format.title?.dividerWidth ?? 1}
              min={1}
              max={8}
              onChange={dividerWidth =>
                updateTitle({ dividerWidth }, 'divider-width')
              }
            />
            <Field label={t('Reach the edges of the card')}>
              <Switch
                size="small"
                checked={format.title?.dividerBleed ?? false}
                aria-label={t('Reach the edges of the card')}
                onChange={dividerBleed =>
                  updateTitle({ dividerBleed }, 'divider-bleed')
                }
              />
            </Field>
            <Segments<LineStyle>
              name={t('Line style')}
              value={format.title?.dividerStyle ?? 'solid'}
              onChange={dividerStyle =>
                updateTitle({ dividerStyle }, 'divider-style')
              }
              options={[
                { value: 'solid', label: t('Solid') },
                { value: 'dashed', label: t('Dashed') },
                { value: 'dotted', label: t('Dotted') },
              ]}
            />
          </>
        )}
        <RangeField
          label={t('Space under the header')}
          value={format.title?.gap ?? 8}
          min={0}
          max={40}
          onChange={gap => updateTitle({ gap }, 'gap')}
          testId="mibi-format-header-gap"
        />
      </Section>
    </>
  );
}
