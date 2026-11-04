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
import { useCallback, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject } from '@superset-ui/core';
import { Button, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  fetchWorkspaceTrash,
  restoreDashboard,
  type WorkspaceTrashItem,
} from './api';

const List = styled.div`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    overflow: hidden;

    .row {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;

      & + .row {
        border-top: 1px solid ${theme.colorBorderSecondary};
      }
    }

    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit}px;
    }

    .title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${theme.colorText};
      font-weight: 600;
    }

    .when,
    .blocked {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }

    .blocked {
      color: ${theme.colorWarningText};
    }
  `}
`;

const Title = styled.h2`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit * 10}px 0 ${theme.sizeUnit * 4}px;
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

interface WorkspaceTrashProps {
  workspaceId: number;
  /** Called after a dashboard comes back, to refresh the page */
  onRestored: () => void;
}

/**
 * The deleted dashboards of a workspace, like a recycle bin: contributors bring
 * them back here. A dashboard whose charts moved to another dashboard while it
 * was deleted cannot return (a chart belongs to one dashboard), and says why.
 * Renders nothing while the trash is empty.
 */
export function WorkspaceTrash({
  workspaceId,
  onRestored,
}: WorkspaceTrashProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const [items, setItems] = useState<WorkspaceTrashItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchWorkspaceTrash(workspaceId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [workspaceId]);

  useEffect(load, [load]);

  const restore = async (item: WorkspaceTrashItem) => {
    setBusy(item.uuid);
    try {
      await restoreDashboard(item.uuid);
      addSuccessToast(t('%s was restored', item.dashboard_title));
      onRestored();
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(
        message || t('%s could not be restored', item.dashboard_title),
      );
    } finally {
      setBusy(null);
      load();
    }
  };

  if (!items.length) {
    return null;
  }
  return (
    <>
      <Title>{t('Trash')}</Title>
      <List data-test="workspace-trash">
        {items.map(item => (
          <div className="row" key={item.uuid} data-test="workspace-trash-row">
            <Icons.DeleteOutlined iconSize="m" />
            <div className="info">
              <span className="title" title={item.dashboard_title}>
                {item.dashboard_title}
              </span>
              <span className="when">
                {t('Deleted %s', item.deleted_at_delta_humanized)}
              </span>
              {item.blocked_by && (
                <span className="blocked">
                  {t(
                    'It cannot be restored: %s. Remove those charts from their current dashboard first.',
                    item.blocked_by,
                  )}
                </span>
              )}
            </div>
            <Tooltip
              title={
                item.blocked_by
                  ? t('Some of its charts now belong to another dashboard')
                  : undefined
              }
            >
              <span>
                <Button
                  buttonStyle="secondary"
                  buttonSize="small"
                  icon={<Icons.RollbackOutlined iconSize="m" />}
                  loading={busy === item.uuid}
                  disabled={!!item.blocked_by || !!busy}
                  onClick={() => restore(item)}
                  data-test="workspace-trash-restore"
                >
                  {t('Restore')}
                </Button>
              </span>
            </Tooltip>
          </div>
        ))}
      </List>
    </>
  );
}
