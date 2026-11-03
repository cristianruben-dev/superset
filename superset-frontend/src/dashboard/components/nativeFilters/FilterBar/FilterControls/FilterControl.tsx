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
import { memo, useCallback, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css } from '@apache-superset/core/theme';
import { Button, Icons } from '@superset-ui/core/components';
import {
  createHtmlPortalNode,
  InPortal,
  OutPortal,
} from 'react-reverse-portal';
import { FilterBarOrientation } from 'src/dashboard/types';
import { isChartCustomization, isDefined } from '@superset-ui/core';
import { checkIsMissingRequiredValue } from '../utils';
import FilterValue from './FilterValue';
import { FilterControlProps } from './types';
import { useIsFilterInScope } from '../../state';
import {
  FilterStyledIcon,
  RequiredFieldIndicator,
  DescriptionToolTip,
  useFilterControlDisplay,
} from './FilterControlShared';
import FilterEditButton from './FilterEditButton';
import GroupByFilterCard from './GroupByFilterCard';
import { FilterCard } from 'src/mibi/dashboard/FilterCard';
import { filterSummary } from 'src/mibi/dashboard/filterSummary';

const FilterControl = ({
  dataMaskSelected,
  filter,
  icon,
  onFilterSelectionChange,
  inView,
  showOverflow,
  parentRef,
  orientation = FilterBarOrientation.Vertical,
  overflow = false,
  clearAllTrigger,
  onClearAllComplete,
}: FilterControlProps) => {
  const portalNode = useMemo(() => createHtmlPortalNode(), []);
  const [clearing, setClearing] = useState(false);

  const { name = '<undefined>' } = filter;

  const isFilterInScope = useIsFilterInScope();
  const isMissingRequiredValue =
    isFilterInScope(filter) &&
    checkIsMissingRequiredValue(filter, filter.dataMask?.filterState);
  const validateStatus = isMissingRequiredValue ? 'error' : undefined;
  const isRequired = !!filter.controlValues?.enableEmptyFilter;
  const inverseSelection = !!filter.controlValues?.inverseSelection;

  const {
    FilterControlContainer,
    FormItem,
    FilterControlTitleBox,
    FilterControlTitle,
  } = useFilterControlDisplay(orientation, overflow, inverseSelection);

  const value = filter.dataMask?.filterState?.value;
  const hasValue =
    isDefined(value) &&
    !(Array.isArray(value) && value.every(item => item === null));
  const clearFilter = useCallback(() => {
    const cleared =
      filter.filterType === 'filter_range' ? [null, null] : undefined;
    onFilterSelectionChange(filter, {
      filterState: { value: cleared },
      extraFormData: {},
    });
    setClearing(true);
  }, [filter, onFilterSelectionChange]);

  const label = useMemo(
    () => (
      <FilterControlTitleBox>
        <FilterControlTitle
          id={`filter-name-${filter.id}`}
          data-test="filter-control-name"
        >
          {name}
        </FilterControlTitle>
        {isRequired && <RequiredFieldIndicator />}
        {filter.description?.trim() && (
          <DescriptionToolTip description={filter.description} />
        )}
        <FilterEditButton filterId={filter.id} name={name} />
        <FilterStyledIcon data-test="filter-icon">{icon}</FilterStyledIcon>
        {hasValue && orientation === FilterBarOrientation.Vertical && (
          <Button
            buttonStyle="link"
            buttonSize="xsmall"
            aria-label={t('Clear %s', name)}
            data-test="filter-control-clear"
            onClick={clearFilter}
            css={css`
              margin-left: auto;
            `}
          >
            <Icons.CloseOutlined iconSize="s" />
          </Button>
        )}
      </FilterControlTitleBox>
    ),
    [
      hasValue,
      orientation,
      clearFilter,
      FilterControlTitleBox,
      FilterControlTitle,
      name,
      isRequired,
      filter.description,
      filter.id,
      icon,
    ],
  );

  if (
    isChartCustomization(filter) &&
    filter.filterType === 'chart_customization_dynamic_groupby'
  ) {
    return (
      <GroupByFilterCard
        customizationItem={filter}
        orientation={
          orientation === FilterBarOrientation.Horizontal
            ? 'horizontal'
            : 'vertical'
        }
        dataMaskSelected={dataMaskSelected}
        onFilterSelectionChange={onFilterSelectionChange}
      />
    );
  }

  const valuePortal = (
    <InPortal node={portalNode}>
      <FilterValue
        dataMaskSelected={dataMaskSelected}
        filter={filter}
        showOverflow={showOverflow}
        onFilterSelectionChange={onFilterSelectionChange}
        inView={inView}
        parentRef={parentRef}
        orientation={orientation}
        overflow={overflow}
        validateStatus={validateStatus}
        clearAllTrigger={clearAllTrigger || clearing}
        onClearAllComplete={() => {
          setClearing(false);
          onClearAllComplete?.();
        }}
      />
    </InPortal>
  );

  // AuraData BI: in the filter pane, each filter is a card with what it
  // selects, as in Power BI
  if (orientation === FilterBarOrientation.Vertical && !overflow) {
    return (
      <>
        {valuePortal}
        <FilterCard
          id={filter.id}
          name={name}
          summary={filterSummary(
            filter.dataMask?.filterState as
              | { value?: unknown; label?: unknown }
              | undefined,
          )}
          active={hasValue}
          forceOpen={!!isMissingRequiredValue}
          extra={
            <>
              {isRequired && <RequiredFieldIndicator />}
              {filter.description?.trim() && (
                <DescriptionToolTip description={filter.description} />
              )}
            </>
          }
          actions={
            <>
              <FilterEditButton filterId={filter.id} name={name} />
              {hasValue && (
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  aria-label={t('Clear %s', name)}
                  data-test="filter-control-clear"
                  onClick={clearFilter}
                >
                  <Icons.ClearOutlined iconSize="s" />
                </Button>
              )}
            </>
          }
        >
          <FilterControlContainer layout="vertical">
            <FormItem
              htmlFor={filter.id}
              required={filter?.controlValues?.enableEmptyFilter}
              validateStatus={validateStatus}
            >
              <OutPortal node={portalNode} />
            </FormItem>
          </FilterControlContainer>
        </FilterCard>
      </>
    );
  }

  return (
    <>
      {valuePortal}
      <FilterControlContainer
        layout={
          orientation === FilterBarOrientation.Horizontal && !overflow
            ? 'horizontal'
            : 'vertical'
        }
      >
        <div>
          <FormItem
            label={label}
            htmlFor={filter.id}
            required={filter?.controlValues?.enableEmptyFilter}
            validateStatus={validateStatus}
          >
            <OutPortal node={portalNode} />
          </FormItem>
        </div>
      </FilterControlContainer>
    </>
  );
};

export default memo(FilterControl);
