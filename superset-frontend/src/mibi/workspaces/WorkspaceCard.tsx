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
import { Link } from 'react-router-dom';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { workspaceUrl, type Workspace } from './api';
import { MemberAvatars, RoleBadge } from './roles';
import { WorkspaceAvatar, workspaceGradient } from './WorkspaceAvatar';

const Card = styled(Link)`
  ${({ theme }) => css`
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 228px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
    overflow: hidden;
    transition:
      border-color ${theme.motionDurationMid},
      box-shadow ${theme.motionDurationMid},
      transform ${theme.motionDurationMid};

    &:hover,
    &:focus-visible {
      color: ${theme.colorText};
      text-decoration: none;
      border-color: ${theme.colorPrimaryBorder};
      box-shadow: ${theme.boxShadow};
      transform: translateY(-2px);
    }

    .cover {
      position: relative;
      height: 84px;
      background-size: cover;
      background-position: center;

      /* Fine dot texture over the color */
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(
          ${theme.colorBgContainer} 1px,
          transparent 1.2px
        );
        background-size: 14px 14px;
        opacity: 0.16;
      }
    }

    .cover.photo {
      filter: saturate(1.1);

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        backdrop-filter: blur(18px);
      }
    }

    .avatar {
      position: absolute;
      top: 56px;
      left: ${theme.sizeUnit * 5}px;
      border-radius: 16px;
      box-shadow:
        0 0 0 3px ${theme.colorBgContainer},
        ${theme.boxShadowTertiary};
    }

    .role {
      position: absolute;
      top: 94px;
      right: ${theme.sizeUnit * 5}px;
    }

    .body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: ${theme.sizeUnit * 1.5}px;
      padding: ${theme.sizeUnit * 10}px ${theme.sizeUnit * 5}px
        ${theme.sizeUnit * 4}px;
    }

    .name {
      font-size: ${theme.fontSizeLG}px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.015em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .description {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 2.9em;
      font-size: ${theme.fontSizeSM}px;
      line-height: 1.45;
      color: ${theme.colorTextSecondary};

      &.empty {
        color: ${theme.colorTextTertiary};
        font-style: italic;
      }
    }

    .footer {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      margin-top: auto;
      padding-top: ${theme.sizeUnit * 3}px;
      border-top: 1px solid ${theme.colorBorderSecondary};
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};

      .count {
        display: inline-flex;
        align-items: center;
        gap: ${theme.sizeUnit * 1.5}px;
        font-weight: 500;
        color: ${theme.colorText};

        .anticon {
          color: ${theme.colorPrimary};
        }
      }

      .when {
        display: inline-flex;
        margin-left: auto;
      }
    }
  `}
`;

export interface WorkspaceCardProps {
  workspace: Workspace;
}

/** A workspace in the workspace grid: cover, picture, name and description. */
export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const cover = workspace.image_url
    ? {
        backgroundImage: `url("${workspace.image_url}")`,
      }
    : { background: workspaceGradient(workspace.color, 120) };

  return (
    <Card to={workspaceUrl(workspace.id)} data-test="workspace-card">
      <span
        className={workspace.image_url ? 'cover photo' : 'cover'}
        style={cover}
      />
      <WorkspaceAvatar workspace={workspace} size="l" className="avatar" />
      {/* Admin is the common case (and every Superset admin's), so only the
          narrower roles get a badge */}
      {workspace.role && workspace.role !== 'admin' && (
        <span className="role">
          <RoleBadge role={workspace.role} />
        </span>
      )}
      <span className="body">
        <span className="name" title={workspace.name}>
          {workspace.name}
        </span>
        <span
          className={
            workspace.description ? 'description' : 'description empty'
          }
        >
          {workspace.description || t('No description')}
        </span>
        <span className="footer">
          <span className="count">
            <Icons.DashboardOutlined iconSize="m" />
            {tn(
              '%s dashboard',
              '%s dashboards',
              workspace.dashboard_count,
              workspace.dashboard_count,
            )}
          </span>
          <span className="when">
            <MemberAvatars
              members={workspace.members}
              total={workspace.member_count}
              size={24}
            />
          </span>
        </span>
      </span>
    </Card>
  );
}
