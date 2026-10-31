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
import { useDispatch } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { LayoutItem } from 'src/dashboard/types';
import { setObjectFlag } from './actions';
import { HIDDEN_KEY, LOCKED_KEY } from './types';
import { HIDE_MOBILE_KEY } from './mobile';
import { useCanvasMobile } from './CanvasFrame';
import { clearVisibilityOverride } from 'src/mibi/report/visibility';

const Badges = styled.span`
  ${({ theme }) => css`
    position: absolute;
    top: ${theme.sizeUnit * 1.5}px;
    left: ${theme.sizeUnit * 1.5}px;
    z-index: 4;
    display: inline-flex;
    gap: ${theme.sizeUnit}px;
    pointer-events: none;

    span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px ${theme.sizeUnit * 2}px;
      border-radius: 999px;
      background: ${theme.colorBgSpotlight};
      color: ${theme.colorTextLightSolid};
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
    }
  `}
`;

/** "Hidden" and "Locked" chips shown on an object in edit mode. */
export function ObjectBadges({ item }: { item: LayoutItem }) {
  const mobile = useCanvasMobile();
  const hiddenOnMobile = mobile && !!item.meta[HIDE_MOBILE_KEY];
  if (!item.meta.mibiHidden && !item.meta.mibiLocked && !hiddenOnMobile)
    return null;
  return (
    <Badges data-test="mibi-object-badges">
      {item.meta.mibiHidden && (
        <span>
          <Icons.EyeInvisibleOutlined iconSize="s" />
          {t('Hidden')}
        </span>
      )}
      {hiddenOnMobile && (
        <span>
          <Icons.MobileOutlined iconSize="s" />
          {t('Hidden on mobile')}
        </span>
      )}
      {item.meta.mibiLocked && (
        <span>
          <Icons.LockOutlined iconSize="s" />
          {t('Locked')}
        </span>
      )}
    </Badges>
  );
}

const Toggle = styled.button<{ $on: boolean }>`
  ${({ theme, $on }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: ${theme.borderRadius}px;
    background: ${$on ? theme.colorPrimaryBg : theme.colorFillTertiary};
    color: ${$on ? theme.colorPrimary : theme.colorTextSecondary};
    cursor: pointer;

    &:hover {
      color: ${theme.colorPrimary};
    }
  `}
`;

/** Hide and lock toggles for the object selected in the Format pane. */
export function ObjectFlagToggles({ item }: { item: LayoutItem }) {
  const dispatch = useDispatch();
  const hidden = !!item.meta.mibiHidden;
  const locked = !!item.meta.mibiLocked;
  const hideMobile = !!item.meta[HIDE_MOBILE_KEY];
  return (
    <>
      <Tooltip title={hideMobile ? t('Show on mobile') : t('Hide on mobile')}>
        <Toggle
          type="button"
          $on={hideMobile}
          aria-pressed={hideMobile}
          aria-label={t('Hide on mobile')}
          data-test="mibi-toggle-mobile"
          onClick={() =>
            dispatch(setObjectFlag(item.id, HIDE_MOBILE_KEY, !hideMobile))
          }
        >
          <Icons.MobileOutlined iconSize="m" />
        </Toggle>
      </Tooltip>
      <Tooltip title={hidden ? t('Show to viewers') : t('Hide from viewers')}>
        <Toggle
          type="button"
          $on={hidden}
          aria-pressed={hidden}
          aria-label={t('Hide from viewers')}
          data-test="mibi-toggle-hidden"
          onClick={() => {
            // The object's own flag wins over a bookmark applied before
            clearVisibilityOverride(item.id);
            dispatch(setObjectFlag(item.id, HIDDEN_KEY, !hidden));
          }}
        >
          {hidden ? (
            <Icons.EyeInvisibleOutlined iconSize="m" />
          ) : (
            <Icons.EyeOutlined iconSize="m" />
          )}
        </Toggle>
      </Tooltip>
      <Tooltip title={locked ? t('Unlock') : t('Lock in place')}>
        <Toggle
          type="button"
          $on={locked}
          aria-pressed={locked}
          aria-label={t('Lock in place')}
          data-test="mibi-toggle-locked"
          onClick={() => dispatch(setObjectFlag(item.id, LOCKED_KEY, !locked))}
        >
          {locked ? (
            <Icons.LockOutlined iconSize="m" />
          ) : (
            <Icons.UnlockOutlined iconSize="m" />
          )}
        </Toggle>
      </Tooltip>
    </>
  );
}
