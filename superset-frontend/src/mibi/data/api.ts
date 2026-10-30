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
import type { DatasetObject } from 'src/features/datasets/types';

export interface DataConnection {
  id: number;
  database_name: string;
  backend: string;
  allow_file_upload: boolean;
  expose_in_sqllab: boolean;
  changed_on_delta_humanized: string;
}

export interface DataSet {
  id: number;
  table_name: string;
  kind: 'physical' | 'virtual';
  schema: string | null;
  description: string | null;
  database: { id: number; database_name: string };
  changed_on_delta_humanized: string;
  changed_by?: { first_name?: string; last_name?: string } | null;
}

const PAGE_SIZE = 100;
/** Enough for the overview; the full lists stay one click away. */
const MAX_DATASETS = 1000;

export async function fetchConnections(): Promise<DataConnection[]> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/database/?q=${rison.encode({
      columns: [
        'id',
        'database_name',
        'backend',
        'allow_file_upload',
        'expose_in_sqllab',
        'changed_on_delta_humanized',
      ],
      order_column: 'database_name',
      order_direction: 'asc',
      page_size: PAGE_SIZE,
    })}`,
  });
  return json.result as DataConnection[];
}

/** Every dataset the user can access, most recently changed first. */
export async function fetchDataSets(): Promise<DataSet[]> {
  const datasets: DataSet[] = [];
  for (let page = 0; datasets.length < MAX_DATASETS; page += 1) {
    // Pages depend on each other: stop at the first short one
    // eslint-disable-next-line no-await-in-loop
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/dataset/?q=${rison.encode({
        columns: [
          'id',
          'table_name',
          'kind',
          'schema',
          'description',
          'database.id',
          'database.database_name',
          'changed_on_delta_humanized',
          'changed_by.first_name',
          'changed_by.last_name',
        ],
        order_column: 'changed_on_delta_humanized',
        order_direction: 'desc',
        page,
        page_size: PAGE_SIZE,
      })}`,
    });
    datasets.push(...(json.result as DataSet[]));
    if (json.result.length < PAGE_SIZE) {
      break;
    }
  }
  return datasets;
}

export const datasetUrl = (id: number) => `/data/dataset/${id}/`;

/**
 * The dataset as the edit modal expects it: certification details are read
 * from each column's "extra" JSON.
 */
export async function fetchEditableDataset(id: number): Promise<DatasetObject> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/dataset/${id}`,
  });
  const result = json.result as DatasetObject;
  result.columns = (result.columns || []).map(column => {
    const {
      certification: { details = '', certified_by: certifiedBy = '' } = {},
    } = JSON.parse(column.extra || '{}') || {};
    return {
      ...column,
      certification_details: details || '',
      certified_by: certifiedBy || '',
    };
  });
  return result;
}
