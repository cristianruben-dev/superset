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
import { useContext, useMemo, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import {
  FONT_FAMILY_OPTIONS,
  NativeFilterType,
  type Filter,
} from '@superset-ui/core';
import { Input, Select, Switch } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { setComponentMeta } from 'src/mibi/format/actions';
import { BoxSections } from 'src/mibi/format/BoxSections';
import {
  ColorField,
  Field,
  FormatSearchContext,
  Hint,
  RangeField,
  Section,
  Segments,
} from 'src/mibi/format/controls';
import { TitleSections } from 'src/mibi/format/TitleSections';
import { SyncSlicers } from 'src/mibi/report/SyncSlicers';
import type {
  FilterElement,
  SlicerSelection,
  SlicerVariant,
  ValueUnits,
} from './types';

type Update = (patch: Partial<FilterElement>, setting: string) => void;
type Level = 'visual' | 'general';

/** The level stays while going through slicers, as it does for charts. */
let shownLevel: Level = 'visual';

const FONT_CHOICES = FONT_FAMILY_OPTIONS.map(([value, label]) => ({
  value,
  label,
}));

/** Small builders of the fields of a slicer setting, bound to its config. */
function useFields(config: FilterElement, update: Update) {
  const toggle = (
    key: keyof FilterElement,
    label: string,
    fallback = false,
  ) => (
    <Field label={label}>
      <Switch
        size="small"
        checked={(config[key] as boolean | undefined) ?? fallback}
        aria-label={label}
        data-test={`mibi-slicer-${String(key)}`}
        onChange={value => update({ [key]: value }, `filter-${String(key)}`)}
      />
    </Field>
  );
  const color = (key: keyof FilterElement, label: string, fallback: string) => (
    <ColorField
      label={label}
      value={(config[key] as string | undefined) || fallback}
      onChange={value => update({ [key]: value }, `filter-${String(key)}`)}
    />
  );
  const range = (
    key: keyof FilterElement,
    label: string,
    fallback: number,
    min: number,
    max: number,
  ) => (
    <RangeField
      label={label}
      value={(config[key] as number | undefined) ?? fallback}
      min={min}
      max={max}
      onChange={value => update({ [key]: value }, `filter-${String(key)}`)}
    />
  );
  const font = (key: keyof FilterElement, label: string) => (
    <Field label={t('Font')} stacked>
      <Select
        ariaLabel={label}
        allowClear
        placeholder={t('Theme font')}
        value={config[key] as string | undefined}
        options={FONT_CHOICES}
        onChange={value =>
          update(
            { [key]: (value as string | null) ?? undefined },
            `filter-${String(key)}`,
          )
        }
      />
    </Field>
  );
  const align = (key: keyof FilterElement, label: string) => (
    <Field label={t('Alignment')} stacked>
      <Segments<'left' | 'center' | 'right'>
        name={label}
        value={
          (config[key] as 'left' | 'center' | 'right' | undefined) ?? 'left'
        }
        onChange={value => update({ [key]: value }, `filter-${String(key)}`)}
        options={[
          { value: 'left', label: t('Left') },
          { value: 'center', label: t('Center') },
          { value: 'right', label: t('Right') },
        ]}
      />
    </Field>
  );
  return { toggle, color, range, font, align };
}

/** What kind of control a filter is, as far as a slicer is concerned. */
const kindOf = (filter: Filter | undefined) => {
  switch (filter?.filterType) {
    case 'filter_select':
      return 'list';
    case 'filter_range':
      return 'range';
    case 'filter_time':
      return 'date';
    default:
      return 'other';
  }
};

/** The type of the slicer and how choosing in it works. */
function SettingsSection({
  config,
  update,
  kind,
  multiSelect,
}: {
  config: FilterElement;
  update: Update;
  kind: ReturnType<typeof kindOf>;
  /** Whether the filter itself takes more than one value */
  multiSelect: boolean;
}) {
  const { toggle, range } = useFields(config, update);
  const variant = config.variant ?? 'dropdown';
  const drawn = kind === 'list' && variant !== 'dropdown';
  const fromList = drawn && variant !== 'input';
  return (
    <Section data-test="mibi-slicer-settings">
      <h4>{t('Slicer settings')}</h4>
      {kind === 'list' && (
        <Segments<SlicerVariant>
          name={t('Slicer type')}
          testId="mibi-slicer-variant"
          value={variant}
          onChange={next => update({ variant: next }, 'filter-variant')}
          options={[
            { value: 'dropdown', label: t('Dropdown') },
            { value: 'list', label: t('List') },
            { value: 'buttons', label: t('Buttons') },
            { value: 'input', label: t('Text') },
          ]}
        />
      )}
      {kind === 'range' && (
        <Field label={t('Style')} stacked>
          <Segments<'control' | 'between' | 'slider'>
            name={t('Range style')}
            testId="mibi-slicer-range-style"
            value={config.rangeStyle ?? 'control'}
            onChange={next =>
              update(
                { rangeStyle: next === 'control' ? undefined : next },
                'filter-range-style',
              )
            }
            options={[
              { value: 'control', label: t('Filter control') },
              { value: 'between', label: t('Between') },
              { value: 'slider', label: t('Slider') },
            ]}
          />
        </Field>
      )}
      {kind === 'date' && (
        <Field label={t('Style')} stacked>
          <Segments<'control' | 'relative' | 'between'>
            name={t('Date style')}
            testId="mibi-slicer-date-style"
            value={config.dateStyle ?? 'control'}
            onChange={next =>
              update(
                { dateStyle: next === 'control' ? undefined : next },
                'filter-date-style',
              )
            }
            options={[
              { value: 'control', label: t('Filter control') },
              { value: 'relative', label: t('Relative date') },
              { value: 'between', label: t('Between dates') },
            ]}
          />
        </Field>
      )}
      {kind === 'other' && (
        <Hint>
          {t('This filter keeps its own control. Its box can still be styled.')}
        </Hint>
      )}
      {fromList && (
        <>
          <Field label={t('Layout')} stacked>
            <Segments<NonNullable<FilterElement['layout']>>
              name={t('Layout')}
              value={config.layout ?? 'vertical'}
              onChange={layout => update({ layout }, 'filter-layout')}
              options={[
                { value: 'vertical', label: t('Vertical') },
                { value: 'horizontal', label: t('Horizontal') },
                { value: 'grid', label: t('Grid') },
              ]}
            />
          </Field>
          {config.layout === 'grid' && range('columns', t('Columns'), 2, 1, 8)}
          {multiSelect ? (
            <>
              <Field label={t('Selection')} stacked>
                <Segments<SlicerSelection | 'filter'>
                  name={t('Selection')}
                  testId="mibi-slicer-selection"
                  value={config.selection ?? 'filter'}
                  onChange={next =>
                    update(
                      { selection: next === 'filter' ? undefined : next },
                      'filter-selection',
                    )
                  }
                  options={[
                    { value: 'filter', label: t('As the filter') },
                    { value: 'multi', label: t('Multiple') },
                    { value: 'single', label: t('Single') },
                    { value: 'ctrl', label: t('With Ctrl') },
                  ]}
                />
              </Field>
              {config.selection === 'ctrl' && (
                <Hint>
                  {t(
                    'A click picks one value; Ctrl or Cmd and a click adds more.',
                  )}
                </Hint>
              )}
            </>
          ) : (
            <Hint>
              {t(
                'The filter takes one value. Allow several in its settings to choose more here.',
              )}
            </Hint>
          )}
          {multiSelect &&
            config.selection !== 'single' &&
            toggle('showSelectAll', t('Show «Select all»'))}
          {toggle('showSearch', t('Show the search box'))}
          <Field label={t('Order of the values')} stacked>
            <Segments<'query' | 'asc' | 'desc'>
              name={t('Order of the values')}
              testId="mibi-slicer-sort"
              value={config.sortValues ?? 'query'}
              onChange={next =>
                update(
                  { sortValues: next === 'query' ? undefined : next },
                  'filter-sort',
                )
              }
              options={[
                { value: 'query', label: t('As they come') },
                { value: 'asc', label: t('Ascending') },
                { value: 'desc', label: t('Descending') },
              ]}
            />
          </Field>
          {toggle('applyButton', t('Apply button'))}
          {toggle('showPills', t('Show the chosen values'))}
        </>
      )}
      {drawn && variant === 'input' && (
        <Field label={t('Match')} stacked>
          <Segments<NonNullable<FilterElement['inputMatch']>>
            name={t('Match')}
            testId="mibi-slicer-match"
            value={config.inputMatch ?? 'contains'}
            onChange={inputMatch => update({ inputMatch }, 'filter-match')}
            options={[
              { value: 'contains', label: t('Contains the text') },
              { value: 'exact', label: t('Whole values') },
            ]}
          />
        </Field>
      )}
    </Section>
  );
}

/** The name of the filter above the slicer, Power BI's "Slicer header". */
function HeaderSection({
  config,
  update,
  drawn,
}: {
  config: FilterElement;
  update: Update;
  drawn: boolean;
}) {
  const theme = useTheme();
  const { toggle, color, range, font, align } = useFields(config, update);
  return (
    <Section
      headExtra={
        <Switch
          size="small"
          checked={!config.hideLabel}
          aria-label={t('Show the slicer header')}
          data-test="mibi-slicer-header-show"
          onChange={show => update({ hideLabel: !show }, 'filter-label')}
        />
      }
    >
      <h4>{t('Slicer header')}</h4>
      {!config.hideLabel && (
        <>
          {font('labelFamily', t('Header font'))}
          {range('labelSize', t('Size'), 13, 8, 28)}
          {color('labelColor', t('Text color'), theme.colorText)}
          {toggle('labelBold', t('Bold'))}
          {toggle('labelItalic', t('Italic'))}
          {toggle('labelUnderline', t('Underline'))}
          {align('labelAlign', t('Header alignment'))}
          {color('labelFill', t('Background'), theme.colorBgContainer)}
          {toggle('labelDivider', t('Line under the header'))}
          {drawn && toggle('showSummary', t('Show how many are chosen'))}
        </>
      )}
    </Section>
  );
}

/** The values of a list or of buttons, and their states. */
function ValuesSection({
  config,
  update,
}: {
  config: FilterElement;
  update: Update;
}) {
  const theme = useTheme();
  const { toggle, color, range, font, align } = useFields(config, update);
  const buttons = config.variant === 'buttons';
  return (
    <>
      <Section>
        <h4>{t('Values')}</h4>
        {font('itemFamily', t('Values font'))}
        {range('itemSize', t('Size'), 13, 8, 40)}
        {toggle('itemBold', t('Bold'))}
        {toggle('itemItalic', t('Italic'))}
        {toggle('itemUnderline', t('Underline'))}
        {toggle('itemWrap', t('Wrap the text'))}
        {align('itemAlign', t('Values alignment'))}
        <Field label={t('Vertical alignment')} stacked>
          <Segments<NonNullable<FilterElement['itemVAlign']>>
            name={t('Vertical alignment')}
            value={config.itemVAlign ?? 'middle'}
            onChange={itemVAlign => update({ itemVAlign }, 'filter-valign')}
            options={[
              { value: 'top', label: t('Top') },
              { value: 'middle', label: t('Middle') },
              { value: 'bottom', label: t('Bottom') },
            ]}
          />
        </Field>
        {color('itemColor', t('Text color'), theme.colorText)}
        {color('itemFill', t('Background'), theme.colorBgContainer)}
        {color('itemBorder', t('Border color'), theme.colorBorder)}
        {range('itemBorderWidth', t('Border width'), buttons ? 1 : 0, 0, 8)}
        {range('itemRadius', t('Corner radius'), 6, 0, 40)}
        {range('itemPadding', t('Padding'), 4, 0, 24)}
        {range('itemGap', t('Space between values'), 4, 0, 24)}
        <h5>{t('Numbers and blanks')}</h5>
        <Field label={t('Display units')} stacked>
          <Select
            ariaLabel={t('Display units')}
            allowClear
            placeholder={t('None')}
            value={config.valueUnits}
            options={[
              { value: 'auto', label: t('Automatic') },
              { value: 'none', label: t('None') },
              { value: 'thousands', label: t('Thousands') },
              { value: 'millions', label: t('Millions') },
              { value: 'billions', label: t('Billions') },
              { value: 'trillions', label: t('Trillions') },
            ]}
            onChange={value =>
              update(
                { valueUnits: (value as ValueUnits | null) ?? undefined },
                'filter-units',
              )
            }
          />
        </Field>
        {range('valueDecimals', t('Decimal places'), 2, 0, 9)}
        <Field label={t('Show blank as')} stacked>
          <Input
            aria-label={t('Show blank as')}
            placeholder={t('(Blank)')}
            value={config.blankText ?? ''}
            onChange={event =>
              update(
                { blankText: event.target.value || undefined },
                'filter-blank',
              )
            }
          />
        </Field>
      </Section>
      <Section collapsedByDefault>
        <h4>{t('Value states')}</h4>
        <h5>{t('When the pointer is over it')}</h5>
        {color('hoverFill', t('Background'), theme.colorFillTertiary)}
        {color('hoverColor', t('Text color'), theme.colorText)}
        <h5>{t('When it is selected')}</h5>
        {color('selectedFill', t('Background'), theme.colorPrimary)}
        {color('selectedColor', t('Text color'), theme.colorTextLightSolid)}
        {color('selectedBorder', t('Border color'), theme.colorPrimary)}
        {range('selectedBorderWidth', t('Border width'), buttons ? 1 : 0, 0, 8)}
        {range('selectedRadius', t('Corner radius'), 6, 0, 40)}
        {range('selectedPadding', t('Padding'), 4, 0, 24)}
        {toggle('selectedBold', t('Bold'))}
        {toggle('selectedItalic', t('Italic'))}
        {toggle('selectedUnderline', t('Underline'))}
      </Section>
    </>
  );
}

/** The box of the search, of a text slicer and of the fields of a range. */
function SearchBoxSection({
  config,
  update,
  title,
  placeholder,
}: {
  config: FilterElement;
  update: Update;
  title: string;
  placeholder: boolean;
}) {
  const theme = useTheme();
  const { color, range, font } = useFields(config, update);
  return (
    <Section collapsedByDefault>
      <h4>{title}</h4>
      {placeholder && (
        <Field label={t('Placeholder text')} stacked>
          <Input
            aria-label={t('Placeholder text')}
            value={config.searchPlaceholder ?? ''}
            onChange={event =>
              update(
                { searchPlaceholder: event.target.value },
                'filter-placeholder',
              )
            }
          />
        </Field>
      )}
      {font('searchFamily', t('Search font'))}
      {range('searchSize', t('Size'), 13, 8, 28)}
      {color('searchColor', t('Text color'), theme.colorText)}
      {color('searchFill', t('Background'), theme.colorBgContainer)}
      {color('searchBorder', t('Border color'), theme.colorBorder)}
      {range('searchRadius', t('Corner radius'), 6, 0, 24)}
      {range('searchPadding', t('Padding'), 4, 0, 16)}
    </Section>
  );
}

/** The closed box and the open list of a dropdown slicer. */
function DropdownSection({
  config,
  update,
  menu,
}: {
  config: FilterElement;
  update: Update;
  menu: boolean;
}) {
  const theme = useTheme();
  const { color, range, toggle } = useFields(config, update);
  return (
    <Section collapsedByDefault>
      <h4>{menu ? t('Dropdown') : t('Control box')}</h4>
      {color('boxFill', t('Background'), theme.colorBgContainer)}
      {color('boxBorder', t('Border color'), theme.colorBorder)}
      {color('textColor', t('Text color'), theme.colorText)}
      {range('boxRadius', t('Corner radius'), 6, 0, 20)}
      {menu && (
        <>
          <h5>{t('Open list')}</h5>
          {color('menuFill', t('Background'), theme.colorBgElevated)}
          {color('menuColor', t('Text color'), theme.colorText)}
          {color('menuSelected', t('Selected value'), theme.colorPrimaryBg)}
          {range('menuRadius', t('Corner radius'), 8, 0, 24)}
          {range('menuMaxHeight', t('Maximum height'), 256, 120, 600)}
          {color('menuBorder', t('Border color'), theme.colorBorderSecondary)}
          {toggle('menuShadow', t('Shadow'), true)}
        </>
      )}
    </Section>
  );
}

/** Settings of a canvas filter on the Visual level of the pane. */
function VisualLevel({
  id,
  config,
  update,
}: {
  id: string;
  config: FilterElement;
  update: Update;
}) {
  const theme = useTheme();
  const filters = useFilters();
  const { color, range } = useFields(config, update);
  const options = useMemo(
    () =>
      Object.values(filters)
        .filter(
          (item): item is Filter => item.type === NativeFilterType.NativeFilter,
        )
        .map(filter => ({ value: filter.id, label: filter.name })),
    [filters],
  );
  const chosen = config.filterId
    ? (filters[config.filterId] as Filter | undefined)
    : undefined;
  const kind = kindOf(chosen);
  const variant = config.variant ?? 'dropdown';
  const drawn = kind === 'list' && variant !== 'dropdown';
  const fromList = drawn && variant !== 'input';
  const ownFields =
    (kind === 'range' && !!config.rangeStyle) ||
    (kind === 'date' && !!config.dateStyle);

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
      <SettingsSection
        config={config}
        update={update}
        kind={kind}
        multiSelect={
          (chosen?.controlValues as { multiSelect?: boolean } | undefined)
            ?.multiSelect !== false
        }
      />
      <HeaderSection config={config} update={update} drawn={drawn} />
      {fromList && <ValuesSection config={config} update={update} />}
      {fromList && variant === 'list' && (
        <Section
          collapsedByDefault
          headExtra={
            <Switch
              size="small"
              checked={config.showIcon !== false}
              aria-label={t('Show the selection mark')}
              onChange={showIcon => update({ showIcon }, 'filter-showIcon')}
            />
          }
        >
          <h4>{t('Selection mark')}</h4>
          {config.showIcon !== false && (
            <>
              {color('iconColor', t('Color'), theme.colorPrimary)}
              {range('iconSize', t('Size'), 14, 8, 32)}
              {range('iconGap', t('Space to the text'), 6, 0, 24)}
              <Field label={t('Position')} stacked>
                <Segments<'left' | 'right'>
                  name={t('Selection mark position')}
                  value={config.iconPosition ?? 'left'}
                  onChange={iconPosition =>
                    update({ iconPosition }, 'filter-icon-position')
                  }
                  options={[
                    { value: 'left', label: t('Left') },
                    { value: 'right', label: t('Right') },
                  ]}
                />
              </Field>
            </>
          )}
        </Section>
      )}
      {((fromList && config.showSearch) || variant === 'input') && drawn && (
        <SearchBoxSection
          config={config}
          update={update}
          title={variant === 'input' ? t('Text box') : t('Search box')}
          placeholder
        />
      )}
      {ownFields && (
        <SearchBoxSection
          config={config}
          update={update}
          title={t('Input boxes')}
          placeholder={false}
        />
      )}
      {fromList && config.showPills && (
        <Section collapsedByDefault>
          <h4>{t('Chosen values')}</h4>
          {color('pillFill', t('Background'), theme.colorFillSecondary)}
          {color('pillColor', t('Text color'), theme.colorText)}
          {range('pillRadius', t('Corner radius'), 12, 0, 24)}
        </Section>
      )}
      {fromList && config.applyButton && (
        <Section collapsedByDefault>
          <h4>{t('Apply button')}</h4>
          {color('applyFill', t('Background'), theme.colorPrimary)}
          {color('applyColor', t('Text color'), theme.colorTextLightSolid)}
        </Section>
      )}
      {!drawn && !ownFields && (
        <DropdownSection
          config={config}
          update={update}
          menu={kind === 'list'}
        />
      )}
      {kind === 'range' && config.rangeStyle && (
        <Section collapsedByDefault>
          <h4>{t('Numbers')}</h4>
          {range('valueDecimals', t('Decimal places'), 2, 0, 9)}
          {color('selectedFill', t('Slider color'), theme.colorPrimary)}
        </Section>
      )}
      <SyncSlicers elementId={id} filterId={config.filterId} />
    </>
  );
}

/** Title, box and accessibility of a canvas filter, on the General level. */
function GeneralLevel({ id }: { id: string }) {
  const dispatch = useDispatch();
  const altText = useSelector(
    (state: RootState) =>
      state.dashboardLayout.present[id]?.meta?.mibiAltText as
        | string
        | undefined,
  );
  return (
    <>
      <TitleSections id={id} />
      <BoxSections id={id} />
      <Section collapsedByDefault>
        <h4>{t('Alt text')}</h4>
        <Input.TextArea
          rows={2}
          value={altText ?? ''}
          placeholder={t('Describes the slicer for screen readers')}
          aria-label={t('Alt text')}
          data-test="mibi-slicer-alt-text"
          onChange={event =>
            dispatch(
              setComponentMeta(
                id,
                'mibiAltText',
                event.target.value || undefined,
                `visual:${id}:alt-text`,
              ),
            )
          }
        />
      </Section>
    </>
  );
}

/** Format pane settings of a canvas filter, on a Visual and a General level. */
export function FilterSection({
  id,
  config,
  update,
}: {
  id: string;
  config: FilterElement;
  update: Update;
}) {
  const [chosenLevel, setChosenLevel] = useState(shownLevel);
  const searching = !!useContext(FormatSearchContext).trim();
  const setLevel = (next: Level) => {
    shownLevel = next;
    setChosenLevel(next);
  };
  const level: Level | 'both' = searching ? 'both' : chosenLevel;
  let content: ReactNode;
  if (level === 'both') {
    content = (
      <>
        <VisualLevel id={id} config={config} update={update} />
        <GeneralLevel id={id} />
      </>
    );
  } else if (level === 'general') {
    content = <GeneralLevel id={id} />;
  } else {
    content = <VisualLevel id={id} config={config} update={update} />;
  }
  return (
    <>
      <div className="format-level">
        <Segments<Level>
          name={t('Format level')}
          value={chosenLevel}
          testId="mibi-format-level"
          onChange={setLevel}
          options={[
            { value: 'visual', label: t('Visual') },
            { value: 'general', label: t('General') },
          ]}
        />
      </div>
      {content}
    </>
  );
}
