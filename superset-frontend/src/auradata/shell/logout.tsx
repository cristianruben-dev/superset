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
import { useCallback } from 'react';
import { CACHE_KEY } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Modal } from '@superset-ui/core/components';
import { navigateTo } from 'src/utils/navigationUtils';

/**
 * Forgets what this browser kept of the session: the stored Redux state, the
 * login attempt mark and the cached GET responses (best effort, the page
 * leaves before the cache promise settles).
 */
export function clearSessionData() {
  try {
    window.localStorage.removeItem('redux');
    window.sessionStorage.removeItem('login_attempted');
    if (typeof caches !== 'undefined') {
      caches.delete(CACHE_KEY).catch(() => {
        /* best effort */
      });
    }
  } catch (error) {
    console.warn('Failed to clear storage on logout:', error);
  }
}

/**
 * Asks before logging out, then clears the session data and leaves. The holder
 * draws the question inside the app, so it takes the theme of the app.
 */
export function useConfirmLogout(logoutUrl: string | undefined) {
  const [modal, holder] = Modal.useModal();
  const confirmLogout = useCallback(() => {
    if (!logoutUrl) return;
    modal.confirm({
      title: t('Log out?'),
      content: t('You will need to sign in again to keep working.'),
      okText: t('Log out'),
      cancelText: t('Cancel'),
      onOk: () => {
        clearSessionData();
        navigateTo(logoutUrl, { assign: true });
      },
    });
  }, [logoutUrl, modal]);
  return [confirmLogout, holder] as const;
}
