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
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryData, QueryFormData } from '@superset-ui/core';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { blockFormData } from './artifact';
import type { DataBlock } from './types';

/** How a block of data stands: refused and failed read differently to a person. */
export type BlockData =
  | { status: 'loading' }
  | { status: 'refused' }
  | { status: 'failed' }
  | { status: 'ready'; data: QueryData[]; formData: QueryFormData };

/** Who lacks access gets these, also for a dataset that is gone. */
const REFUSED_STATUSES = [401, 403, 404];

const isRefusal = (error: unknown) =>
  REFUSED_STATUSES.includes((error as { status?: number })?.status ?? 0);

/**
 * The numbers of a block, as the person looking: its query goes through the chart data
 * API on each opening, and they live in this component only. `reachable` says the
 * server already knows the dataset is out of reach, which needs no query. A change that
 * leaves the query as it was asks for nothing.
 */
export function useBlockData(
  block: DataBlock,
  dashboardId: number,
  reachable: boolean,
) {
  const key = JSON.stringify([
    block.query,
    block.type,
    'chart' in block && block.chart,
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const formData = useMemo(
    () => blockFormData(block, dashboardId),
    [key, dashboardId],
  );
  const [state, setState] = useState<BlockData>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    if (!reachable) {
      setState({ status: 'refused' });
      return undefined;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setState({ status: 'loading' });
    requestChartDataResolved(
      {
        formData,
        resultFormat: 'json',
        resultType: 'full',
        requestParams: { signal, dashboard_id: dashboardId },
      },
      signal,
    ).then(
      data => setState({ status: 'ready', data, formData }),
      error => {
        if (signal.aborted) return;
        setState({ status: isRefusal(error) ? 'refused' : 'failed' });
      },
    );
    return () => controller.abort();
  }, [formData, dashboardId, reachable, attempt]);

  return { state, retry };
}
