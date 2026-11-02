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
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import cx from 'classnames';
import { fitToCanvas } from './actions';
import { usePhoneScreen } from './mobile';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { usePresenting } from 'src/mibi/present/presentation';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { PAGE_BACKGROUND_KEY } from 'src/mibi/report/types';
import { ReportTheme, useReportLook } from 'src/mibi/report/ReportTheme';
import { TabsDockTarget } from 'src/mibi/report/TabsDock';
import { posOf } from './positions';
import { selectVisual, setGroupResolver } from './selection';
import { groupMembers } from './arrange';
import { CELL, type CanvasFormat } from './types';
import { canvasSize, canvasStyle, canvasZoom, hasCanvasFormat } from './styles';
import { clampZoom, setCanvasView, useCanvasView } from './canvasView';
import { ZoomToolbar } from './ZoomToolbar';

const Wrap = styled.div`
  position: relative;
  width: 100%;
`;

/**
 * Holds the page. A fixed page scrolls inside it (room above for the menus
 * of the objects), so zooming in never moves the rest of the screen.
 */
const Outer = styled.div<{ $scroll: boolean }>`
  width: 100%;
  ${({ $scroll }) =>
    $scroll
      ? css`
          height: 100%;
          overflow: auto;
          padding: 28px 8px 8px;
          box-sizing: border-box;
        `
      : css`
          display: flex;
          flex-direction: column;
          align-items: center;
        `}
`;

const Page = styled.div<{ $decorated: boolean; $fixed: boolean }>`
  ${({ theme, $decorated, $fixed }) => css`
    position: relative;
    flex: none;
    width: 100%;
    box-sizing: border-box;
    ${$decorated &&
    css`
      border-radius: ${theme.borderRadiusLG * 1.5}px;
    `}
    ${$fixed &&
    css`
      box-shadow: ${theme.boxShadowTertiary};
      outline: 1px solid ${theme.colorBorderSecondary};
    `}
  `}
`;

const CanvasZoomContext = createContext(1);
const CanvasMobileContext = createContext(false);
const FIT_PAGE_EVENT = 'mibi:fit-page';

/** Shrinks or grows the visuals on screen so they fill the page height. */
export const fitObjectsToPage = () =>
  window.dispatchEvent(new CustomEvent(FIT_PAGE_EVENT));

// Canvas pixels left below the visuals of a fixed size page
const CanvasRoomContext = createContext(Infinity);

/** Zoom of a fixed size canvas, so drag and resize can follow the mouse. */
export const useCanvasZoom = () => useContext(CanvasZoomContext);

/** Whether the canvas uses its mobile layout: one object per line. */
export const useCanvasMobile = () => useContext(CanvasMobileContext);

/**
 * The tallest an object may be resized, in grid units, so the page keeps
 * every visual inside it: what its row already takes plus the room left
 * below the visuals. Undefined when the canvas has no page limit.
 */
export function useMaxHeightMultiple(
  height: number,
  parent: LayoutItem | undefined,
  meta?: Record<string, unknown>,
): number | undefined {
  const room = useContext(CanvasRoomContext);
  const pos = posOf(meta);
  const rowTallest = useSelector((state: RootState) => {
    if (parent?.type !== ROW_TYPE) return height;
    const layout = state.dashboardLayout?.present ?? {};
    return Math.max(
      height,
      ...parent.children.map(id => Number(layout[id]?.meta?.height) || 0),
    );
  });
  if (!Number.isFinite(room)) return undefined;
  // An object on a cell of the page may grow to the bottom of the page
  if (pos) return Math.max(height, Math.floor(room / CELL) - pos.y);
  return Math.max(height, rowTallest + Math.floor(room / CELL));
}

/** True when the canvas has a color, gradient or picture of its own. */
const hasOwnBackground = (canvas: CanvasFormat | undefined) =>
  ['color', 'gradient', 'image'].includes(canvas?.background?.type ?? '');

// Room the presentation keeps around a canvas fitted to the screen
const PRESENTING_MARGIN = 32;

/**
 * Wraps the dashboard grid with the canvas format: background, padding,
 * spacing and, for a fixed size, a page of that size zoomed to fit the space
 * (the width, or the whole screen while presenting).
 */
export function CanvasFrame({ children }: { children: ReactNode }) {
  const appTheme = useTheme();
  // The page is the report: its colors follow the report's look, not the app's
  const look = useReportLook();
  const theme = look?.theme ?? appTheme;
  const baseCanvas = useSelector(
    (state: RootState) =>
      state.dashboardLayout?.present?.[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas,
  );
  // A page can have a background of its own
  const pageBackground = useSelector((state: RootState) => {
    const layout = state.dashboardLayout?.present;
    if (!layout) return undefined;
    const page = topLevelTabs(layout).find(tab =>
      state.dashboardState?.activeTabs?.includes(tab.id),
    );
    return page
      ? (layout[page.id]?.meta?.[PAGE_BACKGROUND_KEY] as
          | CanvasFormat['background']
          | undefined)
      : undefined;
  });
  const canvas = useMemo(
    () =>
      pageBackground && pageBackground.type !== 'none'
        ? { ...baseCanvas, background: pageBackground }
        : baseCanvas,
    [baseCanvas, pageBackground],
  );
  const store = useStore<RootState>();
  useEffect(() => {
    setGroupResolver(id =>
      groupMembers(store.getState().dashboardLayout.present, id),
    );
  }, [store]);
  const presenting = usePresenting();
  const editMode = useSelector(
    (state: RootState) => state.dashboardState?.editMode,
  );
  const outerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const view = useCanvasView();
  const phone = usePhoneScreen();
  // Editing always uses the desktop layout
  const mobile = phone && !editMode;
  // The mobile layout ignores the fixed page size
  const size = mobile ? null : canvasSize(canvas);
  const dispatch = useDispatch();
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const scaledRef = useRef<HTMLDivElement>(null);
  const [scaledHeight, setScaledHeight] = useState(0);

  // Height of the page and its tabs, before scaling: the box that holds them
  // takes the scaled height
  useEffect(() => {
    const element = scaledRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() =>
      setScaledHeight(element.offsetHeight),
    );
    observer.observe(element);
    setScaledHeight(element.offsetHeight);
    return () => observer.disconnect();
  }, []);

  // Height of the visuals, in canvas pixels (not zoomed)
  useEffect(() => {
    const element = contentRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    // Edit mode adds drop zones between rows that viewers never see
    const measure = () => {
      const dropZones = Array.from(
        element.querySelectorAll<HTMLElement>(
          '.grid-content > .empty-droptarget',
        ),
      ).reduce((sum, zone) => sum + zone.offsetHeight, 0);
      setContentHeight(element.offsetHeight - dropZones);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const padding = () => {
    const page = pageRef.current;
    if (!page) return 0;
    const style = window.getComputedStyle(page);
    return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) || 0;
  };
  const room = size ? size.height - padding() : 0;
  const overflowing = !!size && editMode && contentHeight > room + 1;
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout?.present,
  );

  // The page is a limit: a change that makes the visuals overflow it (a
  // chart dropped on a full page) shrinks them back inside, in a few passes
  // since row gutters do not scale. A page that already overflowed when it
  // was opened is left as it was.
  const fitPasses = useRef(0);
  const fitted = useRef(false);
  const measuredLayout = useRef(layout);
  useEffect(() => {
    if (!size || !editMode || !contentHeight) return;
    const changed = measuredLayout.current !== layout;
    measuredLayout.current = layout;
    if (!overflowing) {
      fitted.current = true;
      fitPasses.current = 0;
      return;
    }
    if (fitPasses.current > 0) {
      fitPasses.current -= 1;
      dispatch(fitToCanvas(room, contentHeight));
    } else if (changed && fitted.current) {
      fitPasses.current = 3;
      dispatch(fitToCanvas(room, contentHeight));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHeight, layout]);

  // The drop targets between objects take no room (see skin.css), so they only
  // listen while something is being dragged
  useEffect(() => {
    if (!editMode) return undefined;
    const start = () => document.body.classList.add('mibi-dragging');
    const end = () => document.body.classList.remove('mibi-dragging');
    document.addEventListener('dragstart', start);
    document.addEventListener('dragend', end);
    document.addEventListener('drop', end);
    return () => {
      document.removeEventListener('dragstart', start);
      document.removeEventListener('dragend', end);
      document.removeEventListener('drop', end);
      end();
    };
  }, [editMode]);

  // "Fit the objects to the page" in the Format pane
  useEffect(() => {
    if (!size || !editMode) return undefined;
    const onFit = () => {
      fitPasses.current = 3;
      dispatch(fitToCanvas(room, contentHeight));
    };
    window.addEventListener(FIT_PAGE_EVENT, onFit);
    return () => window.removeEventListener(FIT_PAGE_EVENT, onFit);
  }, [size, editMode, room, contentHeight, dispatch]);

  useEffect(() => {
    const element = outerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      // The padding of a scrolling viewport is not room for the page
      const style = window.getComputedStyle(element);
      const sideX =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const sideY =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setAvailable(element.clientWidth - (sideX || 0));
      setAvailableHeight(element.clientHeight - (sideY || 0));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [!!size]);

  // The screen gives the viewport the height under the header
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !size) return undefined;
    const measure = () => {
      const top = wrap.getBoundingClientRect().top + window.scrollY;
      setWindowHeight(window.innerHeight);
      setViewportHeight(Math.max(320, window.innerHeight - top - 16));
    };
    measure();
    window.addEventListener('resize', measure);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [!!size]);

  const zoom = useMemo(() => {
    if (!size || !available) return 1;
    if (presenting) {
      return canvasZoom(size, {
        width: available,
        height: windowHeight - PRESENTING_MARGIN,
      });
    }
    if (view.mode === 'custom') return clampZoom(view.zoom);
    if (view.mode === 'fit-page') {
      return canvasZoom(size, {
        width: available,
        height: availableHeight || undefined,
      });
    }
    return canvasZoom(size, { width: available });
  }, [size, available, availableHeight, presenting, windowHeight, view]);

  const scroll = !!size;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const anchor = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);

  // Ctrl or Cmd with the wheel (and the pinch of a trackpad) zooms around the
  // pointer
  useEffect(() => {
    const element = outerRef.current;
    if (!element || !scroll) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const frame = frameRef.current?.getBoundingClientRect();
      if (!frame) return;
      const { current } = zoomRef;
      anchor.current = {
        x: (event.clientX - frame.left) / current,
        y: (event.clientY - frame.top) / current,
        px: event.clientX,
        py: event.clientY,
      };
      setCanvasView({
        mode: 'custom',
        zoom: clampZoom(current * Math.exp(-event.deltaY * 0.002)),
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [scroll]);

  useLayoutEffect(() => {
    const point = anchor.current;
    const element = outerRef.current;
    const frame = frameRef.current?.getBoundingClientRect();
    anchor.current = null;
    if (!point || !element || !frame) return;
    element.scrollLeft += frame.left + point.x * zoom - point.px;
    element.scrollTop += frame.top + point.y * zoom - point.py;
  }, [zoom]);

  // Space with the pointer, or the middle button, drags the page around
  useEffect(() => {
    const element = outerRef.current;
    if (!element || !scroll) return undefined;
    let spaceDown = false;
    const typing = (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.(
        'input, textarea, select, [contenteditable="true"], .ant-select',
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !typing(event.target)) {
        spaceDown = true;
        element.style.cursor = 'grab';
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spaceDown = false;
        element.style.cursor = '';
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(spaceDown || event.button === 1)) return;
      event.preventDefault();
      event.stopPropagation();
      let { clientX, clientY } = event;
      element.style.cursor = 'grabbing';
      const onMove = (move: PointerEvent) => {
        element.scrollLeft -= move.clientX - clientX;
        element.scrollTop -= move.clientY - clientY;
        ({ clientX, clientY } = move);
      };
      const onUp = () => {
        element.style.cursor = spaceDown ? 'grab' : '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    element.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      element.removeEventListener('pointerdown', onPointerDown, true);
      element.style.cursor = '';
    };
  }, [scroll]);

  const style = useMemo(
    () => ({
      // Like a sheet of paper: the report's own color unless the canvas has a
      // background of its own
      ...(look && !hasOwnBackground(canvas)
        ? { backgroundColor: theme.colorBgLayout }
        : undefined),
      ...canvasStyle(canvas, theme),
      ...(size
        ? {
            width: size.width,
            minHeight: size.height,
            // While editing, the page is exactly its size: drop zones below
            // the last row never make it look taller
            height: editMode && !overflowing ? size.height : undefined,
          }
        : undefined),
    }),
    [canvas, theme, look, size, zoom, editMode, overflowing],
  );

  // The page is scaled with a transform, not with CSS zoom: charts read the
  // pointer position through the transform, and with zoom they miss the mark
  const frameStyle = useMemo(
    () =>
      size
        ? {
            width: size.width * zoom,
            height: scaledHeight ? scaledHeight * zoom : undefined,
            flex: 'none' as const,
            margin: '0 auto',
          }
        : { width: '100%' },
    [size, zoom, scaledHeight],
  );
  const scaledStyle = useMemo(
    () =>
      size
        ? {
            width: size.width,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }
        : undefined,
    [size, zoom],
  );

  return (
    <Wrap
      ref={wrapRef}
      className="mibi-viewport"
      style={scroll && viewportHeight ? { height: viewportHeight } : undefined}
    >
      <Outer ref={outerRef} $scroll={scroll} data-test="mibi-canvas-outer">
        <ReportTheme>
          <div ref={frameRef} style={frameStyle}>
            <div ref={scaledRef} style={scaledStyle}>
              <TabsDockTarget style={{ width: '100%' }} />
              <Page
                ref={pageRef}
                data-test="mibi-canvas"
                className={cx(
                  'mibi-canvas',
                  editMode && !mobile && 'mibi-show-grid',
                  mobile && 'mibi-mobile',
                )}
                $decorated={hasCanvasFormat(canvas)}
                $fixed={!!size}
                style={style}
                onClick={
                  editMode
                    ? event => {
                        // A click on the canvas itself formats the canvas
                        const target = event.target as Element;
                        if (
                          !target.closest?.(
                            '.dashboard-component-chart-holder, .mibi-element',
                          )
                        ) {
                          selectVisual(null);
                        }
                      }
                    : undefined
                }
              >
                <CanvasZoomContext.Provider value={zoom}>
                  <CanvasMobileContext.Provider value={mobile}>
                    <CanvasRoomContext.Provider
                      value={size && editMode ? room - contentHeight : Infinity}
                    >
                      <div ref={contentRef}>{children}</div>
                    </CanvasRoomContext.Provider>
                  </CanvasMobileContext.Provider>
                </CanvasZoomContext.Provider>
              </Page>
            </div>
          </div>
        </ReportTheme>
      </Outer>
      {scroll && !presenting && <ZoomToolbar zoom={zoom} />}
    </Wrap>
  );
}
