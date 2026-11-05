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
import type { Confirmation } from './types';

/**
 * What a call asks to do, for the person who decides. A tool not named here shows
 * the title the server gives it.
 */
export const confirmationTitle = ({
  name,
  title,
}: Pick<Confirmation, 'name' | 'title'>) =>
  ({
    delete_chart: t('Delete a chart'),
    update_chart: t('Change a chart'),
    delete_dashboard: t('Delete this report'),
    manage_dashboard_owners: t('Change who edits this report'),
    manage_dashboard_roles: t('Change who can see this report'),
    manage_native_filters: t('Change the filters of this report'),
    remove_chart_from_dashboard: t('Remove a chart from this report'),
    update_dashboard: t('Change this report'),
    update_calculated_column: t('Change a calculated column'),
    delete_calculated_column: t('Delete a calculated column'),
    delete_metric: t('Delete a metric'),
    update_dataset_metric: t('Change a metric'),
    restore_version: t('Go back to an earlier version'),
    create_report: t('Schedule a report'),
    create_alert: t('Schedule an alert'),
    update_report: t('Change a scheduled report'),
    delete_report: t('Delete a scheduled report'),
    remove_element: t('Remove an element'),
    delete_bookmark: t('Delete a bookmark'),
    clear_mobile_layout: t('Delete the mobile layout'),
    delete_page: t('Delete a page'),
    publish_dashboard: t('Publish this report'),
    share_dashboard: t('Share this report'),
    execute_sql: t('Run a SQL statement'),
    delete_workspace: t('Delete a workspace'),
    remove_workspace_member: t('Remove a member of a workspace'),
    set_workspace_member: t('Change a member of a workspace'),
    move_dashboard_to_workspace: t('Move this report to another workspace'),
    move_dataset_to_workspace: t('Move a dataset to another workspace'),
  })[name] ?? title;
