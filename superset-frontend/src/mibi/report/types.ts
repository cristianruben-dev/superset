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

/**
 * Report interactivity settings kept in the dashboard layout (position_json),
 * so they save, undo and export with the dashboard.
 */

/** On a top level tab: the page accepts "Drill through" on these columns. */
export interface DrillthroughPage {
  columns: string[];
}

export const DRILLTHROUGH_PAGE_KEY = 'mibiDrillthrough';

/** What a bookmark brings back when applied. */
export interface BookmarkOptions {
  /** Filter and cross-filter selections */
  data: boolean;
  /** Which objects are shown or hidden */
  display: boolean;
  /** The page it was on */
  page: boolean;
}

/** A saved view of the report, as Power BI bookmarks. */
export interface Bookmark {
  id: string;
  name: string;
  options: BookmarkOptions;
  /** Top level tab */
  page?: string;
  /** Selections by data mask id (native filters and cross-filters) */
  filters?: Record<
    string,
    {
      extraFormData?: Record<string, unknown>;
      filterState?: Record<string, unknown>;
    }
  >;
  /** Hidden state of every chart and design element, by layout id */
  visibility?: Record<string, boolean>;
}

/** On the layout root: the bookmarks of the report, in order. */
export const BOOKMARKS_KEY = 'mibiBookmarks';
