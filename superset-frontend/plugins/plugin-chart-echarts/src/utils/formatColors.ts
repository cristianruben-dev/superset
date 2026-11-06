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

/*
 * Colors a chart falls back on when its format stores none. They belong to the
 * data drawn, not to the look of the app, so they stay the same in every theme.
 */

/** Reference lines, ratio lines, gauge targets and waterfall connectors. */
export const FORMAT_LINE_COLOR =
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#666666';

/** The handle of the category scroll, readable over a light or a dark report. */
export const CATEGORY_SCROLL_FILL_COLOR =
  // eslint-disable-next-line theme-colors/no-literal-colors
  'rgba(128, 128, 128, 0.35)';

/** The area of a scatter above the ratio line. */
export const SCATTER_UPPER_SHADE_COLOR =
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#2563eb';

/** The area of a scatter below the ratio line. */
export const SCATTER_LOWER_SHADE_COLOR =
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#10b981';

/**
 * The color `mixColors` fades towards. The channels are spelled out because
 * `mixColors` reads numbers and would take the keyword `transparent` for opaque.
 */
export const FADED_COLOR =
  // eslint-disable-next-line theme-colors/no-literal-colors
  'rgba(0,0,0,0)';
