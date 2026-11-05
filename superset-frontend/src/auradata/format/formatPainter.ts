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
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import {
  ELEMENT_KEY,
  elementKind,
  type ElementConfig,
  type ElementKind,
} from 'src/auradata/elements/types';
import { updateLayout } from './actions';
import {
  ownFormat,
  sharableFormat,
  withOwnFormat,
} from './chartFormatSettings';
import { VISUAL_FORMAT_KEY, type VisualFormat } from './types';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/** The settings of an element that are content rather than formatting. */
const CONTENT_KEYS: Record<ElementKind, string[]> = {
  image: ['src', 'imageId', 'alt', 'action'],
  shape: ['shape', 'text', 'action'],
  button: ['label', 'icon', 'action'],
  text: ['html'],
  filter: ['filterId', 'showInFilterBar'],
  navigator: [],
};

export interface CopiedFormat {
  sourceId: string;
  /** 'chart' or the element kind */
  source: 'chart' | ElementKind;
  box?: VisualFormat;
  style?: Partial<ElementConfig>;
}

const EVENT = 'auradata:format-painter';
let copied: CopiedFormat | null = null;
let armed = false;

const notify = () => window.dispatchEvent(new CustomEvent(EVENT));

const sourceOf = (item: LayoutItem): CopiedFormat['source'] =>
  elementKind(item.meta.componentKey) ?? 'chart';

/** The formatting of an object, without its content. */
export function formatOf(item: LayoutItem): CopiedFormat {
  const source = sourceOf(item);
  let style: Partial<ElementConfig> | undefined;
  if (source !== 'chart' && item.meta[ELEMENT_KEY]) {
    style = { ...(item.meta[ELEMENT_KEY] as ElementConfig) };
    CONTENT_KEYS[source].forEach(key => {
      delete (style as Record<string, unknown>)[key];
    });
  }
  let box = sharableFormat(item.meta[VISUAL_FORMAT_KEY] as VisualFormat);
  // The title of an element is its own text, not a template of its kind
  if (source !== 'chart' && box?.title?.template !== undefined) {
    const { template: _template, ...title } = box.title;
    box = { ...box, title };
  }
  return {
    sourceId: item.id,
    source,
    box,
    style,
  };
}

/** Copies the format of an object; the next object selected receives it. */
export function copyFormat(item: LayoutItem) {
  copied = formatOf(item);
  armed = true;
  notify();
}

export function cancelFormatPainter() {
  armed = false;
  notify();
}

export const isPainterArmed = () => armed;
export const copiedFormat = () => copied;

/** Whether the copied format brings anything to this object. */
export const canPasteFormat = (item: LayoutItem | undefined) =>
  !!copied && !!item && item.id !== copied.sourceId;

/** Gives an object the copied box and, between elements of a kind, their style. */
export const pasteFormat =
  (id: string) => (dispatch: AppDispatch, getState: GetState) => {
    const item = getState().dashboardLayout.present[id];
    if (!copied || !item) return;
    const meta = { ...item.meta };
    // What belongs to this chart stays with it
    const current = item.meta[VISUAL_FORMAT_KEY] as VisualFormat | undefined;
    let box = withOwnFormat(copied.box, ownFormat(current));
    const template = current?.title?.template;
    if (sourceOf(item) !== 'chart' && template !== undefined) {
      box = { ...box, title: { ...box?.title, template } };
    }
    if (box) meta[VISUAL_FORMAT_KEY] = box;
    else delete meta[VISUAL_FORMAT_KEY];
    if (copied.style && copied.source === sourceOf(item)) {
      meta[ELEMENT_KEY] = {
        ...(item.meta[ELEMENT_KEY] as ElementConfig),
        ...copied.style,
      };
    }
    dispatch(updateLayout({ [id]: { ...item, meta } }, `paste:${Date.now()}`));
  };

/** Re-renders the caller when something is copied or the painter disarms. */
export function useFormatPainter(): {
  copied: CopiedFormat | null;
  armed: boolean;
} {
  const [state, setState] = useState({ copied, armed });
  useEffect(() => {
    const onChange = () => setState({ copied, armed });
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}
