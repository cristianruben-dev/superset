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
import { css, styled } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { Switch } from '@superset-ui/core/components/Switch';
import { saveCrossFiltersSetting } from 'src/dashboard/actions/dashboardInfo';
import type { RootState } from 'src/dashboard/types';
import { clearDataMaskState } from 'src/dataMask/actions';

const Row = styled.label`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.sizeUnit * 2}px;
    margin: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px 0;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorFillSecondary};
    font-size: ${theme.fontSizeSM}px;
    font-weight: 500;
    color: ${theme.colorTextSecondary};
    cursor: pointer;
  `}
`;

/**
 * A visible on/off switch for the dashboard's cross-filtering (clicking a chart
 * filters the others). Saved in the dashboard, so only editors see it.
 */
export function CrossFiltersSwitch() {
  const dispatch = useDispatch();
  const enabled = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => !!dashboardInfo.crossFiltersEnabled,
  );
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => !!dashboardInfo.dash_edit_perm,
  );

  if (!canEdit) {
    return null;
  }

  const toggle = (checked: boolean) => {
    if (!checked) {
      dispatch(clearDataMaskState());
    }
    dispatch(saveCrossFiltersSetting(checked));
  };

  return (
    <Tooltip
      title={t('Click a chart to filter the rest of the dashboard')}
      placement="right"
    >
      <Row data-test="mibi-cross-filters-switch">
        {t('Cross-filtering')}
        <Switch size="small" checked={enabled} onChange={toggle} />
      </Row>
    </Tooltip>
  );
}
