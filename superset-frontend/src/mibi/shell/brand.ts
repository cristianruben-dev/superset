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

/* eslint-disable theme-colors/no-literal-colors -- fixed brand colors, the same in every theme */

/**
 * AuraData brand constants (https://auradata.mx/brand-guidelines). The theme
 * tokens in superset/mibi_config.py hold the interface colors; these are the
 * fixed brand accents that do not change with light or dark mode.
 */
export const AURA_BLUE = '#2563EB';
export const AURA_VIOLET = '#7C3AED';
export const AURA_GREEN = '#10B981';

/** The text gradient of the brand: 100°, blue, violet at 55%, green. */
export const AURA_GRADIENT = `linear-gradient(100deg, ${AURA_BLUE} 0%, ${AURA_VIOLET} 55%, ${AURA_GREEN} 100%)`;

/** Product name shown next to the AuraData logo. */
export const PRODUCT_TAG = 'BI';

/** Brand accents for icons and highlights: the color and a tint behind it. */
export const AURA_TONES = {
  blue: { color: AURA_BLUE, tint: 'rgba(37, 99, 235, 0.1)' },
  violet: { color: AURA_VIOLET, tint: 'rgba(124, 58, 237, 0.1)' },
  green: { color: '#059669', tint: 'rgba(16, 185, 129, 0.12)' },
  amber: { color: '#D97706', tint: 'rgba(245, 158, 11, 0.12)' },
} as const;

export type AuraTone = keyof typeof AURA_TONES;
