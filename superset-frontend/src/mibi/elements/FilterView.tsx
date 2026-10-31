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
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Filter, NativeFilterType } from '@superset-ui/core';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import CanvasFilterControl from './CanvasFilterControl';
import type { FilterElement } from './types';

const Placeholder = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: ${theme.sizeUnit * 2}px;
    text-align: center;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const Body = styled.div`
  width: 100%;
  height: 100%;
  overflow: visible;
`;

/**
 * A dashboard native filter drawn on the canvas, like a BI slicer. It
 * applies selections right away and shares its value with the filter bar.
 */
export function FilterView({
  config,
  editMode,
}: {
  config: FilterElement;
  editMode: boolean;
}) {
  const filters = useFilters();
  const candidate = config.filterId ? filters[config.filterId] : undefined;
  const filter =
    candidate?.type === NativeFilterType.NativeFilter
      ? (candidate as Filter)
      : undefined;

  if (filter) {
    return (
      <Body data-test="mibi-filter-control">
        <CanvasFilterControl filter={filter} />
      </Body>
    );
  }
  let message = t('No filter selected');
  if (config.filterId) {
    message = t('The selected filter no longer exists');
  } else if (editMode) {
    message = t('Choose a dashboard filter in the Format pane');
  }
  return <Placeholder>{message}</Placeholder>;
}
