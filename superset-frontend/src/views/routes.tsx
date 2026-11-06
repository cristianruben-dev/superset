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

import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  lazy,
  ComponentType,
  ComponentProps,
  LazyExoticComponent,
} from 'react';
import { Redirect } from 'react-router-dom';
import ExploreGate from 'src/auradata/ExploreGate';
import { panelOnly } from 'src/auradata/PanelGate';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { stripAppRoot } from 'src/utils/navigationUtils';
import { RoutePaths } from './routePaths';

// not lazy loaded since this is the home page.
import Home from 'src/pages/Home';

// The pages that build a report open from the side panel of a dashboard
const DATA_FALLBACK = '/workspace/list/';
const SQL_FALLBACK = '/dashboard/list/';

const ChartCreation = lazy(
  () =>
    import(/* webpackChunkName: "ChartCreation" */ 'src/pages/ChartCreation'),
);

const AlertReportList = lazy(
  () =>
    import(
      /* webpackChunkName: "AlertReportList" */ 'src/pages/AlertReportList'
    ),
);

const ArchivedList = lazy(
  () => import(/* webpackChunkName: "ArchivedList" */ 'src/pages/ArchivedList'),
);

const WorkspaceList = lazy(
  () =>
    import(
      /* webpackChunkName: "WorkspaceList" */ 'src/auradata/workspaces/WorkspaceListPage'
    ),
);

const WorkspacePage = lazy(
  () =>
    import(
      /* webpackChunkName: "WorkspacePage" */ 'src/auradata/workspaces/WorkspacePage'
    ),
);

const DatasetPage = lazy(
  () =>
    import(
      /* webpackChunkName: "DatasetPage" */ 'src/auradata/data/DatasetPage'
    ),
);

const DataPage = lazy(
  () => import(/* webpackChunkName: "DataPage" */ 'src/auradata/data/DataPage'),
);

const DashboardList = lazy(
  () =>
    import(/* webpackChunkName: "DashboardList" */ 'src/pages/DashboardList'),
);

const Dashboard = lazy(
  () => import(/* webpackChunkName: "Dashboard" */ 'src/pages/Dashboard'),
);

const DatabaseList = lazy(
  () => import(/* webpackChunkName: "DatabaseList" */ 'src/pages/DatabaseList'),
);

const DatasetList = lazy(
  () => import(/* webpackChunkName: "DatasetList" */ 'src/pages/DatasetList'),
);

const DatasetCreation = lazy(
  () =>
    import(
      /* webpackChunkName: "DatasetCreation" */ 'src/pages/DatasetCreation'
    ),
);

const ExecutionLogList = lazy(
  () =>
    import(
      /* webpackChunkName: "ExecutionLogList" */ 'src/pages/ExecutionLogList'
    ),
);

const ChartPage = lazy(
  () => import(/* webpackChunkName: "Chart" */ 'src/pages/Chart'),
);

// Explore only runs inside the chart editor panel of a dashboard
const Chart = () => (
  <ExploreGate>
    <ChartPage />
  </ExploreGate>
);

const QueryHistoryList = lazy(
  () =>
    import(
      /* webpackChunkName: "QueryHistoryList" */ 'src/pages/QueryHistoryList'
    ),
);

const SavedQueryList = lazy(
  () =>
    import(/* webpackChunkName: "SavedQueryList" */ 'src/pages/SavedQueryList'),
);

const SqlLab = lazy(
  () => import(/* webpackChunkName: "SqlLab" */ 'src/pages/SqlLab'),
);

const AllEntities = lazy(
  () => import(/* webpackChunkName: "AllEntities" */ 'src/pages/AllEntities'),
);

const Tags = lazy(
  () => import(/* webpackChunkName: "Tags" */ 'src/pages/Tags'),
);

const Extensions = lazy(
  () => import(/* webpackChunkName: "Tags" */ 'src/extensions/ExtensionsList'),
);

const RowLevelSecurityList = lazy(
  () =>
    import(
      /* webpackChunkName: "RowLevelSecurityList" */ 'src/pages/RowLevelSecurityList'
    ),
);

const TaskList = lazy(
  () => import(/* webpackChunkName: "TaskList" */ 'src/pages/TaskList'),
);

const RolesList = lazy(
  () => import(/* webpackChunkName: "RolesList" */ 'src/pages/RolesList'),
);

const UsersList: LazyExoticComponent<any> = lazy(
  () => import(/* webpackChunkName: "UsersList" */ 'src/pages/UsersList'),
);

const UserInfo = lazy(
  () => import(/* webpackChunkName: "UserInfo" */ 'src/pages/UserInfo'),
);
const ConnectAiPage = lazy(
  () =>
    import(
      /* webpackChunkName: "ConnectAiPage" */ 'src/auradata/connectAi/ConnectAiPage'
    ),
);
const AssistantSettingsPage = lazy(
  () =>
    import(
      /* webpackChunkName: "AssistantSettingsPage" */ 'src/auradata/assistant/AssistantSettingsPage'
    ),
);
const DocumentPage = lazy(
  () =>
    import(
      /* webpackChunkName: "DocumentPage" */ 'src/auradata/assistant/DocumentPage'
    ),
);
const ActionLogList: LazyExoticComponent<any> = lazy(
  () => import(/* webpackChunkName: "ActionLogList" */ 'src/pages/ActionLog'),
);

const Login = lazy(
  () => import(/* webpackChunkName: "Login" */ 'src/pages/Login'),
);

const Register = lazy(
  () => import(/* webpackChunkName: "Register" */ 'src/pages/Register'),
);

const UserRegistrations = lazy(
  () =>
    import(
      /* webpackChunkName: "UserRegistrations" */ 'src/pages/UserRegistrations'
    ),
);

const FileHandler = lazy(
  () => import(/* webpackChunkName: "FileHandler" */ 'src/pages/FileHandler'),
);

const RedirectWarning = lazy(
  () =>
    import(
      /* webpackChunkName: "RedirectWarning" */ 'src/pages/RedirectWarning'
    ),
);

type Routes = {
  path: string;
  Component: ComponentType;
  Fallback?: ComponentType;
  props?: ComponentProps<any>;
  /**
   * Marks a route as usable in the mobile consumption-only experience.
   * Routes without this flag show the MobileUnsupported screen on small
   * screens when MOBILE_CONSUMPTION_MODE is enabled.
   */
  mobileSupported?: boolean;
}[];

export const routes: Routes = [
  {
    path: RoutePaths.REDIRECT,
    Component: RedirectWarning,
    mobileSupported: true,
  },
  { path: RoutePaths.LOGIN, Component: Login, mobileSupported: true },
  {
    path: RoutePaths.REGISTER_ACTIVATION,
    Component: Register,
    mobileSupported: true,
  },
  { path: RoutePaths.REGISTER, Component: Register, mobileSupported: true },
  { path: RoutePaths.LOGOUT, Component: Login, mobileSupported: true },
  { path: RoutePaths.HOME, Component: Home, mobileSupported: true },
  { path: RoutePaths.FILE_HANDLER, Component: FileHandler },
  { path: '/workspace/list/', Component: WorkspaceList },
  { path: '/workspace/:workspaceId/', Component: WorkspacePage },
  { path: '/data/dataset/:datasetId/', Component: DatasetPage },
  { path: '/data/', Component: panelOnly(DataPage, DATA_FALLBACK) },
  {
    path: RoutePaths.DASHBOARD_LIST,
    Component: DashboardList,
    mobileSupported: true,
  },
  { path: RoutePaths.DASHBOARD, Component: Dashboard, mobileSupported: true },
  { path: RoutePaths.CHART_ADD, Component: ChartCreation },
  {
    // Charts live inside their dashboard, so the chart list goes to dashboards
    path: RoutePaths.CHART_LIST,
    Component: () => <Redirect to={RoutePaths.DASHBOARD_LIST} />,
  },
  {
    path: RoutePaths.DATASET_LIST,
    Component: panelOnly(DatasetList, DATA_FALLBACK),
  },
  { path: RoutePaths.DATABASE_LIST, Component: DatabaseList },
  {
    path: RoutePaths.SAVED_QUERIES,
    Component: panelOnly(SavedQueryList, SQL_FALLBACK),
  },
  {
    path: RoutePaths.QUERY_HISTORY,
    Component: panelOnly(QueryHistoryList, SQL_FALLBACK),
  },
  { path: RoutePaths.ALERTS, Component: AlertReportList },
  {
    path: RoutePaths.REPORTS,
    Component: AlertReportList,
    props: { isReportEnabled: true },
  },
  { path: RoutePaths.ALERT_LOG, Component: ExecutionLogList },
  {
    path: RoutePaths.REPORT_LOG,
    Component: ExecutionLogList,
    props: { isReportEnabled: true },
  },
  { path: RoutePaths.EXPLORE, Component: Chart },
  { path: RoutePaths.EXPLORE_PERMALINK, Component: Chart },
  {
    path: RoutePaths.DATASET_ADD,
    Component: panelOnly(DatasetCreation, DATA_FALLBACK),
  },
  {
    path: RoutePaths.DATASET,
    Component: panelOnly(DatasetCreation, DATA_FALLBACK),
  },
  { path: RoutePaths.ROW_LEVEL_SECURITY, Component: RowLevelSecurityList },
  { path: RoutePaths.TASKS, Component: TaskList },
  { path: RoutePaths.SQLLAB, Component: panelOnly(SqlLab, SQL_FALLBACK) },
  { path: RoutePaths.USER_INFO, Component: UserInfo, mobileSupported: true },
  {
    path: RoutePaths.CONNECT_AI,
    Component: ConnectAiPage,
  },
  {
    path: RoutePaths.ASSISTANT_DOCUMENT,
    Component: DocumentPage,
    mobileSupported: true,
  },
  { path: RoutePaths.ACTION_LOG, Component: ActionLogList },
];

if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
  routes.push({ path: RoutePaths.ALL_ENTITIES, Component: AllEntities });
  routes.push({ path: RoutePaths.TAGS, Component: Tags });
}

// Recently-Archived view — gated by the soft-delete feature (T007).
if (isFeatureEnabled(FeatureFlag.SoftDelete)) {
  routes.push({
    path: '/archived/',
    Component: ArchivedList,
  });
}

const user = getBootstrapData()?.user;
const authRegistrationEnabled =
  getBootstrapData()?.common.conf.AUTH_USER_REGISTRATION;
const isAdmin = isUserAdmin(user);

if (isAdmin) {
  routes.push(
    { path: RoutePaths.ROLES, Component: RolesList },
    { path: RoutePaths.USERS, Component: UsersList },
    { path: RoutePaths.ASSISTANT_SETTINGS, Component: AssistantSettingsPage },
  );

  if (isFeatureEnabled(FeatureFlag.EnableExtensions)) {
    routes.push({ path: RoutePaths.EXTENSIONS, Component: Extensions });
  }
}

if (authRegistrationEnabled) {
  routes.push({ path: RoutePaths.REGISTRATIONS, Component: UserRegistrations });
}

const frontEndRoutes: Record<string, boolean> = routes
  .map(r => r.path)
  .reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: true,
    }),
    {},
  );

export const isFrontendRoute = (path?: string): boolean => {
  if (path) {
    // Strip query / hash, then strip the application-root segment so menu URLs
    // emitted by the backend (`url_for(...)` → `/<appRoot>/<route>`) match
    // against the route table, which is keyed by post-basename paths.
    //
    // Note: this is a literal dictionary lookup, not a path-pattern match —
    // parameterised routes such as `/dashboard/:idOrSlug/` are NOT matched
    // by a concrete `/dashboard/123/` URL. Callers relying on that behaviour
    // (e.g., the brand-link SPA-route check in `Menu.tsx`) accept a
    // full-page-reload fallback for those URLs.
    const basePath = stripAppRoot(path.split(/[?#]/)[0]);
    return !!frontEndRoutes[basePath];
  }
  return false;
};
