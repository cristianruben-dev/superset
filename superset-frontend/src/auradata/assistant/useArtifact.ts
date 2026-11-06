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
import { useCallback, useEffect, useState } from 'react';
import { fetchArtifact, restoreArtifact } from './client';
import type { Artifact } from './types';

/**
 * A document, following its last version as the answer writes it. `viewing` holds an
 * earlier one being read, which a new version does not take away from under the reader.
 */
export function useArtifact(id: string | null, live: number | undefined) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setViewing(null);
    setArtifact(null);
    setFailed(false);
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    let current = true;
    fetchArtifact(id, viewing ?? undefined).then(
      found => {
        if (current) {
          setArtifact(found);
          setFailed(false);
        }
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [id, live, viewing]);

  /** Goes back to a version: the document moves on to the copy of it. */
  const restore = useCallback(
    async (version: number) => {
      if (!id) return;
      const restored = await restoreArtifact(id, version);
      setViewing(null);
      setArtifact(restored);
    },
    [id],
  );

  return {
    artifact,
    viewing,
    failed,
    view: setViewing,
    restore,
    replace: setArtifact,
  };
}
