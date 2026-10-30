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
import { useEffect, useState } from 'react';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';

export interface PreviewCell {
  width: number;
  height: number;
  kind: string;
  cells?: PreviewCell[];
}

export type PreviewRows = PreviewCell[][];

/** Layout previews of the given dashboards, keyed by id (one request). */
export function useDashboardPreviews(ids: number[]) {
  const [previews, setPreviews] = useState<Record<number, PreviewRows>>({});
  const key = ids.join(',');

  useEffect(() => {
    if (!ids.length) {
      return undefined;
    }
    let cancelled = false;
    SupersetClient.get({
      endpoint: `/api/v1/mibi/dashboard_previews/?q=${rison.encode(ids)}`,
    })
      .then(({ json }) => {
        if (cancelled) {
          return;
        }
        const result = json.result as { id: number; rows: PreviewRows }[];
        setPreviews(current => ({
          ...current,
          ...Object.fromEntries(result.map(({ id, rows }) => [id, rows])),
        }));
      })
      .catch(() => {
        // Cards keep their placeholder preview
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return previews;
}
