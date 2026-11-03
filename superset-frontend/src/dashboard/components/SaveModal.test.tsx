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
import { SAVE_TYPE_NEWDASHBOARD } from 'src/dashboard/util/constants';
import SaveModal from './SaveModal';

const renderModal = (onSave = jest.fn()) =>
  render(
    <SaveModal
      addSuccessToast={jest.fn()}
      addDangerToast={jest.fn()}
      dashboardId={1}
      dashboardTitle="Sales"
      dashboardInfo={{ metadata: {} }}
      expandedSlices={{}}
      layout={{}}
      saveType={SAVE_TYPE_NEWDASHBOARD}
      triggerNode={<button type="button">open</button>}
      customCss=""
      onSave={onSave}
      canOverwrite
      shouldPersistRefreshFrequency={false}
      refreshFrequency={0}
      lastModifiedTime={0}
    />,
  );

test('save as always copies the charts, without asking', async () => {
  const onSave = jest.fn();
  renderModal(onSave);
  userEvent.click(screen.getByText('open'));

  expect(await screen.findByText('Save as:')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ duplicate_slices: true }),
    1,
    SAVE_TYPE_NEWDASHBOARD,
  );
});
