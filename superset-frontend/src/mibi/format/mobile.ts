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
 * Below this screen width a page shows its mobile layout, when the author made
 * one. Without one the page is the same canvas, scaled to the width.
 */
export const MOBILE_BREAKPOINT = 640;

/**
 * Whether the screen is phone sized. The screen, not the canvas: side panels
 * (filters, the builder) narrow the canvas on desktops too. The screen width
 * counts as well, since a page wider than a phone widens its window.
 */
export const isPhoneScreen = () =>
  Math.min(window.innerWidth, window.screen?.width || Infinity) <
  MOBILE_BREAKPOINT;

export function usePhoneScreen(): boolean {
  const [value, setValue] = useState(isPhoneScreen);
  useEffect(() => {
    const onResize = () => setValue(isPhoneScreen());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return value;
}

const EDITING_EVENT = 'mibi:mobile-editing';
let editing = false;

/** Whether the editor shows the mobile layout of the page instead of its canvas. */
export const isMobileEditing = () => editing;

export function setMobileEditing(value: boolean) {
  if (editing === value) return;
  editing = value;
  window.dispatchEvent(new CustomEvent(EDITING_EVENT));
}

export function useMobileEditing(): boolean {
  const [value, setValue] = useState(editing);
  useEffect(() => {
    const onChange = () => setValue(editing);
    window.addEventListener(EDITING_EVENT, onChange);
    return () => window.removeEventListener(EDITING_EVENT, onChange);
  }, []);
  return value;
}

const SELECTION_EVENT = 'mibi:mobile-selection';
let selectedBox: string | null = null;

/** Chooses the object of the mobile layout the editor works on. */
export function selectMobileBox(id: string | null) {
  if (selectedBox === id) return;
  selectedBox = id;
  window.dispatchEvent(new CustomEvent(SELECTION_EVENT));
}

export function useSelectedMobileBox(): string | null {
  const [value, setValue] = useState(selectedBox);
  useEffect(() => {
    const onChange = () => setValue(selectedBox);
    window.addEventListener(SELECTION_EVENT, onChange);
    return () => window.removeEventListener(SELECTION_EVENT, onChange);
  }, []);
  return value;
}
