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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons, Select, Tooltip } from '@superset-ui/core/components';
import {
  setDirectPathToChild,
  toggleNativeFiltersBar,
} from 'src/dashboard/actions/dashboardState';
import type { RootState } from 'src/dashboard/types';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import { activeTabIndex, topLevelTabs } from './dashboardTabs';
import { setPresenting } from './presentation';

const INTERVAL_KEY = 'mibi.presentInterval';
const IDLE_MS = 2500;
export const INTERVALS = [10, 30, 60, 120, 300];
const DEFAULT_INTERVAL = 30;

const readInterval = () => {
  try {
    const value = Number(window.localStorage.getItem(INTERVAL_KEY));
    return INTERVALS.includes(value) ? value : DEFAULT_INTERVAL;
  } catch {
    return DEFAULT_INTERVAL;
  }
};

export const intervalLabel = (seconds: number) =>
  seconds < 60 ? t('%s s', seconds) : t('%s min', Math.round(seconds / 60));

const Bar = styled.div<{ $hidden: boolean }>`
  ${({ theme, $hidden }) => css`
    position: fixed;
    left: 50%;
    bottom: ${theme.sizeUnit * 6}px;
    z-index: 1100;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    max-width: calc(100vw - ${theme.sizeUnit * 8}px);
    padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
    border-radius: 999px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgElevated};
    box-shadow: ${theme.boxShadowSecondary};
    overflow: hidden;
    transform: translate(-50%, ${$hidden ? '16px' : '0'});
    opacity: ${$hidden ? 0 : 1};
    pointer-events: ${$hidden ? 'none' : 'auto'};
    transition:
      opacity ${theme.motionDurationMid} ${theme.motionEaseInOut},
      transform ${theme.motionDurationMid} ${theme.motionEaseInOut};

    .divider {
      align-self: stretch;
      width: 1px;
      margin: ${theme.sizeUnit}px 0;
      background: ${theme.colorBorderSecondary};
    }

    .where {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 0 ${theme.sizeUnit * 2}px;
      line-height: 1.25;
    }

    .title {
      max-width: 280px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      color: ${theme.colorText};
    }

    .tab {
      max-width: 280px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }

    .dots {
      display: flex;
      gap: ${theme.sizeUnit}px;
      padding: 0 ${theme.sizeUnit}px;
    }

    .dot {
      width: 8px;
      height: 8px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: ${theme.colorFill};
      cursor: pointer;
      transition:
        width ${theme.motionDurationMid},
        background ${theme.motionDurationMid};

      &.active {
        width: 20px;
        background: ${theme.colorPrimary};
      }
    }

    .progress {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 2px;
      background: ${theme.colorPrimary};
      animation: mibi-present-progress linear forwards;
    }

    @keyframes mibi-present-progress {
      from {
        width: 0;
      }
      to {
        width: 100%;
      }
    }

    .interval {
      width: 96px;
    }
  `}
`;

const RoundButton = styled.button<{ $primary?: boolean }>`
  ${({ theme, $primary }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    gap: ${theme.sizeUnit * 1.5}px;
    height: 36px;
    min-width: 36px;
    padding: 0 ${theme.sizeUnit * 2}px;
    border: 0;
    border-radius: 999px;
    background: ${$primary ? theme.colorPrimary : 'transparent'};
    color: ${$primary ? theme.colorTextLightSolid : theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    font-weight: 500;
    cursor: pointer;
    transition: background ${theme.motionDurationMid};

    &:hover:not(:disabled) {
      background: ${$primary
        ? theme.colorPrimaryHover
        : theme.colorFillTertiary};
    }

    &:disabled {
      color: ${theme.colorTextDisabled};
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: 1px;
    }
  `}
`;

const exitFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
};

/**
 * Floating controls of the presentation mode: goes through the top level tabs
 * on a timer, by keyboard or by click, and ends the presentation on Esc. The
 * bar and the cursor fade out while the mouse rests.
 */
export function PresentationControls() {
  const dispatch = useDispatch();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const filtersOpen = useSelector(
    (state: RootState) => state.dashboardState.nativeFiltersBarOpen ?? false,
  );
  const title = useSelector(
    (state: RootState) =>
      state.dashboardLayout.present[DASHBOARD_HEADER_ID]?.meta?.text ?? '',
  );
  const tabs = useMemo(() => topLevelTabs(layout), [layout]);
  const current = activeTabIndex(tabs, activeTabs);
  const [playing, setPlaying] = useState(tabs.length > 1);
  const [interval, setIntervalSeconds] = useState(readInterval);
  const [idle, setIdle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const filtersWereOpen = useRef(filtersOpen);

  const exit = useCallback(() => {
    exitFullscreen();
    setPresenting(false);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (!tabs.length) return;
      const next = (index + tabs.length) % tabs.length;
      dispatch(setDirectPathToChild(tabs[next].path));
      window.scrollTo(0, 0);
    },
    [dispatch, tabs],
  );

  // Full screen without the filter pane, restored when the presentation ends
  useEffect(() => {
    const wasOpen = filtersWereOpen.current;
    dispatch(toggleNativeFiltersBar(false));
    window.scrollTo(0, 0);
    let entered = false;
    const onFullscreenChange = () => {
      if (document.fullscreenElement) entered = true;
      else if (entered) setPresenting(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.documentElement.requestFullscreen?.().catch(() => {
      // The browser refused: present inside the window instead
    });
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      exitFullscreen();
      setPresenting(false);
      if (wasOpen) dispatch(toggleNativeFiltersBar(true));
    };
  }, [dispatch]);

  useEffect(() => {
    if (!playing || tabs.length < 2) return undefined;
    const timer = window.setTimeout(() => goTo(current + 1), interval * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, interval, current, tabs.length, goTo]);

  // Any mouse, touch or key activity shows the bar until the user rests again
  const idleTimer = useRef<number>();
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS * 1.5);
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, [wake]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      )
        return;
      if (event.key === 'Escape') exit();
      else if (['ArrowRight', 'PageDown'].includes(event.key))
        goTo(current + 1);
      else if (['ArrowLeft', 'PageUp'].includes(event.key)) goTo(current - 1);
      else if (event.key === ' ' && tabs.length > 1) {
        event.preventDefault();
        setPlaying(value => !value);
      } else return;
      wake();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, exit, goTo, tabs.length, wake]);

  useEffect(() => {
    document.body.classList.toggle('mibi-presenting-idle', idle && !menuOpen);
    return () => document.body.classList.remove('mibi-presenting-idle');
  }, [idle, menuOpen]);

  const changeInterval = (value: number) => {
    setIntervalSeconds(value);
    try {
      window.localStorage.setItem(INTERVAL_KEY, String(value));
    } catch {
      // the choice only lasts for this presentation
    }
  };

  const hasTabs = tabs.length > 1;

  return (
    <Bar
      $hidden={idle && !menuOpen}
      role="toolbar"
      aria-label={t('Presentation controls')}
      data-test="mibi-presentation-controls"
    >
      {hasTabs && (
        <>
          <Tooltip title={t('Previous page (←)')}>
            <RoundButton
              type="button"
              aria-label={t('Previous page')}
              onClick={() => goTo(current - 1)}
            >
              <Icons.LeftOutlined iconSize="m" />
            </RoundButton>
          </Tooltip>
          <Tooltip title={playing ? t('Pause (space)') : t('Play (space)')}>
            <RoundButton
              type="button"
              $primary
              aria-label={playing ? t('Pause') : t('Play')}
              data-test="mibi-presentation-play"
              onClick={() => setPlaying(value => !value)}
            >
              {playing ? (
                <Icons.PauseOutlined iconSize="m" />
              ) : (
                <Icons.CaretRightFilled iconSize="m" />
              )}
            </RoundButton>
          </Tooltip>
          <Tooltip title={t('Next page (→)')}>
            <RoundButton
              type="button"
              aria-label={t('Next page')}
              data-test="mibi-presentation-next"
              onClick={() => goTo(current + 1)}
            >
              <Icons.RightOutlined iconSize="m" />
            </RoundButton>
          </Tooltip>
          <span className="divider" />
        </>
      )}
      <div className="where">
        <span className="title">{title}</span>
        {hasTabs && (
          <span className="tab" data-test="mibi-presentation-tab">
            {t('%s of %s', current + 1, tabs.length)} · {tabs[current].title}
          </span>
        )}
      </div>
      {hasTabs && (
        <>
          <div className="dots">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                className={index === current ? 'dot active' : 'dot'}
                aria-label={tab.title}
                aria-current={index === current}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
          <span className="divider" />
          <Select
            className="interval"
            ariaLabel={t('Time per page')}
            value={interval}
            onChange={value => changeInterval(Number(value))}
            onOpenChange={setMenuOpen}
            options={INTERVALS.map(value => ({
              value,
              label: intervalLabel(value),
            }))}
            getPopupContainer={() => document.body}
          />
        </>
      )}
      <Tooltip title={t('Exit presentation (Esc)')}>
        <RoundButton
          type="button"
          aria-label={t('Exit presentation')}
          data-test="mibi-presentation-exit"
          onClick={exit}
        >
          <Icons.CloseOutlined iconSize="m" />
          {t('Exit')}
        </RoundButton>
      </Tooltip>
      {hasTabs && playing && (
        <span
          key={`${current}-${interval}`}
          className="progress"
          style={{ animationDuration: `${interval}s` }}
        />
      )}
    </Bar>
  );
}
