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
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import {
  fetchDashboardWorkspace,
  workspaceUrl,
  type WorkspaceSummary,
} from './api';
import { WorkspaceAvatar } from './WorkspaceAvatar';

const Chip = styled(Link)`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 1.5}px;
    max-width: 200px;
    height: 24px;
    padding: 0 ${theme.sizeUnit * 2.5}px 0 3px;
    border-radius: 999px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    font-weight: 500;
    transition:
      border-color ${theme.motionDurationMid},
      color ${theme.motionDurationMid};

    &:hover {
      color: ${theme.colorPrimary};
      border-color: ${theme.colorPrimaryBorder};
      text-decoration: none;
    }

    > span:first-of-type {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      font-size: 8px;
    }

    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `}
`;

/** Links a dashboard to the workspace it lives in, when it has one. */
export function DashboardWorkspaceChip({
  dashboardId,
}: {
  dashboardId: number;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardWorkspace(dashboardId)
      .then(result => {
        if (!cancelled) setWorkspace(result);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId]);

  if (!workspace) {
    return null;
  }
  return (
    <Tooltip title={t('Workspace')}>
      <Chip
        to={workspaceUrl(workspace.id)}
        data-test="dashboard-workspace-chip"
      >
        <WorkspaceAvatar workspace={workspace} size="s" />
        <span className="name">{workspace.name}</span>
      </Chip>
    </Tooltip>
  );
}
