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
import { VizType } from '@superset-ui/core';
import mockState from 'spec/fixtures/mockState';
import {
  OPEN_CHART_EDITOR,
  OpenChartEditorDetail,
} from 'src/auradata/chartEditor';
import SliceHeaderControls, { SliceHeaderControlsProps } from '.';

// Subdirectory-specific regressions live here so the existing 676-line
// SliceHeaderControls.test.tsx doesn't need to mock getBootstrapData.

// DO NOT switch this file to
// `spec/helpers/withApplicationRoot.ts`. The fixture does
// `jest.resetModules()` + dynamic `import('src/utils/getBootstrapData')` to
// install a fixture-configured applicationRoot. But `SliceHeaderControls` is
// imported statically at the top of this file; its transitive dependency
// chain (`SliceHeaderControls` → `navigationUtils` → `pathUtils` →
// `getBootstrapData::applicationRoot`) is bound to the pre-reset module
// instance. After `withApplicationRoot('/superset')` resets modules and
// re-imports getBootstrapData on the test side, the statically-imported
// component continues to reach the OLD module whose `application_root` was
// empty at first evaluation — so the rendered tree resolves
// `applicationRoot()` to `''`, NOT `/superset`. Gate (a) of the M7 go/no-go
// fails ("the rendered SliceHeaderControls tree must resolve
// applicationRoot() to the fixture-configured value"). The hand-rolled
// `jest.mock('src/utils/getBootstrapData', ...)` below remains until a
// later slice either (i) defers the SliceHeaderControls import into the
// withApplicationRoot callback or (ii) plumbs application_root through
// React context rather than a module-scoped cache.

// Name must start with `mock` so Jest's hoisted jest.mock() factory may
// reference it. `default` returns a static shape (not mockApplicationRoot)
// because consumers like setupClient.ts call getBootstrapData() at import
// time — calling mockApplicationRoot inside `default` hits TDZ.
const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: { application_root: '', static_assets_prefix: '' },
  }),
  applicationRoot: () => mockApplicationRoot(),
  staticAssetsPrefix: () => '',
}));

const SLICE_ID = 371;

const buildProps = (): SliceHeaderControlsProps =>
  ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    exploreChart: jest.fn(),
    exportCSV: jest.fn(),
    exportFullCSV: jest.fn(),
    exportXLSX: jest.fn(),
    exportFullXLSX: jest.fn(),
    exportPivotExcel: jest.fn(),
    forceRefresh: jest.fn(),
    handleToggleFullSize: jest.fn(),
    toggleExpandSlice: jest.fn(),
    logEvent: jest.fn(),
    logExploreChart: jest.fn(),
    slice: {
      slice_id: SLICE_ID,
      slice_url: '/explore/?form_data=%7B%22slice_id%22%3A%20371%7D',
      slice_name: 'Subdirectory regression chart',
      slice_description: '',
      form_data: {
        slice_id: SLICE_ID,
        datasource: '58__table',
        viz_type: VizType.Sunburst,
      },
      viz_type: VizType.Sunburst,
      datasource: '58__table',
      description: '',
      description_markeddown: '',
      editors: [],
      modified: '',
      changed_on: 0,
    },
    isCached: [false],
    isExpanded: false,
    cachedDttm: [''],
    updatedDttm: 0,
    supersetCanExplore: true,
    supersetCanDownload: true,
    componentId: 'CHART-subdir',
    dashboardId: 26,
    isFullSize: false,
    chartStatus: 'rendered',
    showControls: true,
    supersetCanShare: true,
    formData: {
      slice_id: SLICE_ID,
      datasource: '58__table',
      viz_type: VizType.Sunburst,
    },
    exploreUrl: '/explore/?dashboard_page_id=abc&slice_id=371',
    defaultOpen: true,
  }) as unknown as SliceHeaderControlsProps;

const renderControls = (): void => {
  render(<SliceHeaderControls {...buildProps()} />, {
    useRedux: true,
    useRouter: true,
    initialState: {
      ...mockState,
      user: {
        ...mockState.user,
        roles: { Admin: [['can_samples', 'Datasource']] },
      },
    },
  });
};

// AuraData BI edits a chart in the side panel of its dashboard (there is no chart
// screen), so "Edit chart" asks the dashboard to open the panel with the
// exploreUrl it was given, whatever the modifier keys, and never opens a tab.
// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('SliceHeaderControls — "Edit chart" opens the side panel', () => {
  let openSpy: jest.SpyInstance;
  let received: OpenChartEditorDetail[];
  const listener = (event: Event) => {
    received.push((event as CustomEvent<OpenChartEditorDetail>).detail);
  };

  beforeEach(() => {
    mockApplicationRoot.mockReturnValue('');
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    received = [];
    window.addEventListener(OPEN_CHART_EDITOR, listener);
  });

  afterEach(() => {
    window.removeEventListener(OPEN_CHART_EDITOR, listener);
    openSpy.mockRestore();
  });

  test.each([
    ['', 'application root is empty'],
    ['/superset', 'deployed under a subdirectory'],
  ])(
    'a Cmd-click with application root "%s" (%s) opens the panel, not a tab',
    async root => {
      mockApplicationRoot.mockReturnValue(root);
      renderControls();

      userEvent.click(screen.getByRole('button', { name: 'More Options' }));
      const editChart = await screen.findByText('Edit chart');
      userEvent.click(editChart, { metaKey: true });

      expect(received).toEqual([
        {
          url: '/explore/?dashboard_page_id=abc&slice_id=371',
          chartId: SLICE_ID,
        },
      ]);
      expect(openSpy).not.toHaveBeenCalled();
    },
  );
});
