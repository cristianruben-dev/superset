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
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import cx from 'classnames';
import { fitToCanvas } from './actions';
import { useShowGrid } from './gridGuides';
import { PHONE_WIDTH, useMobilePreview, usePhoneScreen } from './mobile';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';
import { usePresenting } from 'src/mibi/present/presentation';
import { ReportTheme, useReportLook } from 'src/mibi/report/ReportTheme';
import { TabsDockTarget } from 'src/mibi/report/TabsDock';
import { selectVisual } from './selection';
import type { CanvasFormat } from './types';
import { canvasSize, canvasStyle, canvasZoom, hasCanvasFormat } from './styles';

const Outer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
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
      padding: ${theme.sizeUnit * 4}px;
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
): number | undefined {
  const room = useContext(CanvasRoomContext);
  const rowTallest = useSelector((state: RootState) => {
    if (parent?.type !== ROW_TYPE) return height;
    const layout = state.dashboardLayout?.present ?? {};
    return Math.max(
      height,
      ...parent.children.map(id => Number(layout[id]?.meta?.height) || 0),
    );
  });
  if (!Number.isFinite(room)) return undefined;
  return Math.max(height, rowTallest + Math.floor(room / GRID_BASE_UNIT));
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
  const canvas = useSelector(
    (state: RootState) =>
      state.dashboardLayout?.present?.[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas,
  );
  const presenting = usePresenting();
  const editMode = useSelector(
    (state: RootState) => state.dashboardState?.editMode,
  );
  const outerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const previewing = useMobilePreview() && !!editMode;
  const phone = usePhoneScreen();
  // Editing uses the desktop layout unless previewing the phone
  const mobile = previewing || (phone && !editMode);
  // The mobile layout ignores the fixed page size
  const size = mobile ? null : canvasSize(canvas);
  const dispatch = useDispatch();
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [showGrid] = useShowGrid();

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
    const observer = new ResizeObserver(([entry]) =>
      setAvailable(entry.contentRect.width),
    );
    observer.observe(element);
    setAvailable(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const zoom = useMemo(() => {
    if (!size || !available) return 1;
    return canvasZoom(size, {
      width: available,
      height: presenting ? window.innerHeight - PRESENTING_MARGIN : undefined,
    });
  }, [size, available, presenting]);

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
            zoom,
          }
        : undefined),
      ...(previewing ? { width: PHONE_WIDTH } : undefined),
    }),
    [canvas, theme, look, size, zoom, previewing, editMode, overflowing],
  );

  // The tabs dock is as wide as the page and zoomed with it
  const dockStyle = useMemo(
    () =>
      size
        ? {
            width: previewing ? PHONE_WIDTH : size.width,
            zoom,
          }
        : { width: '100%' },
    [size, zoom, previewing],
  );

  return (
    <Outer ref={outerRef} data-test="mibi-canvas-outer">
      <ReportTheme>
        <TabsDockTarget style={dockStyle} />
        <Page
          ref={pageRef}
          data-test="mibi-canvas"
          className={cx(
            'mibi-canvas',
            editMode && showGrid && !mobile && 'mibi-show-grid',
            mobile && 'mibi-mobile',
            previewing && 'mibi-phone-preview',
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
      </ReportTheme>
    </Outer>
  );
}
