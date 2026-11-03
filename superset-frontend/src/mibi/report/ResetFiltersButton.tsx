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
import type { SerializedStyles } from '@emotion/react';
import type { SupersetTheme } from '@apache-superset/core/theme';
import { Button, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { filtersChanged, resetFilters } from './resetFilters';

/** Whether "Reset filters" has something to bring back. */
export const useFiltersChanged = () =>
  useSelector((state: RootState) => filtersChanged(state));

/** "Reset filters" for viewers, next to the bookmarks. */
export function ResetFiltersButton({
  buttonCss,
}: {
  buttonCss?: (theme: SupersetTheme) => SerializedStyles;
}) {
  const dispatch = useDispatch();
  const changed = useFiltersChanged();
  return (
    <Tooltip
      title={t('Reset filters: back to the saved filters and slicers')}
      placement="bottom"
    >
      <Button
        buttonStyle="secondary"
        className="action-button"
        css={buttonCss}
        aria-label={t('Reset filters')}
        data-test="mibi-reset-filters"
        disabled={!changed}
        onClick={() => dispatch(resetFilters() as never)}
      >
        <Icons.Undo iconSize="l" />
      </Button>
    </Tooltip>
  );
}
