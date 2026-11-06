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
import { useCallback, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { deleteAttachment, uploadAttachment } from './client';

/**
 * What the composer takes. These only spare a useless upload, and they follow
 * `attachments.py`: the server reads the real type and decides.
 */
export const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 8_000_000;

/** An image of the next message: its `id` arrives when the server has taken it. */
export interface ComposerImage {
  key: string;
  name: string;
  id?: string;
}

/** Why the composer does not even try to upload a file, if it does not. */
export function refusalOf(file: File, held: number): string | null {
  if (held >= MAX_IMAGES) {
    return t('A message takes up to %s images.', MAX_IMAGES);
  }
  if (file.type && !ACCEPTED_IMAGES.includes(file.type)) {
    return t('Use a PNG, JPEG or WEBP image.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return t('This image is larger than 8 MB.');
  }
  return null;
}

let nextKey = 0;

/**
 * The images waiting in the composer. Each one uploads as soon as it arrives, so a
 * refused file says so at once, and what shows is what the server kept.
 */
export function useComposerImages() {
  const { addDangerToast } = useToasts();
  const [images, setImages] = useState<ComposerImage[]>([]);
  const held = useRef(0);

  const drop = useCallback((key: string) => {
    held.current -= 1;
    setImages(current => current.filter(item => item.key !== key));
  }, []);

  const add = useCallback(
    (files: File[]) => {
      files.forEach(file => {
        const refusal = refusalOf(file, held.current);
        if (refusal) {
          addDangerToast(refusal);
          return;
        }
        held.current += 1;
        nextKey += 1;
        const key = `image-${nextKey}`;
        setImages(current => [...current, { key, name: file.name }]);
        uploadAttachment(file).then(
          ({ id }) =>
            setImages(current =>
              current.map(item => (item.key === key ? { ...item, id } : item)),
            ),
          (error: Error) => {
            drop(key);
            addDangerToast(error.message);
          },
        );
      });
    },
    [addDangerToast, drop],
  );

  /** Takes one out. One left behind on the server goes with the nightly purge. */
  const remove = useCallback(
    ({ key, id }: ComposerImage) => {
      drop(key);
      if (id) deleteAttachment(id).catch(() => undefined);
    },
    [drop],
  );

  /** Leaves the composer empty: a message took them. */
  const clear = useCallback(() => {
    held.current = 0;
    setImages([]);
  }, []);

  return { images, add, remove, clear };
}
