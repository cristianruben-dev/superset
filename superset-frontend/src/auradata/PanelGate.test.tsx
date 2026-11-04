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
import { MemoryRouter, Route } from 'react-router-dom';
import { render, screen } from 'spec/helpers/testing-library';
import * as chartEditor from './chartEditor';
import { panelOnly } from './PanelGate';

const SqlPage = () => <div>sql page</div>;
const Gated = panelOnly(SqlPage, '/dashboard/list/');

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/sqllab/']}>
      <Route path="/sqllab/" component={Gated} />
      <Route path="/dashboard/list/" render={() => <div>dashboards</div>} />
    </MemoryRouter>,
  );

test('sends pages opened on their own to the fallback', () => {
  renderAt();

  expect(screen.queryByText('sql page')).not.toBeInTheDocument();
  expect(screen.getByText('dashboards')).toBeInTheDocument();
});

test('renders the page inside the side panel of a dashboard', () => {
  const panel = jest.spyOn(chartEditor, 'isPanelMode').mockReturnValue(true);
  renderAt();

  expect(screen.getByText('sql page')).toBeInTheDocument();
  panel.mockRestore();
});
