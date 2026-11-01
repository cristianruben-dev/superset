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
import {
  DEFAULT_OBJECT_COLUMNS,
  DEFAULT_OBJECT_ROWS,
  gridColumnCount,
} from 'src/mibi/format/columns';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core/translation';

import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
  DYNAMIC_TYPE,
} from './componentTypes';

import { MEDIUM_HEADER, BACKGROUND_TRANSPARENT } from './constants';

import { DashboardComponent, LayoutItemMeta } from '../types';

export interface DashboardEntity extends DashboardComponent {
  parents: string[];
}

const typeToDefaultMetaData: Record<string, LayoutItemMeta | null> = {
  [CHART_TYPE]: {
    width: DEFAULT_OBJECT_COLUMNS,
    height: DEFAULT_OBJECT_ROWS,
  },
  [COLUMN_TYPE]: {
    width: DEFAULT_OBJECT_COLUMNS,
    background: BACKGROUND_TRANSPARENT,
  },
  [DIVIDER_TYPE]: null,
  [HEADER_TYPE]: {
    text: t('New header'),
    headerSize: MEDIUM_HEADER,
    background: BACKGROUND_TRANSPARENT,
  },
  [MARKDOWN_TYPE]: {
    width: DEFAULT_OBJECT_COLUMNS,
    height: DEFAULT_OBJECT_ROWS,
  },
  [ROW_TYPE]: { background: BACKGROUND_TRANSPARENT },
  [TABS_TYPE]: null,
  [TAB_TYPE]: {
    text: '',
    defaultText: t('Tab title'),
    placeholder: t('Tab title'),
  },
  [DYNAMIC_TYPE]: {
    background: BACKGROUND_TRANSPARENT,
  },
};

function generateId(type: string): string {
  return `${type}-${nanoid()}`;
}

export default function entityFactory(
  type: string,
  meta?: LayoutItemMeta,
  parents: string[] = [],
): DashboardEntity {
  const defaults = typeToDefaultMetaData[type];
  return {
    type,
    id: generateId(type),
    children: [],
    parents,
    meta: {
      ...defaults,
      // A dynamic component spans the whole canvas by default
      ...(type === DYNAMIC_TYPE && { width: gridColumnCount() }),
      ...meta,
    },
  };
}
