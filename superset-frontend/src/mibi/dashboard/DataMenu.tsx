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
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { findPermission } from 'src/utils/findPermission';
import {
  DATA_PANEL_URL,
  openChartEditor,
  type PanelKind,
  SQL_PANEL_URL,
} from '../chartEditor';
import { RibbonButton } from '../ribbon/parts';

const NEW_DATASET_URL = '/dataset/add/';

/**
 * The "Data" menu of a dashboard in edit mode, as the Power BI ribbon: the
 * datasets, a new dataset and SQL Lab open in the side panel of the dashboard.
 */
export function DataMenu() {
  const roles = useSelector(
    (state: { user?: UserWithPermissionsAndRoles }) => state.user?.roles,
  );
  const canReadDatasets = findPermission('can_read', 'Dataset', roles);
  const canWriteDatasets = findPermission('can_write', 'Dataset', roles);
  const canSql = findPermission('can_sqllab', 'Superset', roles);

  const entries: {
    key: string;
    label: string;
    url: string;
    kind: PanelKind;
  }[] = [
    ...(canReadDatasets
      ? [
          {
            key: 'datasets',
            label: t('Datasets'),
            url: DATA_PANEL_URL,
            kind: 'data' as PanelKind,
          },
        ]
      : []),
    ...(canWriteDatasets
      ? [
          {
            key: 'new-dataset',
            label: t('New dataset'),
            url: NEW_DATASET_URL,
            kind: 'data' as PanelKind,
          },
        ]
      : []),
    ...(canSql
      ? [
          {
            key: 'sql',
            label: t('SQL editor'),
            url: SQL_PANEL_URL,
            kind: 'sql' as PanelKind,
          },
        ]
      : []),
  ];
  if (!entries.length) return null;

  const icons: Record<string, JSX.Element> = {
    datasets: <Icons.TableOutlined iconSize="m" />,
    'new-dataset': <Icons.PlusOutlined iconSize="m" />,
    sql: <Icons.ConsoleSqlOutlined iconSize="m" />,
  };

  return (
    <RibbonButton
      label={t('Data')}
      icon={<Icons.DatabaseOutlined iconSize="m" />}
      data-test="mibi-data-menu"
      menu={{
        items: entries.map(entry => ({
          key: entry.key,
          label: entry.label,
          icon: icons[entry.key],
        })),
        onClick: ({ key }) => {
          const entry = entries.find(item => item.key === key);
          if (entry) {
            openChartEditor({ url: entry.url, kind: entry.kind });
          }
        },
      }}
    />
  );
}
