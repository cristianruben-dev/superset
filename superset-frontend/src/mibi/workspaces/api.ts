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
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { getPanelDashboardId } from '../chartEditor';

export interface WorkspaceUser {
  id: number;
  first_name: string;
  last_name: string;
}

export type WorkspaceRole = 'viewer' | 'contributor' | 'admin';

export const WORKSPACE_ROLES: WorkspaceRole[] = [
  'admin',
  'contributor',
  'viewer',
];

export interface WorkspaceMember extends WorkspaceUser {
  role: WorkspaceRole;
  username?: string;
}

export interface Workspace {
  id: number;
  uuid: string | null;
  name: string;
  description: string | null;
  color: string | null;
  image_url: string | null;
  dashboard_ids: number[];
  dashboard_count: number;
  /** Datasets that belong to the workspace */
  dataset_count: number;
  changed_on: string | null;
  created_by: WorkspaceUser | null;
  /** The current user's role; Superset admins administer every workspace */
  role: WorkspaceRole | null;
  /** Change the workspace and its members */
  can_edit: boolean;
  /** Add, create and edit its dashboards */
  can_contribute: boolean;
  member_count: number;
  /** The first members, admins first */
  members: WorkspaceMember[];
}

export interface WorkspaceSummary {
  id: number;
  name: string;
  color: string | null;
  image_url: string | null;
  role?: WorkspaceRole | null;
}

export interface WorkspaceFields {
  name: string;
  description?: string | null;
  color?: string | null;
}

const BASE = '/api/v1/workspace/';

/**
 * Colors offered for workspaces. Stored as hex, so a workspace keeps its color
 * across light and dark themes. They are data picked by users, not styling,
 * hence the lint exceptions.
 */
export const WORKSPACE_COLORS = [
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#2563EB',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#7C3AED',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#0EA5E9',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#14B8A6',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#10B981',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#F59E0B',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#F97316',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#EF4444',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#EC4899',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#A855F7',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#64748B',
];

export const DEFAULT_WORKSPACE_COLOR = WORKSPACE_COLORS[0];

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { json } = await SupersetClient.get({ endpoint: BASE });
  return json.result as Workspace[];
}

export async function fetchWorkspace(id: number): Promise<Workspace> {
  const { json } = await SupersetClient.get({ endpoint: `${BASE}${id}/` });
  return json.result as Workspace;
}

export async function createWorkspace(
  fields: WorkspaceFields,
): Promise<Workspace> {
  const { json } = await SupersetClient.post({
    endpoint: BASE,
    jsonPayload: fields,
  });
  return json.result as Workspace;
}

export async function updateWorkspace(
  id: number,
  fields: Partial<WorkspaceFields>,
): Promise<Workspace> {
  const { json } = await SupersetClient.put({
    endpoint: `${BASE}${id}/`,
    jsonPayload: fields,
  });
  return json.result as Workspace;
}

export async function deleteWorkspace(id: number): Promise<void> {
  await SupersetClient.delete({ endpoint: `${BASE}${id}/` });
}

export async function uploadWorkspaceImage(
  id: number,
  file: Blob,
): Promise<Workspace> {
  const body = new FormData();
  body.append('image', file);
  const { json } = await SupersetClient.put({
    endpoint: `${BASE}${id}/image/`,
    body,
    headers: { Accept: 'application/json' },
  });
  return json.result as Workspace;
}

export async function deleteWorkspaceImage(id: number): Promise<Workspace> {
  const { json } = await SupersetClient.delete({
    endpoint: `${BASE}${id}/image/`,
  });
  return json.result as Workspace;
}

/** Move dashboards into (add) or out of (remove) a workspace. */
export async function moveDashboards(
  id: number,
  changes: { add?: number[]; remove?: number[] },
): Promise<Workspace> {
  const { json } = await SupersetClient.put({
    endpoint: `${BASE}${id}/dashboards/`,
    jsonPayload: changes,
  });
  return json.result as Workspace;
}

/** The workspace a dashboard lives in, or null. */
export async function fetchDashboardWorkspace(
  dashboardId: number,
): Promise<WorkspaceSummary | null> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}of_dashboard/${dashboardId}/`,
  });
  return (json.result as WorkspaceSummary | null) ?? null;
}

export interface WorkspaceDashboard {
  id: number;
  dashboard_title: string;
  url: string;
  published: boolean;
  changed_on_delta_humanized: string;
  can_edit: boolean;
  thumbnail_url: string | null;
}

export async function fetchWorkspaceDashboards(
  id: number,
): Promise<WorkspaceDashboard[]> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}${id}/dashboards/`,
  });
  return json.result as WorkspaceDashboard[];
}

export async function fetchWorkspaceMembers(
  id: number,
): Promise<WorkspaceMember[]> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}${id}/members/`,
  });
  return json.result as WorkspaceMember[];
}

/** Add a member or change their role. */
export async function setWorkspaceMember(
  id: number,
  userId: number,
  role: WorkspaceRole,
): Promise<Workspace> {
  const { json } = await SupersetClient.put({
    endpoint: `${BASE}${id}/members/`,
    jsonPayload: { user_id: userId, role },
  });
  return json.result as Workspace;
}

/** Remove a member; null when the current user left the workspace. */
export async function removeWorkspaceMember(
  id: number,
  userId: number,
): Promise<Workspace | null> {
  const { json } = await SupersetClient.delete({
    endpoint: `${BASE}${id}/members/${userId}/`,
  });
  return (json.result as Workspace | null) ?? null;
}

/** Active users who are not members yet. */
export async function searchMemberCandidates(
  id: number,
  text: string,
): Promise<WorkspaceMember[]> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}${id}/member_candidates/?q=${encodeURIComponent(text)}`,
  });
  return json.result as WorkspaceMember[];
}

export const workspaceUrl = (id: number) => `/workspace/${id}/`;

export const userName = (user: WorkspaceUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(' ');

export const userInitials = (user: WorkspaceUser) =>
  (
    `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}` || '?'
  ).toUpperCase();

/** Up to two initials for the workspace avatar. */
export function workspaceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words[0][0] + words[1][0]
      : (words[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}

export interface WorkspaceDataset {
  id: number;
  table_name: string;
  schema: string | null;
  database_name: string | null;
  kind: 'physical' | 'virtual';
  changed_on_delta_humanized: string;
  can_edit: boolean;
}

/** The datasets of a workspace, most recently changed first. */
export async function fetchWorkspaceDatasets(
  id: number,
): Promise<WorkspaceDataset[]> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}${id}/datasets/`,
  });
  return json.result as WorkspaceDataset[];
}

/** Move datasets into (add) a workspace, or out of it (remove) to share them. */
export async function moveDatasets(
  id: number,
  changes: { add?: number[]; remove?: number[] },
): Promise<Workspace> {
  const { json } = await SupersetClient.put({
    endpoint: `${BASE}${id}/datasets/`,
    jsonPayload: changes,
  });
  return json.result as Workspace;
}

/**
 * Put a dataset just created from a dashboard into that dashboard's workspace.
 * Datasets of dashboards outside workspaces stay shared.
 */
export async function linkDatasetToDashboard(
  datasetId: number,
  dashboardId: number | undefined,
): Promise<void> {
  if (dashboardId === undefined) {
    return;
  }
  const workspace = await fetchDashboardWorkspace(dashboardId);
  if (workspace) {
    await moveDatasets(workspace.id, { add: [datasetId] });
  }
}

/**
 * From the side panel of a dashboard: put a dataset just created into the
 * dashboard's workspace. Outside the panel, or when that fails, it stays shared.
 */
export async function linkNewDataset(datasetId: number): Promise<void> {
  try {
    await linkDatasetToDashboard(datasetId, getPanelDashboardId());
  } catch (error) {
    // A shared dataset still works in every dashboard
    console.warn('Could not add the dataset to the workspace', error);
  }
}

/** `linkNewDataset` for a file upload, which answers without the dataset id. */
export async function linkUploadedDataset(
  databaseId: number,
  schema: string | null | undefined,
  tableName: string,
): Promise<void> {
  if (getPanelDashboardId() === undefined) {
    return;
  }
  const filters = [
    { col: 'database', opr: 'rel_o_m', value: databaseId },
    { col: 'table_name', opr: 'eq', value: tableName },
    ...(schema ? [{ col: 'schema', opr: 'eq', value: schema }] : []),
  ];
  try {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/dataset/?q=${rison.encode({ filters, columns: ['id'] })}`,
    });
    const datasetId = json.result?.[0]?.id;
    if (typeof datasetId === 'number') {
      await linkNewDataset(datasetId);
    }
  } catch (error) {
    console.warn('Could not find the uploaded dataset', error);
  }
}
