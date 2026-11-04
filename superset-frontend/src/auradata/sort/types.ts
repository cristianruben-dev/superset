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
import type { QueryFormData } from '@superset-ui/core';
import type { Dataset } from '@superset-ui/chart-controls';
import type { SortChoice } from './axisChoices';

/**
 * The sort of a visual as Power BI shows it: a field and a direction as read
 * on screen (ascending puts the smallest value first, left to right or top to
 * bottom), whatever the chart stores underneath.
 */
export interface VisualSort {
  /** Value of one of the adapter's choices */
  by: string;
  ascending: boolean;
}

/** Translates a visual's sort to and from the controls of its chart type. */
export interface SortAdapter {
  /** What the visual can be sorted by, or null when it cannot be sorted. */
  options: (
    formData: QueryFormData,
    datasource?: Dataset,
  ) => SortChoice[] | null;
  /** The sort saved in the chart, if any. */
  current: (formData: QueryFormData) => VisualSort | undefined;
  /** The form data settings that apply the sort. */
  toFormData: (
    sort: VisualSort,
    formData: QueryFormData,
  ) => Partial<QueryFormData>;
}
