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
import { useHistory } from 'react-router-dom';
import {
  Button,
  DropdownButton,
  Menu,
  Flex,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { logEvent } from 'src/logger/actions';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_DATABASE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SCHEMA_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_TABLE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SUCCESS,
} from 'src/logger/LogUtils';
import {
  DATA_PANEL_URL,
  editChartFromPanel,
  isPanelMode,
} from 'src/auradata/chartEditor';
import { linkNewDataset } from 'src/auradata/workspaces/api';
import { DatasetObject } from '../types';

interface FooterProps {
  url: string;
  addDangerToast: () => void;
  datasetObject?: Partial<DatasetObject> | null;
  onDatasetAdd?: (dataset: DatasetObject) => void;
  hasColumns?: boolean;
  datasets?: (string | null | undefined)[] | undefined;
}

const INPUT_FIELDS = ['db', 'schema', 'table_name'];
const LOG_ACTIONS = [
  LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_DATABASE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SCHEMA_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_TABLE_CANCELLATION,
];

function Footer({
  datasetObject,
  addDangerToast,
  hasColumns = false,
  datasets,
}: FooterProps) {
  const history = useHistory();
  const theme = useTheme();
  const { createResource, state } = useSingleViewResource<
    Partial<DatasetObject>
  >('dataset', t('dataset'), addDangerToast);
  const { loading } = state;

  const createLogAction = (dataset: Partial<DatasetObject>) => {
    let totalCount = 0;
    const value = Object.keys(dataset).reduce((total, key) => {
      if (INPUT_FIELDS.includes(key) && dataset[key as keyof DatasetObject]) {
        totalCount += 1;
      }
      return totalCount;
    }, 0);

    return LOG_ACTIONS[value];
  };

  const cancelButtonOnClick = () => {
    if (!datasetObject) {
      logEvent(LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION, {});
    } else {
      const logAction = createLogAction(datasetObject);
      logEvent(logAction, datasetObject);
    }
    // AuraData BI: in a dashboard's side panel, going back could leave the
    // dashboard itself, since the panel shares the browser history
    if (isPanelMode()) {
      history.push(DATA_PANEL_URL);
    } else {
      history.goBack();
    }
  };

  const tooltipText = t('Select a database table.');

  const onSave = (createChart: boolean = true) => {
    if (datasetObject) {
      const data = {
        database: datasetObject.db?.id,
        catalog: datasetObject.catalog,
        schema: datasetObject.schema,
        table_name: datasetObject.table_name,
      };
      createResource(data).then(response => {
        if (!response) {
          return;
        }
        if (typeof response === 'number') {
          logEvent(LOG_ACTIONS_DATASET_CREATION_SUCCESS, datasetObject);
          // AuraData BI: a dataset made in a dashboard joins its workspace
          linkNewDataset(response);
          // When a dataset is created the response we get is its ID number
          const chartUrl = `/chart/add/?dataset=${datasetObject.table_name}`;
          // AuraData BI: inside a dashboard, the dashboard opens its chart editor
          if (!createChart) {
            history.push(DATA_PANEL_URL);
          } else if (!editChartFromPanel(chartUrl)) {
            history.push(chartUrl);
          }
        }
      });
    }
  };

  const onSaveOnly = () => {
    onSave(false);
  };

  const CREATE_DATASET_TEXT = t('Create and explore dataset');
  const CREATE_DATASET_ONLY_TEXT = t('Create dataset');
  const disabledCheck =
    !datasetObject?.table_name ||
    !hasColumns ||
    datasets?.includes(datasetObject?.table_name);

  const dropdownMenu = (
    <Menu
      items={[
        {
          key: 'create-only',
          onClick: onSaveOnly,
          label: CREATE_DATASET_ONLY_TEXT,
        },
      ]}
    />
  );

  return (
    <Flex align="center" justify="flex-end" gap="8px">
      <Button buttonStyle="secondary" onClick={cancelButtonOnClick}>
        {t('Cancel')}
      </Button>
      <DropdownButton
        type="primary"
        disabled={disabledCheck}
        loading={loading}
        tooltip={!datasetObject?.table_name ? tooltipText : undefined}
        onClick={() => onSave(true)}
        popupRender={() => dropdownMenu}
        icon={
          <Icons.DownOutlined
            iconSize="xs"
            iconColor={theme.colorTextLightSolid}
          />
        }
        trigger={['click']}
      >
        {CREATE_DATASET_TEXT}
      </DropdownButton>
    </Flex>
  );
}

export default withToasts(Footer);
