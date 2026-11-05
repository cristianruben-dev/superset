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
import type { UserRoles } from 'src/types/bootstrapTypes';

const API_KEY_SCOPE_RESOURCES = [
  'annotation',
  'chart',
  'dashboard',
  'database',
  'dataset',
  'explore',
  'query',
  'report',
  'role',
  'rls',
  'savedquery',
  'sqllab',
  'tag',
  'task',
  'theme',
  'user',
] as const;

const API_KEY_SCOPE_ACTIONS = ['read', 'write'] as const;

type ApiKeyScopeResource = (typeof API_KEY_SCOPE_RESOURCES)[number];
type ApiKeyScopeAction = (typeof API_KEY_SCOPE_ACTIONS)[number];

export const API_KEY_SCOPE_OPTIONS = API_KEY_SCOPE_RESOURCES.flatMap(resource =>
  API_KEY_SCOPE_ACTIONS.map(action => {
    const value = `superset:${resource}:${action}`;
    return { label: value, value };
  }),
);

/**
 * The permission class behind each scope resource and the methods behind each
 * action, as in superset/security/api_key_scopes.py: the server refuses a key
 * whose scopes name a resource and action its owner has no permission for.
 */
const SCOPE_RESOURCE_CLASS: Record<ApiKeyScopeResource, string> = {
  annotation: 'Annotation',
  chart: 'Chart',
  dashboard: 'Dashboard',
  database: 'Database',
  dataset: 'Dataset',
  explore: 'Explore',
  query: 'Query',
  report: 'ReportSchedule',
  role: 'Role',
  rls: 'Row Level Security',
  savedquery: 'SavedQuery',
  sqllab: 'SQLLab',
  tag: 'Tag',
  task: 'Task',
  theme: 'Theme',
  user: 'User',
};

const SCOPE_ACTION_METHODS: Record<ApiKeyScopeAction, string[]> = {
  read: ['read', 'get'],
  write: ['write', 'update', 'delete', 'execute_sql_query'],
};

/** The scope options a user with these roles may put on a key of their own. */
export function grantableApiKeyScopeOptions(roles: UserRoles | undefined) {
  const held = new Set(
    Object.values(roles || {}).flatMap(permissions =>
      permissions.map(([permission, view]) => `${permission}|${view}`),
    ),
  );
  return API_KEY_SCOPE_OPTIONS.filter(({ value }) => {
    const [, resource, action] = value.split(':') as [
      string,
      ApiKeyScopeResource,
      ApiKeyScopeAction,
    ];
    return SCOPE_ACTION_METHODS[action].some(method =>
      held.has(`can_${method}|${SCOPE_RESOURCE_CLASS[resource]}`),
    );
  });
}

/** The read scopes among some options: a key that can look but not change. */
export const readApiKeyScopes = (options: { value: string }[]) =>
  options.map(({ value }) => value).filter(value => value.endsWith(':read'));

export const serializeApiKeyScopes = (scopes?: string[]) =>
  scopes?.length ? scopes.join(',') : undefined;

export const getApiKeyScopesHelpText = () =>
  t(
    'Limit which MCP resources and actions this key can access. These scopes do not restrict REST API requests and never grant permissions the user does not already have. Leave empty for legacy RBAC-only behavior.',
  );
