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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/theme';
import {
  Button,
  Dropdown,
  FaveStar,
  Icons,
  InfoTooltip,
  Tooltip,
} from '@superset-ui/core/components';
import { MenuItem } from '@superset-ui/core/components/Menu';
import {
  ModifiedInfo,
  TagsList,
  type AuditInfoProps,
  type TagType,
} from 'src/components';
import { TagTypeEnum } from 'src/components/Tag/TagType';
import { SubjectPile } from 'src/features/subjects/SubjectPile';
import { Dashboard } from 'src/views/CRUD/types';
import { isUserEditorOrAdmin } from 'src/dashboard/util/permissionUtils';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { DashboardCard as AuraDataDashboardCard } from 'src/auradata/dashboards';
import type { PreviewRows } from 'src/auradata/dashboards';

const menuItemButtonCss = css`
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  width: 100%;
  font: inherit;
  text-align: left;
  cursor: pointer;
`;

const People = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-left: auto;
`;

interface DashboardCardProps {
  isChart?: boolean;
  dashboard: Dashboard;
  hasPerm: (name: string) => boolean;
  loading: boolean;
  openDashboardEditModal?: (d: Dashboard) => void;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: boolean;
  user?: UserWithPermissionsAndRoles;
  showThumbnails?: boolean;
  handleBulkDashboardExport: (dashboardsToExport: Dashboard[]) => void;
  onDelete: (dashboard: Dashboard) => void;
  /** AuraData BI layout preview of the dashboard */
  preview?: PreviewRows;
}

function DashboardCard({
  dashboard,
  hasPerm,
  user,
  openDashboardEditModal,
  favoriteStatus,
  saveFavoriteStatus,
  showThumbnails,
  handleBulkDashboardExport,
  onDelete,
  preview,
}: DashboardCardProps) {
  const userId = user?.userId;
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const allowEdit = isUserEditorOrAdmin(
    user,
    dashboard.editors,
    dashboard.extra_editors,
  );
  const digest = dashboard.changed_on_utc || dashboard.changed_on;
  const thumbnailUrl =
    isFeatureEnabled(FeatureFlag.Thumbnails) && dashboard.id && digest
      ? `/api/v1/dashboard/${dashboard.id}/thumbnail/${encodeURIComponent(digest)}/`
      : '';

  const menuItems: MenuItem[] = [];

  if (canEdit && openDashboardEditModal) {
    menuItems.push({
      key: 'edit',
      label: (
        <Tooltip
          title={
            allowEdit
              ? null
              : t(
                  'You must be a dashboard editor in order to edit. Please reach out to a dashboard editor to request modifications or edit access.',
                )
          }
        >
          <button
            type="button"
            css={menuItemButtonCss}
            className="action-button"
            onClick={
              allowEdit ? () => openDashboardEditModal(dashboard) : undefined
            }
            data-test="dashboard-card-option-edit-button"
          >
            <Icons.EditOutlined iconSize="l" data-test="edit-alt" /> {t('Edit')}
          </button>
        </Tooltip>
      ),
      disabled: !allowEdit,
    });
  }

  if (canExport) {
    menuItems.push({
      key: 'export',
      label: (
        <button
          type="button"
          css={menuItemButtonCss}
          onClick={() => handleBulkDashboardExport([dashboard])}
          className="action-button"
          data-test="dashboard-card-option-export-button"
        >
          <Icons.UploadOutlined iconSize="l" /> {t('Export')}
        </button>
      ),
    });
  }

  if (canDelete) {
    menuItems.push({
      key: 'delete',
      label: (
        <Tooltip
          title={
            allowEdit
              ? null
              : t(
                  'You must be a dashboard editor in order to delete. Please reach out to a dashboard editor to request modifications or edit access.',
                )
          }
        >
          <button
            type="button"
            css={menuItemButtonCss}
            className="action-button"
            onClick={allowEdit ? () => onDelete(dashboard) : undefined}
            data-test="dashboard-card-option-delete-button"
          >
            <Icons.DeleteOutlined iconSize="l" /> {t('Delete')}
          </button>
        </Tooltip>
      ),
      disabled: !allowEdit,
    });
  }

  const customTags = (dashboard.tags ?? []).filter(
    (tag: TagType) =>
      tag.type === 'TagTypes.custom' || tag.type === TagTypeEnum.Custom,
  );
  const showTags =
    isFeatureEnabled(FeatureFlag.TaggingSystem) && customTags.length > 0;
  const showViewers =
    isFeatureEnabled(FeatureFlag.EnableViewers) && !!dashboard.viewers?.length;

  return (
    <AuraDataDashboardCard
      id={dashboard.id}
      title={dashboard.dashboard_title}
      url={dashboard.url}
      published={dashboard.published}
      modified={
        <ModifiedInfo
          date={t('Modified %s', dashboard.changed_on_delta_humanized)}
          user={dashboard.changed_by as unknown as AuditInfoProps['user']}
        />
      }
      titleHint={
        dashboard.description ? (
          <InfoTooltip tooltip={dashboard.description} />
        ) : undefined
      }
      details={
        <>
          {showTags && <TagsList tags={customTags} maxTags={3} />}
          <People data-test="dashboard-card-people">
            {showViewers && <SubjectPile subjects={dashboard.viewers ?? []} />}
            <SubjectPile subjects={dashboard.editors ?? []} />
          </People>
        </>
      }
      preview={preview}
      certifiedBy={dashboard.certified_by}
      certificationDetails={dashboard.certification_details}
      thumbnailUrl={showThumbnails && thumbnailUrl ? thumbnailUrl : null}
      actions={
        <>
          {userId && (
            <FaveStar
              itemId={dashboard.id}
              saveFaveStar={saveFavoriteStatus}
              isStarred={favoriteStatus}
            />
          )}
          {menuItems.length > 0 && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                aria-label={t('More')}
              >
                <Icons.MoreOutlined iconSize="l" />
              </Button>
            </Dropdown>
          )}
        </>
      }
    />
  );
}

export default DashboardCard;
