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
import type { ComponentType } from 'react';
import { Redirect } from 'react-router-dom';
import { isPanelMode } from './chartEditor';

/**
 * Pages that build a report (datasets, SQL Lab, saved queries) only exist inside
 * the side panel of a dashboard, as in Power BI. Opened on their own page, they
 * send the user to `fallback`.
 */
export function PanelGate({
  fallback,
  children,
}: {
  fallback: string;
  children: JSX.Element;
}) {
  return isPanelMode() ? children : <Redirect to={fallback} />;
}

/** The page wrapped in a `PanelGate`, for the route table. */
export function panelOnly(
  Page: ComponentType,
  fallback: string,
): ComponentType {
  const Gated = (props: object) => (
    <PanelGate fallback={fallback}>
      <Page {...props} />
    </PanelGate>
  );
  Gated.displayName = `PanelOnly(${Page.displayName || Page.name || 'Page'})`;
  return Gated;
}
