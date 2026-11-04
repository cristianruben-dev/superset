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
import { render, screen } from 'spec/helpers/testing-library';
import { supersetTheme } from '@apache-superset/core/theme';
import { DeviceFrame, deviceFrameSize, deviceScale } from './DeviceFrame';
import {
  DEFAULT_MOBILE_DEVICE,
  MOBILE_DEVICES,
  deviceById,
  mobileViewSettings,
  pixelsOf,
  safeHeightOf,
  setMobileViewSettings,
} from './mobileDevices';
import { overlappingBoxes } from './MobileLayoutEditor';

afterEach(() => {
  setMobileViewSettings({
    mode: 'work',
    device: DEFAULT_MOBILE_DEVICE,
    fit: true,
    safeArea: true,
  });
  window.localStorage.clear();
});

test('every phone has a safe area inside its screen', () => {
  MOBILE_DEVICES.forEach(device => {
    expect(safeHeightOf(device)).toBeGreaterThan(device.height * 0.8);
    expect(device.width).toBeGreaterThanOrEqual(375);
  });
  const pro = deviceById('iphone-17-pro');
  expect(safeHeightOf(pro)).toBe(874 - 62 - 34);
  expect(pixelsOf(pro)).toEqual({ width: 1206, height: 2622 });
});

test('an unknown phone falls back to the default one', () => {
  expect(deviceById('nokia-3310').id).toBe(DEFAULT_MOBILE_DEVICE);
  expect(deviceById(undefined).id).toBe(DEFAULT_MOBILE_DEVICE);
});

test('the phone fits the room of the editor, never larger than it is', () => {
  const device = deviceById('iphone-17-pro-max');
  const frame = deviceFrameSize(device);
  expect(frame).toEqual({ width: 464, height: 980 });
  expect(deviceScale(device, { width: 2000, height: 2000 }, true)).toBe(1);
  const fitted = deviceScale(device, { width: 800, height: 600 }, true);
  expect(fitted).toBeLessThan(1);
  expect(frame.height * fitted).toBeLessThanOrEqual(600);
  expect(deviceScale(device, { width: 800, height: 600 }, false)).toBe(1);
});

test('the view settings are kept for the next visit', () => {
  setMobileViewSettings({ device: 'iphone-se', mode: 'preview' });
  expect(mobileViewSettings()).toMatchObject({
    device: 'iphone-se',
    mode: 'preview',
  });
  expect(JSON.parse(window.localStorage.getItem('mibi.mobileView')!)).toEqual(
    expect.objectContaining({ device: 'iphone-se' }),
  );
});

test('the frame names the phone and marks what the safe area leaves out', () => {
  render(
    <DeviceFrame device={deviceById('iphone-17-pro')} scale={1} safeArea>
      <div>page</div>
    </DeviceFrame>,
    { useTheme: true },
  );
  expect(screen.getByTestId('mibi-device-caption')).toHaveTextContent(
    'iPhone 17 Pro',
  );
  expect(screen.getByTestId('mibi-device-caption')).toHaveTextContent(
    '1206 × 2622 px',
  );
  expect(screen.getByTestId('mibi-device-viewport')).toHaveStyle({
    top: '62px',
    bottom: '34px',
  });
  expect(screen.getByTestId('mibi-safe-top')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-safe-bottom')).toBeInTheDocument();
  expect(screen.getByText('page')).toBeInTheDocument();
});

test('a phone with a home button has no bottom inset to mark', () => {
  render(
    <DeviceFrame device={deviceById('iphone-se')} scale={1} safeArea>
      <div />
    </DeviceFrame>,
    { useTheme: true },
  );
  expect(screen.queryByTestId('mibi-safe-bottom')).not.toBeInTheDocument();
});

test('boxes that cover part of another are flagged', () => {
  const box = (id: string, y: number) => ({
    id,
    x: 0,
    y,
    width: 12,
    height: 6,
  });
  expect([...overlappingBoxes([box('a', 0), box('b', 6)])]).toEqual([]);
  expect([
    ...overlappingBoxes([box('a', 0), box('b', 5), box('c', 20)]),
  ]).toEqual(['a', 'b']);
});

test('the preview draws the bars and the filter rail a viewer has', () => {
  render(
    <DeviceFrame
      device={deviceById('iphone-16')}
      scale={1}
      safeArea={false}
      viewer={{ title: 'Ventas', rail: true, theme: supersetTheme }}
    >
      <div />
    </DeviceFrame>,
    { useTheme: true },
  );
  expect(screen.getByTestId('mibi-device-viewer-bars')).toHaveTextContent(
    'Ventas',
  );
  expect(screen.getByTestId('mibi-device-viewer-rail')).toBeInTheDocument();
  expect(screen.queryByTestId('mibi-safe-top')).not.toBeInTheDocument();
});
