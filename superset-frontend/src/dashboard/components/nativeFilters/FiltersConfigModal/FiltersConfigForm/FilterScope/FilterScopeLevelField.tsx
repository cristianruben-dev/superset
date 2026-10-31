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
import { FC } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { FilterScopeLevel } from '@superset-ui/core';
import { FormItem } from '@superset-ui/core/components';
import { Radio } from '@superset-ui/core/components/Radio';

/** Form value meaning "derive the level from the scope" */
export const AUTO_SCOPE_LEVEL = 'auto';

export type FilterScopeLevelFormValue =
  | FilterScopeLevel
  | typeof AUTO_SCOPE_LEVEL;

type FilterScopeLevelFieldProps = {
  filterId: string;
  initialValue?: FilterScopeLevel;
  onChange: () => void;
};

const Wrapper = styled.div`
  padding: 0 ${({ theme }) => theme.sizeUnit * 4}px;
`;

/**
 * Picks the filter bar section of a native filter: listed on every page,
 * only on the pages it targets, or only next to the visuals it targets.
 */
const FilterScopeLevelField: FC<FilterScopeLevelFieldProps> = ({
  filterId,
  initialValue,
  onChange,
}) => (
  <Wrapper>
    <FormItem
      name={['filters', filterId, 'scopeLevel']}
      initialValue={initialValue ?? AUTO_SCOPE_LEVEL}
      label={t('Show in filter bar section')}
      tooltip={t(
        'Filters on all pages are always listed. Filters on this page and filters on visuals are only listed while the tab they apply to is open. Automatic picks the section from the scoping below.',
      )}
    >
      <Radio.GroupWrapper
        options={[
          { value: AUTO_SCOPE_LEVEL, label: t('Automatic') },
          { value: FilterScopeLevel.Report, label: t('All pages') },
          { value: FilterScopeLevel.Page, label: t('This page') },
          { value: FilterScopeLevel.Visual, label: t('Visuals') },
        ]}
        onChange={onChange}
      />
    </FormItem>
  </Wrapper>
);

export default FilterScopeLevelField;
