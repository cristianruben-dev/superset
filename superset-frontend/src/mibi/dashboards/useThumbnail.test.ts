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
import { renderHook } from '@testing-library/react-hooks';
import fetchMock from 'fetch-mock';
import { THUMBNAIL_MAX_ATTEMPTS, useThumbnail } from './useThumbnail';

const THUMB = 'glob:*/api/v1/dashboard/1/thumbnail/abc/';
const URL_PATH = '/api/v1/dashboard/1/thumbnail/abc/';

const image = () =>
  new Response(new Blob(['png'], { type: 'image/png' }), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });

const computing = () =>
  new Response(JSON.stringify({ message: 'OK Async' }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  jest.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:dashboard-1');
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = jest.fn();
  }
  jest.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('returns nothing without a thumbnail URL', () => {
  const { result } = renderHook(() => useThumbnail(null));

  expect(result.current).toBeNull();
  expect(fetchMock.callHistory.calls(THUMB)).toHaveLength(0);
});

test('returns the screenshot once it is ready', async () => {
  fetchMock.get(THUMB, image);
  const { result, waitForNextUpdate } = renderHook(() =>
    useThumbnail(URL_PATH),
  );

  await waitForNextUpdate();

  expect(result.current).toBe('blob:dashboard-1');
});

test('asks again while the worker renders the screenshot', async () => {
  // Timers keep running so the polling of waitFor still works
  jest.useFakeTimers({ advanceTimers: true });
  let calls = 0;
  fetchMock.get(THUMB, () => {
    calls += 1;
    return calls < 3 ? computing() : image();
  });
  const { result, waitFor } = renderHook(() => useThumbnail(URL_PATH));

  await waitFor(() => expect(calls).toBe(1));
  expect(result.current).toBeNull();
  jest.advanceTimersByTime(2000);
  await waitFor(() => expect(calls).toBe(2));
  jest.advanceTimersByTime(3000);
  await waitFor(() => expect(result.current).toBe('blob:dashboard-1'));
  expect(calls).toBe(3);
});

test('gives up after the last attempt', async () => {
  // Timers keep running so the polling of waitFor still works
  jest.useFakeTimers({ advanceTimers: true });
  let calls = 0;
  fetchMock.get(THUMB, () => {
    calls += 1;
    return computing();
  });
  const { result, waitFor } = renderHook(() => useThumbnail(URL_PATH));

  for (let attempt = 1; attempt <= THUMBNAIL_MAX_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await waitFor(() => expect(calls).toBe(attempt));
    jest.advanceTimersByTime(10000);
  }
  jest.advanceTimersByTime(60000);

  expect(calls).toBe(THUMBNAIL_MAX_ATTEMPTS);
  expect(result.current).toBeNull();
});
