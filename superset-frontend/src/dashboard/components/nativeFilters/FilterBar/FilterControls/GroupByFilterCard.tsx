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
import { FC, useCallback, useEffect, useMemo, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  DataMask,
  DataMaskStateWithId,
  DatasourceType,
  Filter,
  useTruncation,
  ChartCustomization,
  NativeFilterTarget,
} from '@superset-ui/core';
import {
  styled,
  css,
  useTheme,
  SupersetTheme,
} from '@apache-superset/core/theme';
import {
  Typography,
  Select,
  type LabeledValue,
  Loading,
  Icons,
  Tooltip,
  FormItem,
} from '@superset-ui/core/components';
import { propertyComparator } from '@superset-ui/core/components/Select/utils';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import { setPendingChartCustomization } from 'src/dashboard/actions/chartCustomizationActions';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { dispatchChartCustomizationHoverAction } from './utils';
import {
  displayControlBindingKey,
  useDisplayControlDatasource,
} from '../../useDisplayControlDatasource';
import { datasetLabelLower } from 'src/features/semanticLayers/label';

interface GroupByFilterCardProps {
  customizationItem: ChartCustomization;
  orientation?: 'vertical' | 'horizontal';
  dataMaskSelected?: DataMaskStateWithId;
  onFilterSelectionChange?: (
    filter: Filter | ChartCustomization,
    dataMask: DataMask,
  ) => void;
}

const FilterTitle = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorText};
  font-weight: 600;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
  cursor: default;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HorizontalFormItem = styled(FormItem)`
  && {
    margin-bottom: 0;
    align-items: center;
  }

  .ant-form-item-label {
    display: flex;
    align-items: center;
    overflow: visible;
    padding-bottom: 0;
    margin-right: ${({ theme }) => theme.sizeUnit * 2}px;

    & > label {
      margin-bottom: 0;
      padding: 0;
      line-height: 1;
      font-size: ${({ theme }) => theme.fontSizeSM}px;
      font-weight: ${({ theme }) => theme.fontWeightNormal};
      color: ${({ theme }) => theme.colorText};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &::after {
        display: none;
      }
    }
  }

  .ant-form-item-control {
    min-width: 164px;
    max-width: none;
  }

  .select-container {
    width: 100%;
  }
`;

// The popup portals to document.body (out of HorizontalFormItem's styled
// scope), so its width constraints ride along as inline popup styles.
const HORIZONTAL_POPUP_STYLES = {
  popup: { root: { minWidth: 200, maxWidth: 400 } },
};

const ToolTipContainer = styled.div`
  font-size: ${({ theme }) => theme.fontSize}px;
  display: flex;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const RequiredFieldIndicator = () => (
  <span
    css={(theme: SupersetTheme) => ({
      color: theme.colorError,
      fontSize: `${theme.fontSizeSM}px`,
      paddingLeft: '1px',
    })}
  >
    *
  </span>
);

const DescriptionTooltip = ({ description }: { description: string }) => (
  <ToolTipContainer>
    <Tooltip
      title={description}
      placement="right"
      overlayInnerStyle={{
        display: '-webkit-box',
        WebkitLineClamp: 10,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'normal',
      }}
    >
      <Icons.InfoCircleOutlined
        className="text-muted"
        // Deliberate role="button" override on this tooltip-trigger icon
        // (no click handler; BaseIconComponent would otherwise auto-compute
        // role="img" since there's no onClick) — matches the same pattern
        // used by DescriptionToolTip/DeckglLayerVisibilityTooltip.
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="button"
        css={theme => ({
          paddingLeft: `${theme.sizeUnit}px`,
        })}
      />
    </Tooltip>
  </ToolTipContainer>
);

// Sort display values by label: ascending when sortAscending is true, descending
// when false, and source order (no sort) when it is unset.
export const createLabelSortComparator =
  (sortAscending?: boolean) =>
  (a: LabeledValue, b: LabeledValue): number => {
    if (sortAscending === undefined) {
      return 0;
    }
    const labelComparator = propertyComparator('label');
    return sortAscending ? labelComparator(a, b) : labelComparator(b, a);
  };

const GroupByFilterCard: FC<GroupByFilterCardProps> = ({
  customizationItem,
  orientation = 'vertical',
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const theme = useTheme();
  const dataset = customizationItem.targets?.[0]?.datasetId;
  // Semantic views and regular datasets have independent id sequences —
  // the persisted type is what disambiguates a colliding numeric id
  // (sc-111089). Absent type means a regular dataset.
  const datasourceType = customizationItem.targets?.[0]?.datasourceType;
  const [filterTitleRef, , titleElementsTruncated] = useTruncation();


  const dispatch = useDispatch();

  // Legacy persisted targets may carry the id as a number, string, or
  // {value} object; the card owns this normalization and hands the hook
  // a clean id.
  const normalizedDatasetId = useMemo(() => {
    if (typeof dataset === 'number' || typeof dataset === 'string') {
      return dataset;
    }
    if (typeof dataset === 'object' && dataset !== null && 'value' in dataset) {
      return (dataset as { value: string | number }).value;
    }
    return undefined;
  }, [dataset]);

  const {
    columns: datasourceColumns,
    loading,
    error: datasourceError,
  } = useDisplayControlDatasource(normalizedDatasetId, datasourceType);

  const columnOptions = useMemo(
    () =>
      datasourceColumns
        .filter(col => col.filterable !== false)
        .map(col => ({
          label: col.verbose_name || col.column_name || col.name || '',
          value: col.column_name || col.name || '',
        })),
    [datasourceColumns],
  );

  // Surface load failures as a toast, once per binding — the hook can
  // re-render (and StrictMode double-invokes effects) without re-toasting.
  const toastedBindingRef = useRef<string | undefined>();
  useEffect(() => {
    if (!datasourceError || normalizedDatasetId === undefined) {
      return;
    }
    // The hook scopes `error` to the current binding, so a truthy error here
    // always belongs to this datasource — no cross-binding mis-toast. The key
    // is only used to toast a given binding's failure once, across the hook's
    // re-renders and StrictMode's double-invoked effects.
    const binding = displayControlBindingKey(
      normalizedDatasetId,
      datasourceType,
    );
    if (toastedBindingRef.current === binding) {
      return;
    }
    toastedBindingRef.current = binding;
    dispatch(
      addDangerToast(
        datasourceType === DatasourceType.SemanticView
          ? t(
              'Failed to load dimensions for semantic view %s',
              normalizedDatasetId,
            )
          : t(
              'Failed to load columns for %s %s',
              datasetLabelLower(),
              normalizedDatasetId,
            ),
      ),
    );
  }, [datasourceError, normalizedDatasetId, datasourceType, dispatch]);

  const isHorizontalLayout = orientation === 'horizontal';

  const setHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(dispatch, customizationItem.id),
    [dispatch, customizationItem.id],
  );

  const unsetHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(dispatch),
    [dispatch],
  );

  const isRequired = useMemo(
    () => !!customizationItem.controlValues?.enableEmptyFilter,
    [customizationItem.controlValues?.enableEmptyFilter],
  );

  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );

  const effectiveDataMask = dataMaskSelected ?? dataMask;

  const columnName = customizationItem.targets?.[0]?.column?.name;

  const currentValue = useMemo(() => {
    const dataMaskValue =
      effectiveDataMask[customizationItem.id]?.filterState?.value;

    if (dataMaskValue !== undefined) {
      return dataMaskValue;
    }

    return null;
  }, [effectiveDataMask, customizationItem.id]);

  const canSelectMultiple =
    customizationItem.controlValues?.canSelectMultiple ?? true;

  const sortAscending = customizationItem.controlValues?.sortAscending;

  const sortComparator = useMemo(
    () => createLabelSortComparator(sortAscending),
    [sortAscending],
  );

  const columnDisplayName = useMemo(() => {
    if (customizationItem.name) {
      return customizationItem.name;
    }
    if (columnName) {
      return columnName;
    }
    return t('Group By');
  }, [customizationItem.name, columnName]);

  const handleColumnChange = useCallback(
    (value: string | string[]) => {
      const columnValue = canSelectMultiple
        ? Array.isArray(value)
          ? value.length > 0
            ? value
            : null
          : value || null
        : typeof value === 'string'
          ? value
          : null;

      // Preserve datasourceType (and datasetId) when rebuilding the
      // target: dropping the type here would silently degrade a
      // semantic-view binding to the colliding regular dataset on the
      // next resolution (sc-111089 review finding).
      const targets: [Partial<NativeFilterTarget>] = columnValue
        ? ([
            {
              datasetId: dataset,
              ...(datasourceType ? { datasourceType } : {}),
              column: { name: columnValue },
            },
          ] as [Partial<NativeFilterTarget>])
        : ([
            {
              datasetId: dataset,
              ...(datasourceType ? { datasourceType } : {}),
            },
          ] as [Partial<NativeFilterTarget>]);

      dispatch(
        setPendingChartCustomization({
          ...customizationItem,
          targets,
        }),
      );

      const groupbyValue = columnValue
        ? Array.isArray(columnValue)
          ? columnValue
          : [columnValue]
        : [];

      const dataMask: DataMask = {
        extraFormData: {
          custom_form_data: {
            groupby: groupbyValue,
          },
        },
        filterState: {
          label: groupbyValue.join(', '),
          value: columnValue,
        },
        ownState: {
          column: columnValue,
        },
      };

      onFilterSelectionChange?.(customizationItem, dataMask);
    },
    [
      canSelectMultiple,
      dataset,
      datasourceType,
      dispatch,
      customizationItem,
      onFilterSelectionChange,
    ],
  );

  // The previous fetch effect listed a `dependencies` aggregation of other
  // filters' extraFormData in its dep array, but the request never used it —
  // dead coupling that only triggered no-op refetches (removed with the
  // move to useDisplayControlDatasource; sc-111089 review).

  const displayTitle = columnDisplayName;

  const description = customizationItem.description?.trim();

  return (
    <div>
      {!isHorizontalLayout && (
        <div
          css={css`
            display: flex;
            align-items: center;
            margin-bottom: ${theme.sizeUnit}px;
          `}
        >
          <Tooltip
            placement="bottom"
            title={titleElementsTruncated ? displayTitle : null}
          >
            <div ref={filterTitleRef}>
              <FilterTitle>
                {displayTitle}
                {isRequired && <RequiredFieldIndicator />}
              </FilterTitle>
            </div>
          </Tooltip>
          {description && <DescriptionTooltip description={description} />}
        </div>
      )}

      {isHorizontalLayout ? (
        <HorizontalFormItem
          label={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              {displayTitle}
              {isRequired && <RequiredFieldIndicator />}
            </div>
          }
        >
          <div
            onMouseEnter={setHoveredChartCustomization}
            onMouseLeave={unsetHoveredChartCustomization}
          >
            <Select
              allowClear
              autoClearSearchValue
              placeholder={t('Search columns...')}
              value={currentValue}
              onChange={handleColumnChange}
              options={columnOptions}
              showSearch
              mode={canSelectMultiple ? 'multiple' : undefined}
              filterOption={(input, option) =>
                ((option?.label as string) ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              sortComparator={sortComparator}
              getPopupContainer={() => document.body}
              styles={HORIZONTAL_POPUP_STYLES}
              oneLine={isHorizontalLayout}
              className="select-container"
              loading={loading}
            />
          </div>
        </HorizontalFormItem>
      ) : (
        <div
          css={css`
            margin-bottom: ${theme.sizeUnit}px;
          `}
          onMouseEnter={setHoveredChartCustomization}
          onMouseLeave={unsetHoveredChartCustomization}
        >
          <Select
            allowClear
            autoClearSearchValue
            placeholder={t('Search columns...')}
            value={currentValue}
            onChange={handleColumnChange}
            options={columnOptions}
            showSearch
            mode={canSelectMultiple ? 'multiple' : undefined}
            filterOption={(input, option) =>
              ((option?.label as string) ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            sortComparator={sortComparator}
            loading={loading}
          />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Loading position="inline" size="s" muted />
        </div>
      )}
    </div>
  );
};

export default GroupByFilterCard;
