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

/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { getDefaultTooltip } from './tooltip';
import { TOOLTIP_OVERFLOW_MARGIN } from '../constants';
import type { Refs } from '../types';

const MARGIN = TOOLTIP_OVERFLOW_MARGIN;

function setViewport(width: number, height: number) {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: height,
    configurable: true,
  });
}

/** A tooltip whose chart sits at the given rect, as ECharts sees it */
function tooltipOn(rect: Partial<DOMRect>) {
  const div = document.createElement('div');
  jest.spyOn(div, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 1000,
    height: 800,
    top: 0,
    left: 0,
    right: 1000,
    bottom: 800,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
  const divRef = React.createRef<HTMLDivElement>();
  Object.defineProperty(divRef, 'current', { value: div });
  const refs: Refs = { divRef };
  return getDefaultTooltip(refs);
}

/** Where the tooltip goes for a cursor at this point of the chart */
function placeAt(
  tooltip: ReturnType<typeof getDefaultTooltip>,
  cursor: [number, number],
  size: [number, number],
  dom: HTMLDivElement | null = document.createElement('div'),
) {
  return tooltip.position(cursor, {} as any, dom, {} as any, {
    contentSize: size,
    viewSize: size,
  });
}

test('the tooltip never takes the pointer, so it cannot be touched by accident', () => {
  setViewport(1200, 1000);
  const tooltip = tooltipOn({});
  const dom = document.createElement('div');
  placeAt(tooltip, [100, 100], [200, 150], dom);

  expect(dom.style.pointerEvents).toBe('none');
  expect(tooltip.enterable).toBe(false);
  expect(tooltip.confine).toBe(true);
});

test('a cursor in the top left sends the tooltip to the bottom right corner', () => {
  setViewport(1200, 1000);
  const tooltip = tooltipOn({});

  expect(placeAt(tooltip, [100, 100], [200, 150])).toEqual([
    1000 - 200 - MARGIN,
    800 - 150 - MARGIN,
  ]);
});

test('a cursor in the bottom right sends the tooltip to the top left corner', () => {
  setViewport(1200, 1000);
  const tooltip = tooltipOn({});

  expect(placeAt(tooltip, [900, 700], [200, 150])).toEqual([MARGIN, MARGIN]);
});

test('the other two quadrants use the opposite corners', () => {
  setViewport(1200, 1000);
  const tooltip = tooltipOn({});

  // Top right cursor: bottom left corner
  expect(placeAt(tooltip, [900, 100], [200, 150])).toEqual([
    MARGIN,
    800 - 150 - MARGIN,
  ]);
  // Bottom left cursor: top right corner
  expect(placeAt(tooltip, [100, 700], [200, 150])).toEqual([
    1000 - 200 - MARGIN,
    MARGIN,
  ]);
});

test('the corner is measured in the chart, not the page around it', () => {
  setViewport(1200, 1000);
  const onPage = tooltipOn({ x: 300, y: 120 });
  const atOrigin = tooltipOn({ x: 0, y: 0 });

  expect(placeAt(onPage, [100, 100], [200, 150])).toEqual(
    placeAt(atOrigin, [100, 100], [200, 150]),
  );
});

test('a long tooltip is capped in height and still sits in its corner', () => {
  setViewport(1200, 1000);
  const tooltip = tooltipOn({});
  const dom = document.createElement('div');

  const [x, y] = placeAt(tooltip, [100, 100], [200, 2000], dom);

  expect(dom.style.maxHeight).toBe('800px');
  expect(dom.style.overflow).toBe('auto');
  expect(x).toBe(1000 - 200 - MARGIN);
  expect(y).toBe(MARGIN);
});

test('a tooltip larger than the chart stays at the margin instead of leaving it', () => {
  setViewport(1200, 1000);
  const tooltip = tooltipOn({ width: 300, height: 200 });

  expect(placeAt(tooltip, [100, 100], [400, 250])).toEqual([MARGIN, MARGIN]);
});
