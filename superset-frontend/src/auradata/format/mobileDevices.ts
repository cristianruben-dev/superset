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
import { useEffect, useState } from 'react';

/**
 * The phones the mobile layout is previewed on, in portrait. Sizes are in
 * points (CSS pixels); the safe area is what the status bar, the notch or the
 * Dynamic Island and the home indicator leave to a page.
 */
export interface MobileDevice {
  id: string;
  name: string;
  /** Screen in points (CSS pixels) */
  width: number;
  height: number;
  /** Pixels per point */
  scale: number;
  /** Insets of the safe area, in points */
  safeTop: number;
  safeBottom: number;
  /** Radius of the corners of the screen, in points */
  radius: number;
  cutout: 'island' | 'notch' | 'none';
  /** A home button below the screen instead of a home indicator */
  homeButton?: boolean;
}

export const MOBILE_DEVICES: MobileDevice[] = [
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    width: 375,
    height: 667,
    scale: 2,
    safeTop: 20,
    safeBottom: 0,
    radius: 0,
    cutout: 'none',
    homeButton: true,
  },
  {
    id: 'iphone-13-mini',
    name: 'iPhone 13 mini',
    width: 375,
    height: 812,
    scale: 3,
    safeTop: 50,
    safeBottom: 34,
    radius: 44,
    cutout: 'notch',
  },
  {
    id: 'iphone-14',
    name: 'iPhone 14',
    width: 390,
    height: 844,
    scale: 3,
    safeTop: 47,
    safeBottom: 34,
    radius: 47,
    cutout: 'notch',
  },
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    width: 393,
    height: 852,
    scale: 3,
    safeTop: 59,
    safeBottom: 34,
    radius: 55,
    cutout: 'island',
  },
  {
    id: 'iphone-17-pro',
    name: 'iPhone 17 Pro',
    width: 402,
    height: 874,
    scale: 3,
    safeTop: 62,
    safeBottom: 34,
    radius: 62,
    cutout: 'island',
  },
  {
    id: 'iphone-air',
    name: 'iPhone Air',
    width: 420,
    height: 912,
    scale: 3,
    safeTop: 68,
    safeBottom: 34,
    radius: 62,
    cutout: 'island',
  },
  {
    id: 'iphone-16-plus',
    name: 'iPhone 16 Plus',
    width: 430,
    height: 932,
    scale: 3,
    safeTop: 59,
    safeBottom: 34,
    radius: 55,
    cutout: 'island',
  },
  {
    id: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max',
    width: 440,
    height: 956,
    scale: 3,
    safeTop: 62,
    safeBottom: 34,
    radius: 62,
    cutout: 'island',
  },
];

export const DEFAULT_MOBILE_DEVICE = 'iphone-17-pro';

export const deviceById = (id: string | undefined): MobileDevice =>
  MOBILE_DEVICES.find(device => device.id === id) ??
  MOBILE_DEVICES.find(device => device.id === DEFAULT_MOBILE_DEVICE)!;

/** Height a page can use on the device, between its safe insets. */
export const safeHeightOf = (device: MobileDevice) =>
  device.height - device.safeTop - device.safeBottom;

/** The screen of the device in pixels, as its maker gives it. */
export const pixelsOf = (device: MobileDevice) => ({
  width: Math.round(device.width * device.scale),
  height: Math.round(device.height * device.scale),
});

/** How the editor shows the mobile layout: a preference of the author. */
export interface MobileViewSettings {
  /** Arrange the visuals, or see the page as a phone shows it */
  mode: 'work' | 'preview';
  device: string;
  /** Fit the device to the screen, or show it at its own size */
  fit: boolean;
  /** Mark the areas of the screen the page does not use */
  safeArea: boolean;
}

const KEY = 'auradata.mobileView';
const EVENT = 'auradata:mobile-view';
const DEFAULT_SETTINGS: MobileViewSettings = {
  mode: 'work',
  device: DEFAULT_MOBILE_DEVICE,
  fit: true,
  safeArea: true,
};

function read(): MobileViewSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    return {
      ...DEFAULT_SETTINGS,
      ...(raw && typeof raw === 'object' ? raw : undefined),
      device: deviceById(raw?.device).id,
      mode: raw?.mode === 'preview' ? 'preview' : 'work',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let settings = read();

export const mobileViewSettings = () => settings;

export function setMobileViewSettings(change: Partial<MobileViewSettings>) {
  settings = { ...settings, ...change };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // The preference lasts until the page reloads
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useMobileViewSettings(): MobileViewSettings {
  const [value, setValue] = useState(settings);
  useEffect(() => {
    const onChange = () => setValue(settings);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}
