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
import tinycolor from 'tinycolor2';
import { css, styled } from '@apache-superset/core/theme';
import {
  DEFAULT_WORKSPACE_COLOR,
  workspaceInitials,
  type WorkspaceSummary,
} from './api';

const SIZES = { s: 24, m: 36, l: 56, xl: 88 } as const;

export type WorkspaceAvatarSize = keyof typeof SIZES;

const Tile = styled.span<{ px: number }>`
  ${({ theme, px }) => css`
    position: relative;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${px}px;
    height: ${px}px;
    border-radius: ${Math.max(6, Math.round(px * 0.26))}px;
    overflow: hidden;
    color: ${theme.colorTextLightSolid};
    font-size: ${Math.round(px * 0.38)}px;
    font-weight: ${theme.fontWeightStrong};
    letter-spacing: -0.02em;
    line-height: 1;
    user-select: none;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Soft highlight that makes the tile read as an object */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px ${theme.colorBorderSecondary};
      background: linear-gradient(
        180deg,
        ${tinycolor(theme.colorWhite).setAlpha(0.18).toRgbString()},
        transparent 55%
      );
      pointer-events: none;
    }
  `}
`;

/** A gradient from the workspace color, for avatars and covers. */
export function workspaceGradient(color?: string | null, angle = 135) {
  const base = tinycolor(color || DEFAULT_WORKSPACE_COLOR);
  return `linear-gradient(${angle}deg, ${base
    .clone()
    .lighten(8)
    .spin(-8)
    .toHexString()}, ${base.clone().darken(10).spin(10).toHexString()})`;
}

export interface WorkspaceAvatarProps {
  workspace: Pick<WorkspaceSummary, 'name' | 'color' | 'image_url'>;
  size?: WorkspaceAvatarSize;
  className?: string;
}

/** The workspace picture, or its initials on the workspace color. */
export function WorkspaceAvatar({
  workspace,
  size = 'm',
  className,
}: WorkspaceAvatarProps) {
  const px = SIZES[size];
  return (
    <Tile
      px={px}
      className={className}
      aria-hidden
      style={
        workspace.image_url
          ? undefined
          : { background: workspaceGradient(workspace.color) }
      }
      data-test="workspace-avatar"
    >
      {workspace.image_url ? (
        <img src={workspace.image_url} alt="" />
      ) : (
        workspaceInitials(workspace.name)
      )}
    </Tile>
  );
}
