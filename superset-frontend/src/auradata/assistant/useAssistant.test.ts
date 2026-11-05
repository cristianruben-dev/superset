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
import { act, renderHook, waitFor } from '@testing-library/react';
import { acceptPrivacy, fetchModels } from './client';
import type { OfferedModel } from './types';
import { useAssistantAccess } from './useAssistant';

jest.mock('./client', () => ({
  acceptPrivacy: jest.fn(() => Promise.resolve()),
  fetchModels: jest.fn(),
}));

const fetched = fetchModels as jest.Mock;
const models = [{ id: 'claude-sonnet-5-5' }] as OfferedModel[];

beforeEach(() => {
  fetched.mockReset();
});

test('it asks about this report and offers what the server says', async () => {
  const budget = { level: 'warning', scope: 'global' };
  fetched.mockResolvedValue({
    available: true,
    edit_available: false,
    privacy_accepted: true,
    budget,
    models,
  });

  const { result } = renderHook(() => useAssistantAccess(7));

  await waitFor(() => expect(result.current.models).toEqual(models));
  expect(fetched).toHaveBeenCalledWith(7);
  expect(result.current.editModels).toEqual([]);
  expect(result.current.privacyAccepted).toBe(true);
  expect(result.current.budget).toEqual(budget);
});

test('without an answer it offers nothing and nobody has accepted', async () => {
  fetched.mockRejectedValue(new Error('down'));

  const { result } = renderHook(() => useAssistantAccess(7));

  await waitFor(() => expect(fetched).toHaveBeenCalled());
  expect(result.current.models).toEqual([]);
  expect(result.current.privacyAccepted).toBe(false);
});

test('accepting the notice is stored, and only then the panel opens', async () => {
  fetched.mockResolvedValue({
    available: true,
    edit_available: true,
    privacy_accepted: false,
    models,
  });
  const { result } = renderHook(() => useAssistantAccess(7));
  await waitFor(() => expect(result.current.models).toEqual(models));

  await act(() => result.current.acceptPrivacy());

  expect(acceptPrivacy).toHaveBeenCalledTimes(1);
  expect(result.current.privacyAccepted).toBe(true);
});
