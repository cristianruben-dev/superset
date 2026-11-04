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
import { useEffect, useMemo, useState } from 'react';
import rison from 'rison';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { Input, Loading, Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { fetchWorkspaces, moveDashboards, type Workspace } from './api';
import { WorkspaceAvatar } from './WorkspaceAvatar';

interface DashboardRow {
  id: number;
  dashboard_title: string;
  changed_on_delta_humanized: string;
}

const List = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    max-height: 380px;
    margin-top: ${theme.sizeUnit * 3}px;
    overflow-y: auto;

    .row {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 2.5}px ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadius}px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background ${theme.motionDurationFast};

      &:hover {
        background: ${theme.colorFillTertiary};
      }

      &[aria-checked='true'] {
        background: ${theme.colorPrimaryBg};
        border-color: ${theme.colorPrimaryBorder};
      }

      &[aria-disabled='true'] {
        cursor: default;
        opacity: 0.6;
      }

      &:focus-visible {
        outline: 2px solid ${theme.colorPrimaryBorder};
      }
    }

    .check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 1.5px solid ${theme.colorBorder};
      color: ${theme.colorTextLightSolid};
      font-size: 11px;
    }

    [aria-checked='true'] .check {
      background: ${theme.colorPrimary};
      border-color: ${theme.colorPrimary};
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};
    }

    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;

      .title {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .meta {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
      }
    }

    .where {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit * 1.5}px;
      flex-shrink: 0;
      max-width: 160px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};

      span:last-child {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .empty {
      padding: ${theme.sizeUnit * 8}px 0;
      text-align: center;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

export interface AddDashboardsModalProps {
  show: boolean;
  workspace: Workspace;
  onHide: () => void;
  onAdded: (workspace: Workspace) => void;
}

/** Pick existing dashboards and move them into a workspace. */
export function AddDashboardsModal({
  show,
  workspace,
  onHide,
  onAdded,
}: AddDashboardsModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const [search, setSearch] = useState('');
  const [dashboards, setDashboards] = useState<DashboardRow[] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setSelected(new Set());
    setSearch('');
    fetchWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, [show]);

  useEffect(() => {
    if (!show) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/?q=${rison.encode({
          filters: search
            ? [{ col: 'dashboard_title', opr: 'title_or_slug', value: search }]
            : [],
          columns: ['id', 'dashboard_title', 'changed_on_delta_humanized'],
          order_column: 'changed_on_delta_humanized',
          order_direction: 'desc',
          page_size: 100,
        })}`,
      })
        .then(({ json }) => {
          if (!cancelled) setDashboards(json.result as DashboardRow[]);
        })
        .catch(() => {
          if (!cancelled) setDashboards([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [show, search]);

  const homeOf = useMemo(() => {
    const map = new Map<number, Workspace>();
    workspaces.forEach(ws => ws.dashboard_ids.forEach(id => map.set(id, ws)));
    return map;
  }, [workspaces]);

  // Dashboards already in this workspace go last: they cannot be picked
  const sorted = useMemo(
    () =>
      [...(dashboards || [])].sort(
        (a, b) =>
          Number(homeOf.get(a.id)?.id === workspace.id) -
          Number(homeOf.get(b.id)?.id === workspace.id),
      ),
    [dashboards, homeOf, workspace.id],
  );

  const toggle = (id: number) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await moveDashboards(workspace.id, {
        add: [...selected],
      });
      addSuccessToast(
        tn(
          '%s dashboard added to %s',
          '%s dashboards added to %s',
          selected.size,
          selected.size,
          workspace.name,
        ),
      );
      onAdded(updated);
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(message || t('The dashboards could not be added'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      name="add-dashboards"
      title={t('Add dashboards to %s', workspace.name)}
      width="560px"
      primaryButtonName={
        selected.size
          ? tn(
              'Add %s dashboard',
              'Add %s dashboards',
              selected.size,
              selected.size,
            )
          : t('Add')
      }
      primaryButtonLoading={saving}
      disablePrimaryButton={!selected.size || saving}
      onHandledPrimaryAction={save}
      destroyOnHidden
    >
      <Input
        allowClear
        prefix={<Icons.SearchOutlined iconSize="m" />}
        placeholder={t('Search dashboards')}
        value={search}
        onChange={event => setSearch(event.target.value)}
        autoFocus
      />
      <List role="listbox" aria-multiselectable data-test="add-dashboards-list">
        {dashboards === null && <Loading position="inline-centered" />}
        {dashboards?.length === 0 && (
          <div className="empty">{t('No dashboards found')}</div>
        )}
        {sorted.map(dashboard => {
          const home = homeOf.get(dashboard.id);
          const here = home?.id === workspace.id;
          const checked = here || selected.has(dashboard.id);
          return (
            <button
              key={dashboard.id}
              type="button"
              role="option"
              className="row"
              aria-checked={checked}
              aria-selected={checked}
              aria-disabled={here}
              onClick={() => !here && toggle(dashboard.id)}
            >
              <span className="check">
                {checked && <Icons.CheckOutlined iconSize="s" />}
              </span>
              <span className="icon">
                <Icons.DashboardOutlined iconSize="m" />
              </span>
              <span className="text">
                <span className="title">{dashboard.dashboard_title}</span>
                <span className="meta">
                  {t('Modified %s', dashboard.changed_on_delta_humanized)}
                </span>
              </span>
              {home && (
                <span
                  className="where"
                  title={
                    here
                      ? t('Already in this workspace')
                      : t('Moves from %s', home.name)
                  }
                >
                  <WorkspaceAvatar workspace={home} size="s" />
                  <span>{here ? t('Already here') : home.name}</span>
                </span>
              )}
            </button>
          );
        })}
      </List>
    </Modal>
  );
}
