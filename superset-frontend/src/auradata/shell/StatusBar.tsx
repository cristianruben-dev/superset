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
import { t } from '@apache-superset/core/translation';
import { css, styled, ThemeMode } from '@apache-superset/core/theme';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import { useThemeContext } from 'src/theme/ThemeProvider';
import { usePageStatusItems } from './pageStatus';

/** The height of the status bar, which the sidebar leaves under itself. */
export const STATUS_BAR_HEIGHT = 24;

// How often the server is asked whether it is up
const CHECK_EVERY_MS = 60_000;

const Bar = styled.footer`
  ${({ theme }) => css`
    position: fixed;
    inset: auto 0 0 0;
    z-index: 105;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 4}px;
    height: ${STATUS_BAR_HEIGHT}px;
    padding: 0 ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgLayout};
    border-top: 1px solid ${theme.colorBorderSecondary};
    font-family: ${theme.fontFamilyCode};
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: ${theme.colorTextTertiary};
    white-space: nowrap;
    overflow: hidden;

    .group {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 4}px;
      min-width: 0;
    }

    .end {
      margin-left: auto;
    }

    .item + .item {
      padding-left: ${theme.sizeUnit * 4}px;
      border-left: 1px solid ${theme.colorBorderSecondary};
    }

    .state {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit * 1.5}px;
      color: ${theme.colorTextSecondary};
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${theme.colorSuccess};
    }

    .state.offline .dot {
      background: ${theme.colorError};
    }

    /* Phones only keep the state of the connection */
    @media (max-width: 767px) {
      .page,
      .end {
        display: none;
      }
    }
  `}
`;

const timeOf = (date: Date, locale?: string) =>
  date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/** Whether the server answers, checked now and then and when the network changes. */
const useServerState = () => {
  const [online, setOnline] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!navigator.onLine) {
        setOnline(false);
        return;
      }
      try {
        const response = await fetch(ensureAppRoot('/health'), {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (cancelled) return;
        setOnline(response.ok);
        if (response.ok) setCheckedAt(new Date());
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
    };
  }, []);
  return { online, checkedAt };
};

/**
 * The status bar at the bottom of the window, as a desktop application: the
 * state of the server, figures of the page (`usePageStatus`), the language and
 * the theme.
 */
export function StatusBar({ locale }: { locale?: string }) {
  const { online, checkedAt } = useServerState();
  const items = usePageStatusItems();
  const { themeMode } = useThemeContext();
  const theme =
    themeMode === ThemeMode.DARK
      ? t('Dark')
      : themeMode === ThemeMode.SYSTEM
        ? t('Match system')
        : t('Light');

  return (
    <Bar role="status" aria-live="polite" data-test="auradata-status-bar">
      <div className="group">
        <span
          className={`item state ${online ? 'online' : 'offline'}`}
          title={
            checkedAt
              ? t('Last checked at %s', timeOf(checkedAt, locale))
              : undefined
          }
        >
          <span className="dot" aria-hidden />
          {online ? t('Connected') : t('No connection')}
        </span>
        {items.map(item => (
          <span key={item} className="item page">
            {item}
          </span>
        ))}
      </div>
      <div className="group end">
        {checkedAt && (
          <span className="item">
            {t('Synced %s', timeOf(checkedAt, locale))}
          </span>
        )}
        {locale && <span className="item">{locale.toUpperCase()}</span>}
        <span className="item">{theme}</span>
      </div>
    </Bar>
  );
}
