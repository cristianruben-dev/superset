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
import { Redirect } from 'react-router-dom';
import { SupersetClient } from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';
import { isPanelMode } from './chartEditor';

const DASHBOARD_LIST = '/dashboard/list/';

/**
 * Explore only exists inside the chart editor panel of a dashboard. Opened on
 * its own page, it sends the user to the dashboard of the chart.
 */
export default function ExploreGate({ children }: { children: JSX.Element }) {
  const panel = isPanelMode();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (panel) {
      return;
    }
    const sliceId = new URLSearchParams(window.location.search).get('slice_id');
    if (!sliceId) {
      setTarget(DASHBOARD_LIST);
      return;
    }
    SupersetClient.get({ endpoint: `/api/v1/chart/${Number(sliceId)}` })
      .then(({ json }) => {
        const dashboardId = json?.result?.dashboards?.[0]?.id;
        setTarget(
          dashboardId ? `/superset/dashboard/${dashboardId}/` : DASHBOARD_LIST,
        );
      })
      .catch(() => setTarget(DASHBOARD_LIST));
  }, [panel]);

  if (panel) {
    return children;
  }
  return target ? <Redirect to={target} /> : <Loading />;
}
