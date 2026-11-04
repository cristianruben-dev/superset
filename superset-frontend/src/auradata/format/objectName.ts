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
import type { LayoutItem } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { elementName } from 'src/auradata/elements/ElementFormat';
import {
  ELEMENT_KEY,
  elementKind,
  type ElementConfig,
} from 'src/auradata/elements/types';

/**
 * The name of an object of the page, as the editor sees it in lists. A filter
 * goes by the name of its native filter (from `filters`), a text box by its text.
 */
export function objectName(
  item: LayoutItem | undefined,
  filters?: Record<string, { name?: string }>,
): string {
  if (!item) return '';
  if (item.type === CHART_TYPE) {
    return String(
      item.meta?.sliceNameOverride || item.meta?.sliceName || t('Chart'),
    );
  }
  const kind = elementKind(item.meta?.componentKey);
  if (!kind) return t('Text box');
  const config = item.meta?.[ELEMENT_KEY] as ElementConfig | undefined;
  let detail: string | undefined;
  if (config?.kind === 'filter' && config.filterId) {
    detail = filters?.[config.filterId]?.name;
  } else if (config?.kind === 'text') {
    detail = config.html
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  } else if (config?.kind === 'button') {
    detail = config.label;
  }
  return detail ? `${elementName(kind)}: ${detail}` : elementName(kind);
}
