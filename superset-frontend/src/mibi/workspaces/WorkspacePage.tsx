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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  FeatureFlag,
  getClientErrorObject,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import {
  Button,
  DeleteModal,
  Dropdown,
  FaveStar,
  Skeleton,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useFavoriteStatus } from 'src/views/CRUD/hooks';
import { DashboardCard, useDashboardPreviews } from '../dashboards';
import { relativeTime } from '../time';
import {
  deleteWorkspace,
  fetchWorkspace,
  fetchWorkspaceDashboards,
  moveDashboards,
  type Workspace,
  type WorkspaceDashboard,
} from './api';
import { AddDashboardsModal } from './AddDashboardsModal';
import { MemberAvatars, RoleBadge } from './roles';
import { WorkspaceAccessModal } from './WorkspaceAccessModal';
import { WorkspaceAvatar, workspaceGradient } from './WorkspaceAvatar';
import { Grid, Page } from './WorkspaceListPage';
import { WorkspaceModal } from './WorkspaceModal';

const Crumbs = styled.nav`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 1.5}px;
    margin-bottom: ${theme.sizeUnit * 4}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
    min-width: 0;

    a {
      flex: none;
      color: ${theme.colorTextSecondary};
      font-weight: 500;

      &:hover {
        color: ${theme.colorPrimary};
        text-decoration: none;
      }
    }

    .current {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  `}
`;

const Hero = styled.header`
  ${({ theme }) => css`
    position: relative;
    margin-bottom: ${theme.sizeUnit * 8}px;
    border-radius: ${theme.borderRadiusLG + 4}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    overflow: hidden;

    .cover {
      position: relative;
      height: 136px;
      background-size: cover;
      background-position: center;

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(
          ${theme.colorBgContainer} 1px,
          transparent 1.2px
        );
        background-size: 16px 16px;
        opacity: 0.18;
      }
    }

    .cover.photo::before {
      content: '';
      position: absolute;
      inset: 0;
      backdrop-filter: blur(24px) saturate(1.15);
    }

    .content {
      display: flex;
      align-items: flex-end;
      gap: ${theme.sizeUnit * 5}px;
      padding: 0 ${theme.sizeUnit * 7}px ${theme.sizeUnit * 5}px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 7}px;
      border-top: 1px solid ${theme.colorBorderSecondary};
      background: ${theme.colorFillQuaternary};
    }

    .avatar {
      margin-top: -44px;
      border-radius: 24px;
      box-shadow:
        0 0 0 4px ${theme.colorBgContainer},
        ${theme.boxShadowSecondary};
    }

    .titles {
      flex: 1;
      min-width: min(240px, 100%);
      padding-top: ${theme.sizeUnit * 4}px;
    }

    h1 {
      margin: 0;
      font-size: 28px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.028em;
      line-height: 1.15;
      color: ${theme.colorText};
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .description {
      max-width: 720px;
      margin: ${theme.sizeUnit * 2}px 0 0;
      color: ${theme.colorTextSecondary};
      line-height: 1.55;
      white-space: pre-line;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.sizeUnit * 4}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};

      span {
        display: inline-flex;
        align-items: center;
        gap: ${theme.sizeUnit * 1.5}px;
      }

      strong {
        color: ${theme.colorText};
        font-weight: 600;
      }
    }

    .members-link {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      cursor: pointer;
      color: ${theme.colorTextSecondary};

      &:hover {
        color: ${theme.colorPrimary};
      }

      &:focus-visible {
        outline: 2px solid ${theme.colorPrimaryBorder};
        border-radius: 999px;
      }
    }

    .actions {
      flex-wrap: wrap;
      justify-content: flex-end;
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
    }

    .more {
      width: 32px;
      padding: 0;
    }
  `}
`;

const SectionTitle = styled.h2`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    margin: 0 0 ${theme.sizeUnit * 4}px;
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};

    .count {
      padding: 0 ${theme.sizeUnit * 2}px;
      border-radius: 999px;
      background: ${theme.colorFillSecondary};
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      line-height: 20px;
    }
  `}
`;

const EmptyDashboards = styled.div`
  ${({ theme }) => css`
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 14}px ${theme.sizeUnit * 6}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1.5px dashed ${theme.colorBorder};
    text-align: center;
    color: ${theme.colorTextSecondary};

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};
      font-size: 22px;
    }

    strong {
      color: ${theme.colorText};
      font-size: ${theme.fontSizeLG}px;
    }

    .buttons {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      margin-top: ${theme.sizeUnit * 2}px;
    }
  `}
`;

/** A workspace: its header and the dashboards that live in it. */
export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const id = Number(workspaceId);
  const history = useHistory();
  const { addDangerToast, addSuccessToast } = useToasts();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [missing, setMissing] = useState(false);
  const [dashboards, setDashboards] = useState<WorkspaceDashboard[] | null>(
    null,
  );
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [managingAccess, setManagingAccess] = useState(false);
  const [creatingDashboard, setCreatingDashboard] = useState(false);

  const dashboardIds = useMemo(
    () => (dashboards || []).map(dashboard => dashboard.id),
    [dashboards],
  );
  const previews = useDashboardPreviews(dashboardIds);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'dashboard',
    dashboardIds,
    addDangerToast,
  );

  const loadDashboards = useCallback(() => {
    fetchWorkspaceDashboards(id)
      .then(setDashboards)
      .catch(() => setDashboards([]));
  }, [id]);

  useEffect(() => {
    setWorkspace(null);
    setDashboards(null);
    fetchWorkspace(id)
      .then(setWorkspace)
      .catch(() => setMissing(true));
    loadDashboards();
  }, [id, loadDashboards]);

  const removeDashboard = async (dashboard: WorkspaceDashboard) => {
    try {
      setWorkspace(await moveDashboards(id, { remove: [dashboard.id] }));
      setDashboards(current =>
        (current || []).filter(item => item.id !== dashboard.id),
      );
      addSuccessToast(
        t('%s was removed from the workspace', dashboard.dashboard_title),
      );
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(message || t('The dashboard could not be removed'));
    }
  };

  const createDashboard = async () => {
    setCreatingDashboard(true);
    try {
      const { json } = await SupersetClient.post({
        endpoint: '/api/v1/dashboard/',
        jsonPayload: { dashboard_title: t('New dashboard') },
      });
      const dashboardId = json.id as number;
      await moveDashboards(id, { add: [dashboardId] });
      history.push(`/superset/dashboard/${dashboardId}/?edit=true`);
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(message || t('The dashboard could not be created'));
      setCreatingDashboard(false);
    }
  };

  if (missing) {
    return (
      <Page>
        <EmptyDashboards>
          <span className="icon">
            <Icons.AppstoreOutlined />
          </span>
          <strong>{t('This workspace does not exist')}</strong>
          <Link to="/workspace/list/">{t('Back to workspaces')}</Link>
        </EmptyDashboards>
      </Page>
    );
  }

  if (!workspace) {
    return (
      <Page>
        <Skeleton.Node
          active
          css={css`
            width: 100% !important;
            height: 260px !important;
            border-radius: 16px;
          `}
        />
      </Page>
    );
  }

  const cover = workspace.image_url
    ? { backgroundImage: `url("${workspace.image_url}")` }
    : { background: workspaceGradient(workspace.color, 110) };
  const canEdit = workspace.can_edit;
  const canContribute = workspace.can_contribute;

  const newDashboardButton = (
    <Button
      buttonStyle="primary"
      icon={<Icons.PlusOutlined />}
      loading={creatingDashboard}
      onClick={createDashboard}
    >
      {t('New dashboard')}
    </Button>
  );
  const addButton = (
    <Button
      buttonStyle="secondary"
      icon={<Icons.FolderAddOutlined />}
      onClick={() => setAdding(true)}
    >
      {t('Add dashboards')}
    </Button>
  );

  return (
    <Page data-test="workspace-page">
      <Crumbs aria-label={t('Breadcrumb')}>
        <Link to="/workspace/list/">{t('Workspaces')}</Link>
        <Icons.RightOutlined iconSize="xs" />
        <span className="current" title={workspace.name}>
          {workspace.name}
        </span>
      </Crumbs>

      <Hero>
        <div
          className={workspace.image_url ? 'cover photo' : 'cover'}
          style={cover}
        />
        <div className="content">
          <WorkspaceAvatar workspace={workspace} size="xl" className="avatar" />
          <div className="titles">
            <h1 title={workspace.name}>{workspace.name}</h1>
            {workspace.description && (
              <p className="description" title={workspace.description}>
                {workspace.description}
              </p>
            )}
          </div>
        </div>
        <div className="toolbar">
          <div className="meta">
            <span>
              <Icons.DashboardOutlined iconSize="m" />
              <strong>{workspace.dashboard_count}</strong>
              {workspace.dashboard_count === 1
                ? t('dashboard')
                : t('dashboards')}
            </span>
            <button
              type="button"
              className="members-link"
              onClick={() => setManagingAccess(true)}
              title={canEdit ? t('Manage access') : t('Members')}
            >
              <MemberAvatars
                members={workspace.members}
                total={workspace.member_count}
                size={22}
              />
              {tn(
                '%s member',
                '%s members',
                workspace.member_count,
                workspace.member_count,
              )}
            </button>
            {workspace.role && <RoleBadge role={workspace.role} />}
            {workspace.changed_on && (
              <span>
                <Icons.ClockCircleOutlined iconSize="m" />
                {t(
                  'Updated %s',
                  relativeTime(new Date(workspace.changed_on).getTime()),
                )}
              </span>
            )}
          </div>
          <div className="actions">
            {canContribute && addButton}
            {canContribute && newDashboardButton}
            {canEdit && (
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: [
                    {
                      key: 'access',
                      icon: <Icons.TeamOutlined />,
                      label: t('Manage access'),
                      onClick: () => setManagingAccess(true),
                    },
                    {
                      key: 'edit',
                      icon: <Icons.EditOutlined />,
                      label: t('Edit workspace'),
                      onClick: () => setEditing(true),
                    },
                    { type: 'divider' },
                    {
                      key: 'delete',
                      icon: <Icons.DeleteOutlined />,
                      danger: true,
                      label: t('Delete workspace'),
                      onClick: () => setDeleting(true),
                    },
                  ],
                }}
              >
                <Button
                  buttonStyle="secondary"
                  className="more"
                  aria-label={t('More options')}
                >
                  <Icons.EllipsisOutlined />
                </Button>
              </Dropdown>
            )}
          </div>
        </div>
      </Hero>

      <SectionTitle>
        {t('Dashboards')}
        {!!dashboards?.length && (
          <span className="count">{dashboards.length}</span>
        )}
      </SectionTitle>
      <Grid
        css={css`
          grid-template-columns: repeat(
            auto-fill,
            minmax(250px, 1fr)
          ) !important;
        `}
      >
        {dashboards === null &&
          Array.from({ length: 3 }, (_, index) => (
            <Skeleton.Node
              key={index}
              active
              css={css`
                width: 100% !important;
                height: 222px !important;
                border-radius: 12px;
              `}
            />
          ))}
        {dashboards?.length === 0 && (
          <EmptyDashboards>
            <span className="icon">
              <Icons.DashboardOutlined />
            </span>
            <strong>{t('This workspace has no dashboards yet')}</strong>
            <span>
              {canContribute
                ? t('Create a dashboard here or bring existing ones.')
                : t('Its dashboards will show up here.')}
            </span>
            {canContribute && (
              <div className="buttons">
                {addButton}
                {newDashboardButton}
              </div>
            )}
          </EmptyDashboards>
        )}
        {dashboards?.map(dashboard => (
          <DashboardCard
            key={dashboard.id}
            id={dashboard.id}
            title={dashboard.dashboard_title}
            url={dashboard.url}
            published={dashboard.published}
            modified={t('Modified %s', dashboard.changed_on_delta_humanized)}
            preview={previews[dashboard.id]}
            thumbnailUrl={
              isFeatureEnabled(FeatureFlag.Thumbnails)
                ? dashboard.thumbnail_url
                : null
            }
            actions={
              <>
                <FaveStar
                  itemId={dashboard.id}
                  saveFaveStar={saveFavoriteStatus}
                  isStarred={!!favoriteStatus[dashboard.id]}
                />
                {canContribute && (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'remove',
                          icon: <Icons.MinusCircleOutlined />,
                          label: t('Remove from workspace'),
                          onClick: () => removeDashboard(dashboard),
                        },
                      ],
                    }}
                  >
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      aria-label={t('More options')}
                    >
                      <Icons.MoreOutlined iconSize="l" />
                    </Button>
                  </Dropdown>
                )}
              </>
            }
          />
        ))}
      </Grid>

      <WorkspaceModal
        show={editing}
        workspace={workspace}
        onHide={() => setEditing(false)}
        onSaved={saved => {
          setEditing(false);
          setWorkspace(saved);
        }}
      />
      <AddDashboardsModal
        show={adding}
        workspace={workspace}
        onHide={() => setAdding(false)}
        onAdded={updated => {
          setAdding(false);
          setWorkspace(updated);
          loadDashboards();
        }}
      />
      <WorkspaceAccessModal
        show={managingAccess}
        workspace={workspace}
        onHide={() => setManagingAccess(false)}
        onChanged={updated => {
          if (updated) {
            setWorkspace(updated);
          } else {
            history.push('/workspace/list/');
          }
        }}
      />
      <DeleteModal
        open={deleting}
        title={t('Delete workspace?')}
        description={t(
          'The workspace %s will be deleted. Its dashboards are kept and stay available in the dashboard list.',
          workspace.name,
        )}
        onHide={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await deleteWorkspace(id);
            addSuccessToast(t('Workspace deleted'));
            history.push('/workspace/list/');
          } catch (error) {
            const { error: message } = await getClientErrorObject(error);
            addDangerToast(message || t('The workspace could not be deleted'));
          }
        }}
      />
    </Page>
  );
}
