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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import * as dashboardInfoActions from 'src/dashboard/actions/dashboardInfo';
import { CrossFiltersSwitch } from './CrossFiltersSwitch';

const state = (crossFiltersEnabled: boolean, dash_edit_perm: boolean) => ({
  dashboardInfo: { id: 1, crossFiltersEnabled, dash_edit_perm },
});

test('editors can turn cross-filtering off', () => {
  const save = jest
    .spyOn(dashboardInfoActions, 'saveCrossFiltersSetting')
    .mockReturnValue({ type: 'noop' } as unknown as ReturnType<
      typeof dashboardInfoActions.saveCrossFiltersSetting
    >);

  render(<CrossFiltersSwitch />, {
    useRedux: true,
    initialState: state(true, true),
  });

  const toggle = screen.getByRole('switch');
  expect(toggle).toBeChecked();
  userEvent.click(toggle);
  expect(save).toHaveBeenCalledWith(false);
  save.mockRestore();
});

test('is hidden from users who cannot edit the dashboard', () => {
  render(<CrossFiltersSwitch />, {
    useRedux: true,
    initialState: state(true, false),
  });

  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
