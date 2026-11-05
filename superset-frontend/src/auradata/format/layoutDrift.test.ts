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
 * Drift guard between this report model and its Python twin
 * (superset/auradata/layout). Both run the shared fixtures of
 * tests/fixtures/auradata/layouts and must give the same results; this side is
 * the source of truth. Run with UPDATE_LAYOUT_FIXTURES=1 to write the expected
 * results after a deliberate change, then make pytest agree
 * (tests/unit_tests/auradata/layout/drift_test.py).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import type { DashboardLayout, LayoutItem } from 'src/dashboard/types';
import { topLevelTabs } from 'src/auradata/present/dashboardTabs';
import { ELEMENT_DEFAULTS } from 'src/auradata/elements/types';
import { pageObjects } from './arrange';
import { layoutToCells } from './cells';
import { columnCountOf } from './columns';
import { mobileLayoutOf, mobileSizeOf } from './mobileLayout';
import { clampToPage, freeCell, layoutToPositions, placeAt } from './positions';
import { canvasSize, mergeVisualFormat } from './styles';
import {
  ownFormat,
  sharableFormat,
  withOwnFormat,
} from './chartFormatSettings';
import { formatOf, pastedMeta } from './formatPainter';

const REPO = join(__dirname, '..', '..', '..', '..');
const FIXTURES = join(REPO, 'tests', 'fixtures', 'auradata', 'layouts');
const UPDATE = process.env.UPDATE_LAYOUT_FIXTURES === '1';

type Fn = (...args: never[]) => unknown;
const FUNCTIONS: Record<string, Fn> = {
  canvasSize: canvasSize as Fn,
  columnCountOf: columnCountOf as Fn,
  layoutToCells: layoutToCells as Fn,
  layoutToPositions: layoutToPositions as Fn,
  loadLayout: ((layout: DashboardLayout) =>
    layoutToPositions(layoutToCells(layout))) as Fn,
  freeCell: freeCell as Fn,
  clampToPage: clampToPage as Fn,
  placeAt: placeAt as Fn,
  mergeVisualFormat: mergeVisualFormat as Fn,
  sharableFormat: sharableFormat as Fn,
  ownFormat: ownFormat as Fn,
  withOwnFormat: withOwnFormat as Fn,
  formatOf: formatOf as Fn,
  pastedMeta: pastedMeta as Fn,
  mobileLayoutOf: mobileLayoutOf as Fn,
  mobileSizeOf: ((item: LayoutItem | null) =>
    mobileSizeOf(item ?? undefined)) as Fn,
  pageObjects: pageObjects as Fn,
  topLevelTabs: ((layout: DashboardLayout) =>
    topLevelTabs(layout).map(({ id, title, hidden }) => ({
      id,
      title,
      hidden,
    }))) as Fn,
};

interface Fixture {
  fn: string;
  cases: { name: string; args: unknown[]; expected: unknown }[];
}

const files = readdirSync(FIXTURES).filter(
  name => name.endsWith('.json') && name !== 'meta_keys.json',
);

// JSON has no undefined: compare as the fixture file would store it
const asJson = (value: unknown) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

test.each(files)('layout fixture %s', file => {
  const path = join(FIXTURES, file);
  const fixture: Fixture = JSON.parse(readFileSync(path, 'utf8'));
  const fn = FUNCTIONS[fixture.fn];
  expect(fn).toBeDefined();
  fixture.cases.forEach(item => {
    const actual = asJson(fn(...(item.args as never[])));
    if (UPDATE) {
      item.expected = actual;
    } else {
      expect({ name: item.name, result: actual }).toEqual({
        name: item.name,
        result: item.expected,
      });
    }
  });
  if (UPDATE) writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
});

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

test('Python knows every layout meta key the frontend uses', () => {
  const contract = JSON.parse(
    readFileSync(join(FIXTURES, 'meta_keys.json'), 'utf8'),
  );
  const known = new Set<string>([
    ...contract.layout_meta,
    ...Object.keys(contract.not_layout_meta),
  ]);
  const found = new Map<string, string>();
  const pattern = /['"`](auradata[A-Z]\w*)['"`]|\b(auradata[A-Z]\w*)\??:/g;
  [join(__dirname, '..'), join(__dirname, '..', '..', 'dashboard')]
    .flatMap(sourceFiles)
    .forEach(path => {
      const text = readFileSync(path, 'utf8');
      [...text.matchAll(pattern)].forEach(match => {
        found.set(match[1] ?? match[2], relative(REPO, path));
      });
    });
  const unknown = [...found].filter(([key]) => !known.has(key));
  // A new key: add it to meta_keys.json and to superset/auradata/layout/keys.py
  expect(unknown).toEqual([]);
  // A key nothing uses any more: drop it from both
  contract.layout_meta.forEach((key: string) => {
    expect([key, found.has(key)]).toEqual([key, true]);
  });
});

test('Python knows every kind of design element', () => {
  const contract = JSON.parse(
    readFileSync(join(FIXTURES, 'meta_keys.json'), 'utf8'),
  );
  expect(Object.keys(ELEMENT_DEFAULTS).sort()).toEqual(contract.element_kinds);
});
