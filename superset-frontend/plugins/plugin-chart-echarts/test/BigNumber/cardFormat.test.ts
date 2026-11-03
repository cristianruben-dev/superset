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
import {
  cardTextStyle,
  finiteTarget,
  kpiStatus,
} from '../../src/BigNumber/cardFormat';

test('zero is a goal and invalid targets do not create a status', () => {
  expect(finiteTarget(0)).toBe(0);
  expect(finiteTarget(null)).toBeUndefined();
  expect(finiteTarget(NaN)).toBeUndefined();
  expect(kpiStatus(1, 0, {})).toBe('good');
  expect(kpiStatus(1, undefined, {})).toBeUndefined();
  expect(kpiStatus(null, 0, {})).toBeUndefined();
});

test('direction and an absolute neutral band affect status', () => {
  expect(kpiStatus(90, 100, { kpiDirection: 'lower' })).toBe('good');
  expect(kpiStatus(110, 100, { kpiDirection: 'lower' })).toBe('bad');
  expect(kpiStatus(105, 100, { kpiNeutralBand: 5 })).toBe('neutral');
  expect(kpiStatus(100, 100, {})).toBe('neutral');
});

test('card text retains automatic sizing until explicitly formatted', () => {
  expect(cardTextStyle({}, 'cardValue')).toEqual({});
  expect(
    cardTextStyle(
      { cardValueWrap: true, cardValueUnderline: true },
      'cardValue',
    ),
  ).toMatchObject({
    whiteSpace: 'normal',
    height: 'auto',
    textDecoration: 'underline',
  });
});
