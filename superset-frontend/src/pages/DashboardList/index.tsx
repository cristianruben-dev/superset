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
import {
  isFeatureEnabled,
  FeatureFlag,
  SupersetClient,
} from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/theme';
import { useSelector } from 'react-redux';
import { useState, useMemo, useCallback, useRef } from 'react';
import rison from 'rison';
import {
  createFetchEditors,
  createErrorHandler,
  handleDashboardDelete,
} from 'src/views/CRUD/utils';
import Subject from 'src/types/Subject';
import { SUBJECT_OPTION_FILTER_PROPS } from 'src/features/subjects/SubjectSelectLabel';
import { useListViewResource, useFavoriteStatus } from 'src/views/CRUD/hooks';
import { useIsMobile } from 'src/hooks/useIsMobile';
import {
  Button,
  ConfirmStatusChange,
  DeleteModal,
  Loading,
  Tooltip,
} from '@superset-ui/core/components';
import {
  TagType,
  ImportModal as ImportModelsModal,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilter,
  type ListViewFilters,
} from 'src/components';
import handleResourceExport from 'src/utils/export';
import {
  archiveConfirmDescription,
  deleteActionLabel,
} from 'src/utils/softDeleteCopy';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { dangerouslyGetItemDoNotUse } from 'src/utils/localStorageHelpers';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Icons } from '@superset-ui/core/components/Icons';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';

import Dashboard from 'src/dashboard/containers/Dashboard';
import {
  Dashboard as CRUDDashboard,
  QueryObjectColumns,
} from 'src/views/CRUD/types';
import DashboardCard from 'src/features/dashboards/DashboardCard';
import { useDashboardPreviews } from 'src/auradata/dashboards';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { findPermission } from 'src/utils/findPermission';
import { navigateTo } from 'src/utils/navigationUtils';
import { useDashboardRowMenu } from 'src/auradata/dashboards/rowMenu';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';

const PAGE_SIZE = 25;
const PASSWORDS_NEEDED_MESSAGE = t(
  'The passwords for the databases below are needed in order to ' +
    'import them together with the dashboards. Please note that the ' +
    '"Secure Extra" and "Certificate" sections of ' +
    'the database configuration are not present in export files, and ' +
    'should be added manually after the import if they are needed.',
);
const CONFIRM_OVERWRITE_MESSAGE = t(
  'You are importing one or more dashboards that already exist. ' +
    'Overwriting might cause you to lose some of your work. Are you ' +
    'sure you want to overwrite?',
);

interface DashboardListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user?: UserWithPermissionsAndRoles;
}

export interface Dashboard {
  changed_by_name: string;
  changed_on_delta_humanized: string;
  changed_by: string;
  changed_on?: string;
  dashboard_title: string;
  id: number;
  published: boolean;
  url: string;
  changed_on_utc?: string;
  description?: string;
  thumbnail_url?: string | null;
  editors?: Subject[];
  // Bare subject ids from a deployment's EXTRA_EDITORS_RESOLVER.
  extra_editors?: number[];
  viewers?: Subject[];
  tags: TagType[];
  created_by: object;
}

const DASHBOARD_COLUMNS_TO_FETCH = [
  'id',
  'dashboard_title',
  'published',
  'url',
  'slug',
  'description',
  'changed_by',
  'changed_by.id',
  'changed_by.first_name',
  'changed_by.last_name',
  'changed_on_delta_humanized',
  'editors.id',
  'editors.label',
  'editors.img',
  'editors.type',
  'tags.id',
  'tags.name',
  'tags.type',
  'status',
  'certified_by',
  'certification_details',
  'changed_on_utc',
  ...(isFeatureEnabled(FeatureFlag.EnableViewers)
    ? ['viewers.id', 'viewers.label', 'viewers.img', 'viewers.type']
    : []),
];

function DashboardList(props: DashboardListProps) {
  const { addDangerToast, addSuccessToast, user } = props;
  const isMobile = useIsMobile();
  const theme = useTheme();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // Tracks the pending "+ Dashboard" navigation: /dashboard/new/ is a hard
  // navigation (window.location.assign) whose GET creates the dashboard
  // server-side before redirecting to the editor, so the click can look dead
  // for the whole round-trip on large instances. Flipping the button into its
  // loading state gives immediate feedback until the page unloads.
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const { roles } = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const canReadTag = findPermission('can_read', 'Tag', roles);

  const {
    state: {
      loading,
      resourceCount: dashboardCount,
      resourceCollection: dashboards,
    },
    setResourceCollection: setDashboards,
    hasPerm,
    fetchData,
    refreshData,
  } = useListViewResource<Dashboard>(
    'dashboard',
    t('dashboard'),
    addDangerToast,
    undefined,
    undefined,
    undefined,
    undefined,
    DASHBOARD_COLUMNS_TO_FETCH,
  );
  const dashboardIds = useMemo(() => dashboards.map(d => d.id), [dashboards]);
  const previews = useDashboardPreviews(dashboardIds);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'dashboard',
    dashboardIds,
    addDangerToast,
  );

  const [dashboardToEdit, setDashboardToEdit] = useState<Dashboard | null>(
    null,
  );
  const [dashboardToDelete, setDashboardToDelete] =
    useState<CRUDDashboard | null>(null);

  const [importingDashboard, showImportModal] = useState<boolean>(false);
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [sshTunnelPasswordFields, setSSHTunnelPasswordFields] = useState<
    string[]
  >([]);
  const [sshTunnelPrivateKeyFields, setSSHTunnelPrivateKeyFields] = useState<
    string[]
  >([]);
  const [
    sshTunnelPrivateKeyPasswordFields,
    setSSHTunnelPrivateKeyPasswordFields,
  ] = useState<string[]>([]);

  const openDashboardImportModal = () => {
    showImportModal(true);
  };

  const closeDashboardImportModal = () => {
    showImportModal(false);
  };

  const handleDashboardImport = () => {
    showImportModal(false);
    refreshData();
    addSuccessToast(t('Dashboard imported'));
  };

  // TODO: Fix usage of localStorage keying on the user id
  const userKey =
    user?.userId === undefined
      ? null
      : dangerouslyGetItemDoNotUse(user.userId.toString(), null);

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  // When soft-delete is on, deleting archives the dashboard (recoverable), so
  // the confirmation drops the type-DELETE friction and explains the archive.
  const softDelete = isFeatureEnabled(FeatureFlag.SoftDelete);
  const canExport = hasPerm('can_export');

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  const openDashboardEditModal = useCallback((dashboard: Dashboard) => {
    setDashboardToEdit(dashboard);
  }, []);

  function handleDashboardEdit(edits: Dashboard) {
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/${edits.id}`,
    }).then(
      ({ json = {} }) => {
        setDashboards(
          dashboards.map(dashboard => {
            if (dashboard.id === json?.result?.id) {
              const {
                changed_by_name: changedByName,
                changed_by: changedBy,
                dashboard_title: dashboardTitle = '',
                slug = '',
                description = '',
                json_metadata: jsonMetadata = '',
                changed_on_delta_humanized: changedOnDeltaHumanized,
                url = '',
                certified_by: certifiedBy = '',
                certification_details: certificationDetails = '',
                editors,
                viewers,
                tags,
              } = json.result;
              return {
                ...dashboard,
                changed_by_name: changedByName,
                changed_by: changedBy,
                dashboard_title: dashboardTitle,
                slug,
                description,
                json_metadata: jsonMetadata,
                changed_on_delta_humanized: changedOnDeltaHumanized,
                url,
                certified_by: certifiedBy,
                certification_details: certificationDetails,
                editors,
                viewers,
                tags,
              };
            }
            return dashboard;
          }),
        );
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('An error occurred while fetching dashboards: %s', errMsg),
        ),
      ),
    );
  }

  const handleBulkDashboardExport = useCallback(
    async (dashboardsToExport: Dashboard[]) => {
      const ids = dashboardsToExport.map(({ id }) => id);
      setPreparingExport(true);
      try {
        await handleResourceExport('dashboard', ids, () => {
          setPreparingExport(false);
        });
      } catch (error) {
        setPreparingExport(false);
        addDangerToast(
          t('There was an issue exporting the selected dashboards'),
        );
      }
    },
    [addDangerToast],
  );

  function handleBulkDashboardDelete(dashboardsToDelete: Dashboard[]) {
    return SupersetClient.delete({
      endpoint: `/api/v1/dashboard/?q=${rison.encode(
        dashboardsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(
          softDelete
            ? t('Archived %s item(s)', dashboardsToDelete.length)
            : json.message,
        );
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          softDelete
            ? t(
                'There was an issue archiving the selected dashboards: %s',
                errMsg,
              )
            : t(
                'There was an issue deleting the selected dashboards: %s',
                errMsg,
              ),
        ),
      ),
    );
  }

  const columns = useMemo(
    () =>
      [
        'id',
        'dashboard_title',
        'published',
        'tags',
        'editors',
        'viewers',
        'changed_on_delta_humanized',
        QueryObjectColumns.ChangedBy,
      ].map(id => ({ id, accessor: id, hidden: true })),
    [],
  );

  const favoritesFilter: ListViewFilter = useMemo(
    () => ({
      Header: t('Favorite'),
      key: 'favorite',
      id: 'id',
      urlDisplay: 'favorite',
      input: 'select',
      operator: FilterOperator.DashboardIsFav,
      unfilteredLabel: t('Any'),
      selects: [
        { label: t('Yes'), value: true },
        { label: t('No'), value: false },
      ],
    }),
    [],
  );

  const filters: ListViewFilters = useMemo(() => {
    const filtersList = [
      {
        Header: t('Name'),
        key: 'search',
        id: 'dashboard_title',
        input: 'search',
        operator: FilterOperator.TitleOrSlug,
      },
      {
        Header: t('Status'),
        key: 'published',
        id: 'published',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Published'), value: true },
          { label: t('Draft'), value: false },
        ],
      },
      {
        Header: t('Editor'),
        key: 'editor',
        id: 'editors',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchEditors(
          'dashboard',
          createErrorHandler(errMsg =>
            addDangerToast(
              t(
                'An error occurred while fetching dashboard editor values: %s',
                errMsg,
              ),
            ),
          ),
          user,
        ),
        optionFilterProps: SUBJECT_OPTION_FILTER_PROPS,
        paginate: true,
        popupStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      ...(user?.userId ? [favoritesFilter] : []),
      {
        Header: t('Certified'),
        key: 'certified',
        id: 'id',
        urlDisplay: 'certified',
        input: 'select',
        operator: FilterOperator.DashboardIsCertified,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
    ] as ListViewFilters;
    return filtersList;
  }, [addDangerToast, canReadTag, favoritesFilter, user]);

  const sortTypes = [
    {
      desc: false,
      id: 'dashboard_title',
      label: t('Alphabetical'),
      value: 'alphabetical',
    },
    {
      desc: true,
      id: 'changed_on_delta_humanized',
      label: t('Recently modified'),
      value: 'recently_modified',
    },
    {
      desc: false,
      id: 'changed_on_delta_humanized',
      label: t('Least recently modified'),
      value: 'least_recently_modified',
    },
  ];

  // AuraData BI: the menu of a right click on a row; deleting asks through the
  // confirmation of the bulk delete, rendered further down
  const confirmDeleteRef = useRef<(rows: Dashboard[]) => void>();
  const rowMenu = useDashboardRowMenu<Dashboard>({
    canEdit,
    canExport,
    canDelete,
    isStarred: id => !!favoriteStatus[id],
    toggleStar: saveFavoriteStatus,
    onEdit: openDashboardEditModal,
    onExport: row => handleBulkDashboardExport([row]),
    onDelete: row => confirmDeleteRef.current?.([row]),
    onMoved: refreshData,
    addSuccessToast,
    addDangerToast,
  });

  const renderCard = useCallback(
    (dashboard: Dashboard) => (
      <DashboardCard
        dashboard={dashboard}
        hasPerm={hasPerm}
        showThumbnails={
          userKey
            ? userKey.thumbnails
            : isFeatureEnabled(FeatureFlag.Thumbnails)
        }
        user={user}
        loading={loading}
        openDashboardEditModal={openDashboardEditModal}
        saveFavoriteStatus={saveFavoriteStatus}
        favoriteStatus={favoriteStatus[dashboard.id]}
        handleBulkDashboardExport={handleBulkDashboardExport}
        onDelete={dashboard => setDashboardToDelete(dashboard)}
        preview={previews[dashboard.id]}
      />
    ),
    [
      previews,
      favoriteStatus,
      hasPerm,
      loading,
      user,
      saveFavoriteStatus,
      userKey,
      handleBulkDashboardExport,
      openDashboardEditModal,
    ],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <Tooltip
          id="import-tooltip"
          title={t('Import dashboards')}
          placement="bottomRight"
        >
          <Icons.DownloadOutlined iconSize="l" data-test="import-button" />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openDashboardImportModal,
    });
  }

  if (canCreate) {
    subMenuButtons.push({
      icon: <Icons.PlusOutlined iconSize="m" />,
      name: t('Dashboard'),
      buttonStyle: 'primary',
      loading: creatingDashboard,
      onClick: () => {
        setCreatingDashboard(true);
        navigateTo('/dashboard/new/', { assign: true });
      },
    });
  }
  return (
    <>
      <SubMenu
        name={t('Dashboards')}
        buttons={subMenuButtons}
        leftIcon={
          isMobile ? (
            <Button
              buttonStyle="link"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label={t('Search')}
              css={css`
                padding: 0;
                margin-right: ${theme.sizeUnit * 2}px;
              `}
            >
              <Icons.SearchOutlined iconSize="l" />
            </Button>
          ) : undefined
        }
      />
      <ConfirmStatusChange
        recoverable={softDelete}
        title={
          softDelete ? t('Archive selected dashboards?') : t('Please confirm')
        }
        description={
          softDelete
            ? archiveConfirmDescription(t('dashboards'), true)
            : t('Are you sure you want to delete the selected dashboards?')
        }
        onConfirm={handleBulkDashboardDelete}
      >
        {confirmDelete => {
          confirmDeleteRef.current = confirmDelete;
          const enableBulkTag = isFeatureEnabled(FeatureFlag.TaggingSystem);
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              name: deleteActionLabel(),
              type: 'danger',
              onSelect: confirmDelete,
            });
          }
          if (canExport) {
            bulkActions.push({
              key: 'export',
              name: t('Export'),
              type: 'primary',
              onSelect: handleBulkDashboardExport,
            });
          }
          return (
            <>
              {dashboardToEdit && (
                <PropertiesModal
                  dashboardId={dashboardToEdit.id}
                  show
                  onHide={() => setDashboardToEdit(null)}
                  onSubmit={handleDashboardEdit}
                />
              )}
              {dashboardToDelete && (
                <DeleteModal
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{dashboardToDelete.dashboard_title}</b>?
                    </>
                  }
                  onConfirm={() => {
                    handleDashboardDelete(
                      dashboardToDelete,
                      refreshData,
                      addSuccessToast,
                      addDangerToast,
                      undefined,
                      user?.userId,
                    );
                    setDashboardToDelete(null);
                  }}
                  onHide={() => setDashboardToDelete(null)}
                  open={!!dashboardToDelete}
                  title={t('Please confirm')}
                />
              )}
              <ListView<Dashboard>
                bulkActions={bulkActions}
                cardSortSelectOptions={sortTypes}
                className="dashboard-list-view"
                columns={columns}
                count={dashboardCount}
                data={dashboards}
                fetchData={fetchData}
                refreshData={refreshData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                pageSize={PAGE_SIZE}
                addSuccessToast={addSuccessToast}
                addDangerToast={addDangerToast}
                showThumbnails={
                  userKey
                    ? userKey.thumbnails
                    : isFeatureEnabled(FeatureFlag.Thumbnails)
                }
                renderCard={renderCard}
                // AuraData BI: dashboards are always a grid of cards
                forceViewMode="card"
                enableBulkTag={enableBulkTag}
                bulkTagResourceName="dashboard"
                mobileFiltersOpen={mobileFiltersOpen}
                setMobileFiltersOpen={
                  isMobile ? setMobileFiltersOpen : undefined
                }
                mobileFiltersDrawerTitle={t('Search Dashboards')}
                rowMenu={rowMenu}
              />
            </>
          );
        }}
      </ConfirmStatusChange>

      <ImportModelsModal
        resourceName="dashboard"
        resourceLabel={t('dashboard')}
        passwordsNeededMessage={PASSWORDS_NEEDED_MESSAGE}
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleDashboardImport}
        show={importingDashboard}
        onHide={closeDashboardImportModal}
        passwordFields={passwordFields}
        setPasswordFields={setPasswordFields}
        sshTunnelPasswordFields={sshTunnelPasswordFields}
        setSSHTunnelPasswordFields={setSSHTunnelPasswordFields}
        sshTunnelPrivateKeyFields={sshTunnelPrivateKeyFields}
        setSSHTunnelPrivateKeyFields={setSSHTunnelPrivateKeyFields}
        sshTunnelPrivateKeyPasswordFields={sshTunnelPrivateKeyPasswordFields}
        setSSHTunnelPrivateKeyPasswordFields={
          setSSHTunnelPrivateKeyPasswordFields
        }
      />

      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(DashboardList);
