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
import type { TimeLocaleDefinition } from 'd3-time-format';

type Names = 'long' | 'short';

const names = (
  locale: string,
  count: number,
  field: 'month' | 'weekday',
  width: Names,
  at: (index: number) => number,
): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, {
    [field]: width,
    timeZone: 'UTC',
  });
  // Some locales abbreviate with a trailing dot ("ene."); axes read cleaner without it
  return Array.from({ length: count }, (_, index) =>
    formatter.format(at(index)).replace(/\.$/, ''),
  );
};

/**
 * The month and day names of d3's time formats (axis labels, smart dates) for
 * the language of the app. d3 only knows English; the names come from `Intl`,
 * so every language the browser knows works without a table of our own.
 * English, and a locale `Intl` rejects, keep d3's defaults.
 */
export default function localeTimeFormat(
  locale: string,
): Partial<TimeLocaleDefinition> {
  const language = locale.replace('_', '-').split('-')[0].toLowerCase();
  if (!language || language === 'en') {
    return {};
  }
  try {
    // 2017-01-01 is a Sunday, the first day of d3's `days`
    const day = (index: number) => Date.UTC(2017, 0, 1 + index);
    const month = (index: number) => Date.UTC(2017, index, 1);
    return {
      days: names(
        locale,
        7,
        'weekday',
        'long',
        day,
      ) as TimeLocaleDefinition['days'],
      shortDays: names(
        locale,
        7,
        'weekday',
        'short',
        day,
      ) as TimeLocaleDefinition['shortDays'],
      months: names(
        locale,
        12,
        'month',
        'long',
        month,
      ) as TimeLocaleDefinition['months'],
      shortMonths: names(
        locale,
        12,
        'month',
        'short',
        month,
      ) as TimeLocaleDefinition['shortMonths'],
    };
  } catch {
    return {};
  }
}
