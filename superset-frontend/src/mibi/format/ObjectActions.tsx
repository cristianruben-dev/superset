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
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { useSelectedVisual, useSelectedVisuals } from './selection';

/** Distance to the object and to the edges of the area that scrolls. */
const GAP = 4;
/** Time to reach the buttons from the object before they go away. */
const LEAVE_DELAY = 200;
/** An object narrower than this, on screen, gets the buttons without labels. */
const COMPACT_WIDTH = 220;

/**
 * Lives outside the scaled page, in the coordinates of the window: its size
 * does not follow the zoom, and the scroll area cannot cut it.
 */
const Bar = styled.div`
  ${({ theme }) => css`
    position: fixed;
    top: 0;
    left: 0;
    z-index: 999;
    display: flex;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px;
    background: ${theme.colorBgElevated};
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadiusLG}px;
    box-shadow: ${theme.boxShadowSecondary};

    body.mibi-moving & {
      display: none;
    }

    &.compact .label {
      display: none;
    }
  `}
`;

const ActionButton = styled.button<{ $danger?: boolean }>`
  ${({ theme, $danger }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 1.5}px;
    height: 32px;
    padding: 0 ${theme.sizeUnit * 2.5}px;
    border: 0;
    border-radius: ${theme.borderRadius}px;
    background: transparent;
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM + 1}px;
    font-weight: ${theme.fontWeightStrong};
    white-space: nowrap;
    cursor: pointer;

    .anticon {
      color: ${$danger ? theme.colorError : theme.colorPrimary};
    }

    &:hover,
    &:focus-visible {
      background: ${$danger ? theme.colorErrorBg : theme.colorPrimaryBg};
      color: ${$danger ? theme.colorError : theme.colorText};
    }
  `}
`;

// The object under the pointer, shared so that only one set of buttons shows
let hovered: string | null = null;
const listeners = new Set<() => void>();

const setHovered = (id: string | null) => {
  if (hovered !== id) {
    hovered = id;
    listeners.forEach(listener => listener());
  }
};

function useHovered() {
  const [value, setValue] = useState(hovered);
  useEffect(() => {
    const onChange = () => setValue(hovered);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return value;
}

/** Where the buttons go: on the top edge, or inside when there is no room. */
export function placeActions(
  object: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>,
  area: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>,
  bar: { width: number; height: number },
): { x: number; y: number } | null {
  if (
    object.bottom <= area.top ||
    object.top >= area.bottom ||
    object.right <= area.left ||
    object.left >= area.right
  ) {
    return null;
  }
  const maxX = area.right - bar.width - GAP;
  const x = Math.max(area.left + GAP, Math.min(object.right - bar.width, maxX));
  const above = object.top - bar.height - GAP;
  const y =
    above >= area.top + GAP
      ? above
      : Math.min(
          Math.max(object.top, area.top) + GAP,
          area.bottom - bar.height - GAP,
        );
  return { x, y };
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

/**
 * The buttons of an object while the report is edited: for the object under
 * the pointer or, with no pointer on another one, the one selected. They are
 * drawn at one size at any zoom, and stay inside the visible part of the canvas.
 */
export function ObjectActions({
  id,
  onDelete,
  onFormat,
  formatTestId,
  deleteTestId,
}: {
  id: string;
  /** Left out for a locked object, which cannot be removed */
  onDelete?: MouseEventHandler<HTMLButtonElement>;
  onFormat: () => void;
  formatTestId: string;
  deleteTestId?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number>();
  const holderRef = useRef<Element | null>(null);
  const current = useHovered();
  const selected = useSelectedVisual();
  const selectedCount = useSelectedVisuals().length;
  const open =
    current === id ||
    (current === null && selected === id && selectedCount === 1);

  useEffect(() => {
    const element = anchorRef.current?.closest(
      '.dashboard-component-chart-holder, .mibi-element',
    );
    if (!element) return undefined;
    holderRef.current = element;
    const enter = () => {
      window.clearTimeout(leaveTimer.current);
      setHovered(id);
    };
    const leave = () => {
      leaveTimer.current = window.setTimeout(() => {
        if (hovered === id) setHovered(null);
      }, LEAVE_DELAY);
    };
    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointerleave', leave);
    return () => {
      element.removeEventListener('pointerenter', enter);
      element.removeEventListener('pointerleave', leave);
      window.clearTimeout(leaveTimer.current);
      if (hovered === id) setHovered(null);
    };
  }, [id]);

  // The object moves with the scroll, the zoom, a drag and a resize
  useEffect(() => {
    const bar = barRef.current;
    const holder = holderRef.current;
    if (!open || !holder || !bar) return undefined;
    let frame = 0;
    const follow = () => {
      const area = holder.closest('[data-test="mibi-canvas-outer"]');
      const rect = holder.getBoundingClientRect();
      bar.classList.toggle('compact', rect.width < COMPACT_WIDTH);
      const place = placeActions(
        rect,
        area?.getBoundingClientRect() ?? {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        },
        { width: bar.offsetWidth, height: bar.offsetHeight },
      );
      bar.style.visibility = place ? 'visible' : 'hidden';
      if (place) {
        bar.style.transform = `translate(${place.x}px, ${place.y}px)`;
      }
      frame = window.requestAnimationFrame(follow);
    };
    follow();
    return () => {
      window.cancelAnimationFrame(frame);
      bar.style.visibility = 'hidden';
    };
  }, [open]);

  return (
    <>
      <span ref={anchorRef} hidden />
      {createPortal(
        <Bar
          ref={barRef}
          className="mibi-object-actions"
          style={{ visibility: 'hidden' }}
          onPointerEnter={() => {
            window.clearTimeout(leaveTimer.current);
            setHovered(id);
          }}
          onPointerLeave={() => {
            leaveTimer.current = window.setTimeout(() => {
              if (hovered === id) setHovered(null);
            }, LEAVE_DELAY);
          }}
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={stop}
        >
          <ActionButton
            type="button"
            title={t('Format')}
            aria-label={t('Format')}
            data-test={formatTestId}
            onClick={onFormat}
          >
            <Icons.BgColorsOutlined iconSize="m" />
            <span className="label">{t('Format')}</span>
          </ActionButton>
          {onDelete && (
            <ActionButton
              type="button"
              $danger
              title={t('Delete')}
              aria-label={t('Delete')}
              data-test={deleteTestId}
              onClick={onDelete}
            >
              <Icons.DeleteOutlined iconSize="m" />
              <span className="label">{t('Delete')}</span>
            </ActionButton>
          )}
        </Bar>,
        document.body,
      )}
    </>
  );
}
