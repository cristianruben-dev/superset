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
import { getExtensionsRegistry } from '@superset-ui/core';
import { HomeBanner, HomeContent } from './home/HomePage';

/**
 * Registers the AuraData BI replacements for Superset's extension points. Called once
 * by setupCodeOverrides when the single-page app starts.
 */
export default function setupMibi() {
  const registry = getExtensionsRegistry();
  // Only fill extension points nobody else has claimed, so a deployment's own
  // overrides still win.
  const setDefault: typeof registry.set = (key, value) => {
    if (!registry.get(key)) {
      registry.set(key, value);
    }
  };
  // The home page: greeting and quick actions, then recents and dashboards.
  // Registering both the banner and the main replacement hides the default
  // collapsible sections; the "home.submenu" override drops the "Home" title.
  setDefault('home.submenu', () => null);
  setDefault('welcome.banner', HomeBanner);
  setDefault('welcome.main.replacement', HomeContent);
}
