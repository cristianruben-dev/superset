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
import { Tooltip } from '@superset-ui/core/components';
import {
  userInitials,
  userName,
  type WorkspaceMember,
  type WorkspaceRole,
} from './api';

export const roleLabel = (role: WorkspaceRole): string =>
  ({
    admin: t('Admin'),
    contributor: t('Contributor'),
    viewer: t('Viewer'),
  })[role];

export const roleDescription = (role: WorkspaceRole): string =>
  ({
    admin: t('Manages the workspace, its members and its dashboards'),
    contributor: t('Adds, creates and edits dashboards and charts'),
    viewer: t('Sees the workspace and its dashboards'),
  })[role];

const Badge = styled.span`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    height: 22px;
    padding: 0 ${theme.sizeUnit * 2.5}px;
    border-radius: 999px;
    font-size: ${theme.fontSizeSM}px;
    font-weight: 500;
    white-space: nowrap;
    background: ${theme.colorFillSecondary};
    color: ${theme.colorTextSecondary};

    &.admin {
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};
    }

    &.contributor {
      background: ${theme.colorSuccessBg};
      color: ${theme.colorSuccessText};
    }
  `}
`;

/** The role as a colored pill. */
export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return (
    <Tooltip title={roleDescription(role)}>
      <Badge className={role} data-test="workspace-role-badge">
        {roleLabel(role)}
      </Badge>
    </Tooltip>
  );
}

const Stack = styled.span<{ px: number }>`
  ${({ theme, px }) => css`
    display: inline-flex;
    align-items: center;

    .person,
    .more {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${px}px;
      height: ${px}px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px ${theme.colorBgContainer};
      font-size: ${Math.round(px * 0.4)}px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .person {
      background: linear-gradient(
        135deg,
        ${theme.colorPrimaryHover},
        ${theme.colorPrimaryActive}
      );
      color: ${theme.colorTextLightSolid};
    }

    .person + .person,
    .person + .more {
      margin-left: -${Math.round(px * 0.28)}px;
    }

    .more {
      background: ${theme.colorFillSecondary};
      color: ${theme.colorTextSecondary};
    }
  `}
`;

export interface MemberAvatarsProps {
  members: WorkspaceMember[];
  total: number;
  size?: number;
}

/** The first members as overlapping avatars, and how many more there are. */
export function MemberAvatars({ members, total, size = 26 }: MemberAvatarsProps) {
  const shown = members.slice(0, 4);
  const rest = total - shown.length;
  return (
    <Stack px={size} data-test="workspace-member-avatars">
      {shown.map(member => (
        <Tooltip
          key={member.id}
          title={`${userName(member)} · ${roleLabel(member.role)}`}
        >
          <span className="person">{userInitials(member)}</span>
        </Tooltip>
      ))}
      {rest > 0 && <span className="more">+{rest}</span>}
    </Stack>
  );
}
