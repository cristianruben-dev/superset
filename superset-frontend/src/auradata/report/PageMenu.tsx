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
import { useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { Dropdown } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { RootState } from 'src/dashboard/types';
import { setComponentMeta, updateLayout } from 'src/auradata/format/actions';
import { HIDDEN_PAGE_KEY } from 'src/auradata/present/dashboardTabs';
import { duplicatePage } from './pageActions';

/**
 * Right click on a page tab while editing: duplicate, hide, move or delete the
 * page, as in Power BI.
 */
export function PageMenu({
  pageId,
  onDelete,
  children,
}: {
  pageId: string;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const dispatch = useDispatch();
  const { addDangerToast, addSuccessToast } = useToasts();
  const [busy, setBusy] = useState(false);
  const page = useSelector(
    (state: RootState) => state.dashboardLayout.present[pageId],
  );
  const parent = useSelector(
    (state: RootState) =>
      state.dashboardLayout.present[page?.parents?.at(-1) ?? ''],
  );
  const hidden = !!page?.meta?.[HIDDEN_PAGE_KEY];
  const index = parent?.children.indexOf(pageId) ?? -1;
  const count = parent?.children.length ?? 0;

  const move = (delta: number) => {
    if (!parent) return;
    const next = [...parent.children];
    next.splice(index, 1);
    next.splice(index + delta, 0, pageId);
    dispatch(
      updateLayout(
        { [parent.id]: { ...parent, children: next } },
        `move-page:${pageId}:${Date.now()}`,
      ) as never,
    );
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      await dispatch(duplicatePage(pageId) as never);
      addSuccessToast(t('Page duplicated'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('The page could not be duplicated'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dropdown
      trigger={['contextMenu']}
      menu={{
        items: [
          {
            key: 'duplicate',
            label: t('Duplicate page'),
            disabled: busy,
            icon: <Icons.CopyOutlined iconSize="m" />,
          },
          {
            key: 'hide',
            label: hidden ? t('Show page') : t('Hide page'),
            icon: hidden ? (
              <Icons.EyeOutlined iconSize="m" />
            ) : (
              <Icons.EyeInvisibleOutlined iconSize="m" />
            ),
          },
          { type: 'divider' as const },
          {
            key: 'left',
            label: t('Move left'),
            disabled: index <= 0,
            icon: <Icons.ArrowLeftOutlined iconSize="m" />,
          },
          {
            key: 'right',
            label: t('Move right'),
            disabled: index < 0 || index >= count - 1,
            icon: <Icons.ArrowRightOutlined iconSize="m" />,
          },
          { type: 'divider' as const },
          {
            key: 'delete',
            label: t('Delete page'),
            danger: true,
            disabled: !onDelete,
            icon: <Icons.DeleteOutlined iconSize="m" />,
          },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === 'duplicate') duplicate();
          if (key === 'hide') {
            dispatch(
              setComponentMeta(
                pageId,
                HIDDEN_PAGE_KEY,
                hidden ? undefined : true,
                `hide-page:${pageId}:${Date.now()}`,
              ) as never,
            );
          }
          if (key === 'left') move(-1);
          if (key === 'right') move(1);
          if (key === 'delete') onDelete?.();
        },
      }}
    >
      {/* The trigger has to be one element */}
      <span data-test="auradata-page-menu-trigger">{children}</span>
    </Dropdown>
  );
}
