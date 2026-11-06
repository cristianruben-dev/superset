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
import { uploadAttachment } from './client';
import { MAX_IMAGES, refusalOf, useComposerImages } from './useComposerImages';

const mockAddDangerToast = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: mockAddDangerToast }),
}));

jest.mock('./client', () => ({
  uploadAttachment: jest.fn(),
  deleteAttachment: jest.fn(() => Promise.resolve()),
}));

const upload = uploadAttachment as jest.Mock;

const file = (type = 'image/png', size = 10) => {
  const made = new File(['x'], 'captura.png', { type });
  Object.defineProperty(made, 'size', { value: size });
  return made;
};

beforeEach(() => {
  mockAddDangerToast.mockClear();
  upload.mockReset();
});

test('the composer only tries what can pass', () => {
  expect(refusalOf(file(), 0)).toBeNull();
  expect(refusalOf(file('image/webp'), MAX_IMAGES - 1)).toBeNull();
  // A pasted file can come without a type: the server reads the bytes
  expect(refusalOf(file(''), 0)).toBeNull();
  expect(refusalOf(file('image/svg+xml'), 0)).toBe(
    'Use a PNG, JPEG or WEBP image.',
  );
  expect(refusalOf(file('image/gif'), 0)).toBe(
    'Use a PNG, JPEG or WEBP image.',
  );
  expect(refusalOf(file('image/png', 8_000_001), 0)).toBe(
    'This image is larger than 8 MB.',
  );
  expect(refusalOf(file(), MAX_IMAGES)).toBe('A message takes up to 5 images.');
});

test('a file the server refuses goes away with its reason', async () => {
  upload.mockRejectedValue(new Error('Use a PNG, JPEG or WEBP image.'));
  const { result } = renderHook(() => useComposerImages());

  act(() => result.current.add([file()]));
  expect(result.current.images).toHaveLength(1);

  await waitFor(() => expect(result.current.images).toHaveLength(0));
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'Use a PNG, JPEG or WEBP image.',
  );
});

test('a sixth image is refused, even while the others upload', () => {
  upload.mockReturnValue(new Promise(() => undefined));
  const { result } = renderHook(() => useComposerImages());

  act(() => result.current.add(Array.from({ length: 6 }, () => file())));

  expect(upload).toHaveBeenCalledTimes(MAX_IMAGES);
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'A message takes up to 5 images.',
  );
});
