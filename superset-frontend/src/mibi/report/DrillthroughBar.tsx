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
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { removeDataMask } from 'src/dataMask/actions';
import { activeDrillthrough, leaveDrillthrough } from './drillthrough';
import { DRILLTHROUGH_ID } from './drillthroughScope';

const Bar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    margin: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px 0;
    padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
    border-radius: 999px;
    border: 1px solid ${theme.colorPrimaryBorder};
    background: ${theme.colorPrimaryBg};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;

    .back,
    .clear {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      height: 26px;
      padding: 0 ${theme.sizeUnit * 3}px;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      font-weight: ${theme.fontWeightStrong};
    }

    .back {
      background: ${theme.colorText};
      color: ${theme.colorBgContainer};
    }

    .clear {
      margin-left: auto;
      padding: 0 ${theme.sizeUnit * 2}px;
      background: transparent;
      color: ${theme.colorTextSecondary};

      &:hover {
        color: ${theme.colorText};
      }
    }

    .label {
      color: ${theme.colorTextSecondary};
    }

    .fields {
      display: inline-flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit}px;
      min-width: 0;
    }

    .field {
      padding: 1px ${theme.sizeUnit * 2}px;
      border-radius: 999px;
      background: ${theme.colorBgContainer};
      font-weight: 500;
    }
  `}
`;

/**
 * Shown on the page a drill through opened: what it is filtered to, a way
 * back to the page it came from and a way to clear it. Leaving the dashboard
 * drops the drill through.
 */
export function DrillthroughBar() {
  const dispatch = useDispatch();
  const drillthrough = useSelector((state: RootState) =>
    activeDrillthrough(state.dataMask, state.dashboardInfo.id),
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );

  useEffect(
    () => () => {
      dispatch(removeDataMask(DRILLTHROUGH_ID));
    },
    [dispatch],
  );

  if (!drillthrough || !activeTabs?.includes(drillthrough.tabId)) return null;

  return (
    <Bar role="status" data-test="mibi-drillthrough-bar">
      {drillthrough.sourceTabId && (
        <button
          type="button"
          className="back"
          data-test="mibi-drillthrough-back"
          onClick={() => dispatch(leaveDrillthrough(true) as never)}
        >
          <Icons.ArrowLeftOutlined iconSize="s" />
          {t('Back')}
        </button>
      )}
      <span className="label">{t('Drill through')}</span>
      <span className="fields">
        {drillthrough.fields.map(field => (
          <span key={field.column} className="field">
            {field.column}: {field.label}
          </span>
        ))}
      </span>
      <Tooltip title={t('Clear the drill through')}>
        <button
          type="button"
          className="clear"
          aria-label={t('Clear the drill through')}
          data-test="mibi-drillthrough-clear"
          onClick={() => dispatch(leaveDrillthrough(false) as never)}
        >
          <Icons.CloseOutlined iconSize="s" />
        </button>
      </Tooltip>
    </Bar>
  );
}
