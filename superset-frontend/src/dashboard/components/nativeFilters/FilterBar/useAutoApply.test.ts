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
import { AUTO_APPLY_DELAY_MS, useAutoApply } from './useAutoApply';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const setup = (overrides: Partial<Parameters<typeof useAutoApply>[0]> = {}) => {
  const apply = jest.fn();
  const props = {
    enabled: true,
    isInitialized: true,
    isApplyDisabled: false,
    apply,
    ...overrides,
  };
  const hook = renderHook(p => useAutoApply(p), { initialProps: props });
  return { apply, props, ...hook };
};

test('applies pending selections after a short delay', () => {
  const { apply } = setup();
  expect(apply).not.toHaveBeenCalled();
  jest.advanceTimersByTime(AUTO_APPLY_DELAY_MS);
  expect(apply).toHaveBeenCalledTimes(1);
});

test('does nothing when filters are applied with the Apply button', () => {
  const { apply } = setup({ enabled: false });
  jest.advanceTimersByTime(AUTO_APPLY_DELAY_MS * 2);
  expect(apply).not.toHaveBeenCalled();
});

test('waits for the filter bar to initialize', () => {
  const { apply, props, rerender } = setup({ isInitialized: false });
  jest.advanceTimersByTime(AUTO_APPLY_DELAY_MS * 2);
  expect(apply).not.toHaveBeenCalled();

  rerender({ ...props, isInitialized: true });
  jest.advanceTimersByTime(AUTO_APPLY_DELAY_MS);
  expect(apply).toHaveBeenCalledTimes(1);
});

test('does nothing while there is nothing valid to apply', () => {
  const { apply } = setup({ isApplyDisabled: true });
  jest.advanceTimersByTime(AUTO_APPLY_DELAY_MS * 2);
  expect(apply).not.toHaveBeenCalled();
});

test('coalesces quick successive changes into one apply', () => {
  const { apply, props, rerender } = setup();
  jest.advanceTimersByTime(AUTO_APPLY_DELAY_MS / 2);
  rerender({ ...props, apply: jest.fn() });
  jest.advanceTimersByTime(AUTO_APPLY_DELAY_MS);
  expect(apply).not.toHaveBeenCalled();
});
