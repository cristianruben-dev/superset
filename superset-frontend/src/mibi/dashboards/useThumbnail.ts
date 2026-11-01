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
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';

/** Waits between checks while the worker renders a thumbnail. */
export const THUMBNAIL_RETRY_DELAYS = [2000, 3000, 5000, 8000, 10000];
/** Checks before giving up and keeping the layout preview. */
export const THUMBNAIL_MAX_ATTEMPTS = 24;

/**
 * Loads a dashboard screenshot and returns an object URL for it, or null while
 * there is none. The thumbnail endpoint answers 202 while the worker renders
 * the screenshot, so it is asked again, with growing pauses, until the image
 * arrives or the attempts run out.
 */
export function useThumbnail(url?: string | null): string | null {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    setImage(null);
    if (!url) {
      return undefined;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async (attempt: number) => {
      try {
        const response = (await SupersetClient.get({
          endpoint: url,
          parseMethod: 'raw',
        })) as Response;
        if (cancelled) {
          return;
        }
        const type = response.headers.get('Content-Type') || '';
        if (response.status === 200 && type.startsWith('image/')) {
          objectUrl = URL.createObjectURL(await response.blob());
          if (!cancelled) {
            setImage(objectUrl);
          }
          return;
        }
        if (response.status === 202 && attempt + 1 < THUMBNAIL_MAX_ATTEMPTS) {
          const delay =
            THUMBNAIL_RETRY_DELAYS[
              Math.min(attempt, THUMBNAIL_RETRY_DELAYS.length - 1)
            ];
          timer = setTimeout(() => load(attempt + 1), delay);
        }
      } catch {
        // The card keeps its layout preview
      }
    };
    load(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return image;
}
