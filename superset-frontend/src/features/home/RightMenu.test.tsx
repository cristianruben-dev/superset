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
import * as reactRedux from 'react-redux';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { isEmbedded } from 'src/dashboard/util/isEmbedded';
import RightMenu from './RightMenu';
import { RightMenuProps } from './types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

jest.mock('src/dashboard/util/isEmbedded', () => ({
  isEmbedded: jest.fn(() => false),
}));

const mockIsEmbedded = isEmbedded as jest.MockedFunction<typeof isEmbedded>;

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

const createProps = (): RightMenuProps => ({
  align: 'flex-end',
  navbarRight: {
    show_watermark: false,
    bug_report_url: undefined,
    documentation_url: undefined,
    languages: {
      en: {
        flag: 'us',
        name: 'English',
        url: '/lang/en',
      },
      it: {
        flag: 'it',
        name: 'Italian',
        url: '/lang/it',
      },
    },
    show_language_picker: false,
    user_is_anonymous: false,
    user_info_url: '/users/userinfo/',
    user_logout_url: '/logout/',
    user_login_url: '/login/',
    locale: 'en',
    version_string: '1.0.0',
    version_sha: 'randomSHA',
    build_number: 'randomBuildNumber',
  },
  settings: [],
  isFrontendRoute: () => true,
  environmentTag: {
    color: 'error.base',
    text: 'Development2',
  },
});

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

beforeEach(async () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  mockIsEmbedded.mockReturnValue(false);
  useSelectorMock.mockReset();
});

afterEach(() => fetchMock.clearHistory().removeRoutes());

const resetUseSelectorMock = () => {
  useSelectorMock.mockReturnValueOnce({
    createdOn: '2021-04-27T18:12:38.952304',
    email: 'admin',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    roles: {
      Admin: [
        ['can_upload', 'Database'], // So we can upload data (CSV, Excel, Columnar)
        ['can_write', 'Database'], // So we can write DBs
        ['can_write', 'Dataset'], // So we can write Datasets
        ['can_write', 'Chart'], // So we can write Datasets
      ],
    },
    userId: 1,
    username: 'admin',
  });

  // The dashboard the menu is on
  useSelectorMock.mockReturnValueOnce(1);
};

test('renders', async () => {
  const mockedProps = createProps();
  // Initial Load
  resetUseSelectorMock();
  const { container } = render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });
  // expect(await screen.findByText(/Settings/i)).toBeInTheDocument();
  await waitFor(() => expect(container).toBeInTheDocument());
});

test('the New menu leaves data and SQL Lab to the dashboard', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });
  await userEvent.hover(screen.getByTestId('new-dropdown-icon'));

  expect(await screen.findByText('Chart')).toBeInTheDocument();
  expect(screen.queryByText('Data')).not.toBeInTheDocument();
  expect(screen.queryByText('SQL query')).not.toBeInTheDocument();
  expect(fetchMock.callHistory.calls(/database\/\?q/)).toHaveLength(0);
});

test('the New menu creates workspaces for users who write dashboards', async () => {
  useSelectorMock.mockReturnValueOnce({
    roles: { Editor: [['can_write', 'Dashboard']] },
  });
  useSelectorMock.mockReturnValueOnce(undefined);
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });
  await userEvent.hover(screen.getByTestId('new-dropdown-icon'));

  expect((await screen.findByText('Workspace')).closest('a')).toHaveAttribute(
    'href',
    '/workspace/list/?new=true',
  );
  expect(screen.queryByText('Chart')).not.toBeInTheDocument();
});

test('Logs out and clears local storage item redux', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });

  // Set items in local and session storage to test if they get cleared
  localStorage.setItem('redux', JSON.stringify({ test: 'test' }));
  sessionStorage.setItem('login_attempted', 'true');
  expect(localStorage.getItem('redux')).not.toBeNull();
  expect(sessionStorage.getItem('login_attempted')).not.toBeNull();

  await userEvent.hover(await screen.findByText(/Settings/i));

  // Simulate user clicking the logout button
  const logoutButton = await screen.findByText('Logout');
  await userEvent.click(logoutButton);

  // Wait for local and session storage to be cleared
  await waitFor(() => {
    expect(localStorage.getItem('redux')).toBeNull();
    expect(sessionStorage.getItem('login_attempted')).toBeNull();
  });
});

test('shows logout button when not embedded', async () => {
  mockIsEmbedded.mockReturnValue(false);
  mockIsFeatureEnabled.mockReturnValue(false);
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(await screen.findByText('Logout')).toBeInTheDocument();
});

test('shows logout button when embedded but flag is disabled', async () => {
  mockIsEmbedded.mockReturnValue(true);
  mockIsFeatureEnabled.mockReturnValue(false);
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(await screen.findByText('Logout')).toBeInTheDocument();
});

test('shows logout button when not embedded even if flag is enabled', async () => {
  mockIsEmbedded.mockReturnValue(false);
  mockIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.DisableEmbeddedSupersetLogout,
  );
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(await screen.findByText('Logout')).toBeInTheDocument();
});

test('hides logout button when embedded and flag is enabled', async () => {
  mockIsEmbedded.mockReturnValue(true);
  mockIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.DisableEmbeddedSupersetLogout,
  );
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(screen.queryByText('Logout')).not.toBeInTheDocument();
});
