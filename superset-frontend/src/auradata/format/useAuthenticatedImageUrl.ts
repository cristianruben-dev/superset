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

const AUTH_IMAGE_PREFIXES = [
  '/api/v1/dashboard_image/',
  '/api/v1/dashboard_background/',
];

const blobUrlCache = new Map<string, Promise<string>>();

export function resetAuthenticatedImageCache(): void {
  blobUrlCache.clear();
}

function hasGuestToken(): boolean {
  try {
    return Boolean(SupersetClient.getGuestToken());
  } catch {
    return false;
  }
}

export function needsGuestImageFetch(url: string | undefined): url is string {
  return (
    Boolean(url) &&
    AUTH_IMAGE_PREFIXES.some(prefix => url!.startsWith(prefix)) &&
    hasGuestToken()
  );
}

function fetchGuestImageBlobUrl(endpoint: string): Promise<string> {
  const cached = blobUrlCache.get(endpoint);
  if (cached) return cached;
  const promise = SupersetClient.get({
    endpoint,
    parseMethod: 'raw',
  })
    .then(async response => {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    })
    .catch(error => {
      blobUrlCache.delete(endpoint);
      throw error;
    });
  blobUrlCache.set(endpoint, promise);
  return promise;
}

/**
 * Resolves uploaded dashboard images and backgrounds via SupersetClient when
 * running under an embedded guest token, because browser `<img>` and CSS
 * `url(...)` requests do not attach `X-GuestToken`.
 */
export function useAuthenticatedImageUrl(url: string | undefined): {
  url: string | undefined;
  loading: boolean;
  broken: boolean;
} {
  const requiresAuthFetch = needsGuestImageFetch(url);
  const [resolved, setResolved] = useState<{
    source: string;
    blobUrl?: string;
    broken: boolean;
  } | null>(null);

  useEffect(() => {
    if (!requiresAuthFetch || !url) {
      setResolved(null);
      return undefined;
    }
    let active = true;
    fetchGuestImageBlobUrl(url)
      .then(blobUrl => {
        if (active) {
          setResolved({ source: url, blobUrl, broken: false });
        }
      })
      .catch(() => {
        if (active) {
          setResolved({ source: url, broken: true });
        }
      });
    return () => {
      active = false;
    };
  }, [requiresAuthFetch, url]);

  if (!requiresAuthFetch) {
    return { url, loading: false, broken: false };
  }
  if (!resolved || resolved.source !== url) {
    return { url: undefined, loading: true, broken: false };
  }
  return {
    url: resolved.blobUrl,
    loading: false,
    broken: resolved.broken,
  };
}
