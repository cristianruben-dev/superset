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
import localeTimeFormat from './localeTimeFormat';

test('Spanish gives month and day names', () => {
  const format = localeTimeFormat('es');
  expect(format.months?.[0]).toBe('enero');
  expect(format.shortMonths?.[0]).toBe('ene');
  expect(format.shortMonths?.[11]).toBe('dic');
  expect(format.days?.[0]).toBe('domingo');
  expect(format.shortDays?.[1]).toBe('lun');
});

test('names have no trailing dot', () => {
  expect(
    localeTimeFormat('es').shortMonths?.some(name => name.endsWith('.')),
  ).toBe(false);
});

test('English and unknown locales keep the defaults of d3', () => {
  expect(localeTimeFormat('en')).toEqual({});
  expect(localeTimeFormat('en_US')).toEqual({});
  expect(localeTimeFormat('')).toEqual({});
  expect(localeTimeFormat('not a locale')).toEqual({});
});
