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
  memo,
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { registerActionSlot } from './actionSlots';
import { selectedVisual, selectedVisuals } from './selection';

/** Distance to the object and to the edges of the area that scrolls. */
const GAP = 4;
/** Time to reach the buttons from the object before they go away. */
const LEAVE_DELAY = 200;
/**
 * Time on another object before it takes the buttons: the way to them may
 * cross it, as objects touch on the grid and the bar sits over the next one.
 */
const SWITCH_DELAY = 400;
/** A menu or list opened from the bar keeps it on screen while it is open. */
const OPEN_POPUP =
  '.ant-dropdown-open, .ant-popover-open, [aria-expanded="true"]';

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

    body.auradata-moving &,
    &:not(:has(button)) {
      display: none;
    }

    /* The buttons a chart header places here (see actionSlots) */
    .auradata-action-slot {
      display: contents;
    }

    .auradata-action-slot button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${theme.sizeUnit}px;
      min-width: 32px;
      width: auto;
      height: 32px;
      margin: 0;
      padding: 0 ${theme.sizeUnit * 1.5}px;
      border: 0;
      border-radius: ${theme.borderRadius}px;
      background: transparent;
      color: ${theme.colorText};
      cursor: pointer;
    }

    .auradata-action-slot button .anticon,
    .auradata-action-slot button svg {
      color: ${theme.colorPrimary};
    }

    .auradata-action-slot button:hover,
    .auradata-action-slot button:focus-visible {
      background: ${theme.colorPrimaryBg};
    }
  `}
`;

const ActionButton = styled.button<{ $danger?: boolean }>`
  ${({ theme, $danger }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: ${theme.borderRadius}px;
    background: transparent;
    color: ${theme.colorText};
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

/** A button of the bar: an icon, named by its tooltip and its label. */
export function ObjectActionButton({
  label,
  danger,
  testId,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  testId?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <Tooltip title={label} placement="top">
      <ActionButton
        type="button"
        $danger={danger}
        aria-label={label}
        data-test={testId}
        onClick={onClick}
      >
        {children}
      </ActionButton>
    </Tooltip>
  );
}

// The object under the pointer, shared so that only one set of buttons shows
let hovered: string | null = null;
const listeners = new Set<() => void>();
// The bar of each object, to know whether one of its menus is open
const bars = new Map<string, HTMLElement>();
// Another object the pointer entered while the buttons of one were showing
let pending: { id: string; timer: number } | null = null;

const setHovered = (id: string | null) => {
  if (hovered !== id) {
    hovered = id;
    listeners.forEach(listener => listener());
  }
};

const hasOpenPopup = (id: string | null): boolean =>
  Boolean(id && bars.get(id)?.querySelector(OPEN_POPUP));

const cancelPending = () => {
  if (pending) window.clearTimeout(pending.timer);
  pending = null;
};

/**
 * The pointer entered object ``id``. With the buttons of another one showing,
 * it takes them only if it stays a moment (SWITCH_DELAY), and never while a
 * menu of theirs is open.
 */
const hoverObject = (id: string) => {
  cancelPending();
  if (hovered === null || hovered === id) {
    setHovered(id);
    return;
  }
  const wait = () => {
    pending = {
      id,
      timer: window.setTimeout(() => {
        if (hasOpenPopup(hovered)) {
          wait();
        } else {
          pending = null;
          setHovered(id);
        }
      }, SWITCH_DELAY),
    };
  };
  wait();
};

/** The pointer left object ``id`` before it took the buttons. */
const unhoverObject = (id: string) => {
  if (pending?.id === id) cancelPending();
};

const isObjectActionsOpen = (id: string): boolean =>
  hovered === id ||
  (hovered === null &&
    selectedVisual() === id &&
    selectedVisuals().length === 1);

function useIsObjectActionsOpen(id: string): boolean {
  const [open, setOpen] = useState(() => isObjectActionsOpen(id));
  useEffect(() => {
    const onChange = () => setOpen(isObjectActionsOpen(id));
    onChange();
    listeners.add(onChange);
    window.addEventListener('auradata:format-selection', onChange);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener('auradata:format-selection', onChange);
    };
  }, [id]);
  return open;
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
  // Above the object; else below it; else inside, at the bottom of what
  // shows, so they never cover the icons of its header
  const above = object.top - bar.height - GAP;
  const below = object.bottom + GAP;
  let y: number;
  if (above >= area.top + GAP) {
    y = above;
  } else if (below + bar.height <= area.bottom - GAP) {
    y = below;
  } else {
    y = Math.max(
      Math.min(object.bottom, area.bottom) - bar.height - GAP,
      Math.max(object.top, area.top) + GAP,
    );
  }
  return { x, y };
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

/**
 * The floating buttons of an object, icons named by their tooltips: for the
 * object under the pointer or, while editing with no pointer on another one,
 * the one selected. The header of a chart adds its own buttons (copy, filters,
 * focus mode, more options) through the slot of the bar (see actionSlots); a
 * bar with no button stays hidden. They are drawn at one size at any zoom, and
 * stay inside the visible part of the canvas.
 */
export const ObjectActions = memo(function ObjectActions({
  id,
  onDelete,
  onFormat,
  formatTestId,
  deleteTestId,
}: {
  id: string;
  /** Left out for a locked object, which cannot be removed */
  onDelete?: MouseEventHandler<HTMLButtonElement>;
  /** Left out outside the editor */
  onFormat?: () => void;
  formatTestId?: string;
  deleteTestId?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number>();
  const holderRef = useRef<Element | null>(null);
  const slotRef = useRef<HTMLSpanElement>(null);
  const open = useIsObjectActionsOpen(id);

  useEffect(
    () =>
      slotRef.current ? registerActionSlot(id, slotRef.current) : undefined,
    [id],
  );

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    bars.set(id, bar);
    return () => {
      if (bars.get(id) === bar) bars.delete(id);
    };
  }, [id]);

  // Leaves the object, unless a menu of the bar is open (its list lives
  // elsewhere in the page, and closing the bar would orphan it) or the
  // pointer is on another object that has not taken the buttons yet
  const leaveSoon = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      if (hasOpenPopup(id) || (hovered === id && pending)) {
        leaveSoon();
      } else if (hovered === id) {
        setHovered(null);
      }
    }, LEAVE_DELAY);
  };

  const enter = () => {
    window.clearTimeout(leaveTimer.current);
    hoverObject(id);
  };

  useEffect(() => {
    const element = anchorRef.current?.closest(
      '.dashboard-component-chart-holder, .auradata-element',
    );
    if (!element) return undefined;
    holderRef.current = element;
    const leave = () => {
      unhoverObject(id);
      leaveSoon();
    };
    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointerleave', leave);
    return () => {
      element.removeEventListener('pointerenter', enter);
      element.removeEventListener('pointerleave', leave);
      window.clearTimeout(leaveTimer.current);
      unhoverObject(id);
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
      const area = holder.closest('[data-test="auradata-canvas-outer"]');
      const rect = holder.getBoundingClientRect();
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
          className="auradata-object-actions"
          style={{ visibility: 'hidden' }}
          onPointerEnter={enter}
          onPointerLeave={leaveSoon}
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={stop}
        >
          <span ref={slotRef} className="auradata-action-slot" />
          {onFormat && (
            <ObjectActionButton
              label={t('Format')}
              testId={formatTestId}
              onClick={onFormat}
            >
              <Icons.BgColorsOutlined iconSize="m" />
            </ObjectActionButton>
          )}
          {onDelete && (
            <ObjectActionButton
              label={t('Delete')}
              danger
              testId={deleteTestId}
              onClick={onDelete}
            >
              <Icons.DeleteOutlined iconSize="m" />
            </ObjectActionButton>
          )}
        </Bar>,
        document.body,
      )}
    </>
  );
});
