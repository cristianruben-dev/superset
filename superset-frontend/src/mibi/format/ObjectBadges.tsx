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
import { Icons } from '@superset-ui/core/components/Icons';
import type { LayoutItemMeta } from 'src/dashboard/types';

// At the bottom corner, so they never cover the title of the object
const Badges = styled.div`
  ${({ theme }) => css`
    position: absolute;
    bottom: ${theme.sizeUnit}px;
    left: ${theme.sizeUnit}px;
    z-index: 5;
    display: flex;
    gap: ${theme.sizeUnit}px;
    pointer-events: none;

    span {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      padding: 0 ${theme.sizeUnit * 1.5}px;
      border-radius: ${theme.borderRadiusSM}px;
      background: ${theme.colorBgElevated};
      box-shadow: ${theme.boxShadowTertiary};
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

/** Tells the editor that an object is hidden from viewers or locked. */
export function ObjectBadges({
  meta,
  hidden,
}: {
  meta: LayoutItemMeta;
  hidden: boolean;
}) {
  if (!hidden && !meta.mibiLocked) return null;
  return (
    <Badges data-test="mibi-object-badges">
      {hidden && (
        <span>
          <Icons.EyeInvisibleOutlined iconSize="s" />
          {t('Hidden')}
        </span>
      )}
      {meta.mibiLocked && (
        <span>
          <Icons.LockOutlined iconSize="s" />
          {t('Locked')}
        </span>
      )}
    </Badges>
  );
}
