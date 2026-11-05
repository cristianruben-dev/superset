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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { acceptPrivacy, fetchModels } from './client';
import type {
  AssistantAccess,
  AssistantBudget,
  AssistantModels,
} from './types';

const NO_LIMIT: AssistantBudget = { level: 'ok', scope: null };

/**
 * What this report offers of the assistant. It stays hidden unless the server says it
 * answers here: on, with a key, for a user of a browser session, in this workspace.
 */
export function useAssistantAccess(dashboardId: number): AssistantAccess {
  const [answer, setAnswer] = useState<AssistantModels | null>(null);
  useEffect(() => {
    let live = true;
    fetchModels(dashboardId).then(
      result => live && setAnswer(result),
      () => live && setAnswer(null),
    );
    return () => {
      live = false;
    };
  }, [dashboardId]);

  const accept = useCallback(async () => {
    await acceptPrivacy();
    setAnswer(current => current && { ...current, privacy_accepted: true });
  }, []);

  return useMemo(() => {
    const models = answer?.available ? answer.models : [];
    return {
      models,
      editModels: answer?.edit_available ? models : [],
      privacyAccepted: !!answer?.privacy_accepted,
      budget: answer?.budget ?? NO_LIMIT,
      acceptPrivacy: accept,
    };
  }, [accept, answer]);
}
