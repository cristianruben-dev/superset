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
import { setMobileEditing, useMobileEditing, usePhoneScreen } from './mobile';
import {
  CanvasReadOnlyProvider,
  MOBILE_COLUMNS,
  MobileViewProvider,
  mobileLayoutOf,
  mobilePageRows,
  mobileViewOf,
} from './mobileLayout';
import { MobileLayoutEditor } from './MobileLayoutEditor';
import {
  deviceById,
  safeHeightOf,
  useMobileViewSettings,
} from './mobileDevices';
import {
  DeviceFrame,
  deviceScale,
  VIEWER_HEADER_HEIGHT,
  VIEWER_PAGE_TOP,
  VIEWER_RAIL_WIDTH,
} from './DeviceFrame';
import { FilterBarOrientation } from 'src/dashboard/types';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { useChartCustomizationFromRedux } from 'src/dashboard/components/nativeFilters/state';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_HEADER_ID,
  DASHBOARD_ROOT_ID,
} from 'src/dashboard/util/constants';
import { usePresenting } from 'src/mibi/present/presentation';
import { activePageId, topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { PAGE_BACKGROUND_KEY } from 'src/mibi/report/types';
import { ReportTheme, useReportLook } from 'src/mibi/report/ReportTheme';
import { TabsDockTarget } from 'src/mibi/report/TabsDock';
import {
  FilterDockTarget,
  useFilterDockWidth,
} from 'src/mibi/report/FilterDock';
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
 * of the objects while editing, and below for the zoom bar, which floats over
 * it), so zooming in never moves the rest of the screen.
 */
const Outer = styled.div<{
  $scroll: boolean;
  $editing: boolean;
  $phone: boolean;
}>`
  width: 100%;
  ${({ $scroll, $editing, $phone }) =>
    $scroll
      ? css`
          height: 100%;
          overflow: auto;
          /* A phone gives the page all of its width */
          padding: ${$editing ? 28 : 12}px ${$phone ? 0 : 8}px 56px;
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

/** The page and the filter pane beside it: one sheet, with its edge */
const Sheet = styled.div`
  display: flex;
  align-items: stretch;
  margin: 0 auto;
  flex: none;
  &:has([data-test='mibi-filter-dock']:not(:empty)) {
    .mibi-canvas,
    [data-test='mibi-tabs-dock'] {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  }
`;

const CanvasZoomContext = createContext(1);
const FIT_PAGE_EVENT = 'mibi:fit-page';

/** Shrinks or grows the visuals on screen so they fill the page height. */
export const fitObjectsToPage = () =>
  window.dispatchEvent(new CustomEvent(FIT_PAGE_EVENT));

// Canvas pixels left below the visuals of a fixed size page
const CanvasRoomContext = createContext(Infinity);

/** Zoom of a fixed size canvas, so drag and resize can follow the mouse. */
export const useCanvasZoom = () => useContext(CanvasZoomContext);

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
  const mobileEditing = useMobileEditing() && !!editMode;
  const mobileSettings = useMobileViewSettings();
  const device = deviceById(mobileSettings.device);
  // The preview shows the page as the phone does: its mobile layout, or the
  // canvas scaled to the phone when it has none
  const previewing = mobileEditing && mobileSettings.mode === 'preview';
  // A viewer of a report with filters has the closed filter rail beside it
  const filterCount = Object.keys(useFilters()).length;
  const customizationCount = useChartCustomizationFromRedux().length;
  const verticalFilters = useSelector(
    (state: RootState) =>
      state.dashboardInfo?.filterBarOrientation !==
      FilterBarOrientation.Horizontal,
  );
  const viewerRail = verticalFilters && filterCount + customizationCount > 0;
  const reportTitle = useSelector((state: RootState) =>
    String(
      state.dashboardLayout?.present?.[DASHBOARD_HEADER_ID]?.meta?.text ?? '',
    ),
  );
  // Width of the page on the phone of a viewer
  const viewerWidth = device.width - (viewerRail ? VIEWER_RAIL_WIDTH : 0);
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout?.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState?.activeTabs,
  );
  const pageId = layout ? activePageId(layout, activeTabs) : undefined;
  const mobileBoxes = useMemo(
    () => (layout ? mobileLayoutOf(layout, pageId) : null),
    [layout, pageId],
  );
  // A phone shows the mobile layout of a page that has one, and the canvas of
  // the rest; the editor shows it while the author arranges it
  const showMobile = mobileEditing
    ? !previewing || !!mobileBoxes
    : phone && !editMode && !presenting && !!mobileBoxes;
  const mobileView = useMemo(
    () =>
      showMobile && layout && pageId
        ? mobileViewOf(layout, pageId, mobileBoxes ?? [])
        : null,
    [showMobile, layout, pageId, mobileBoxes],
  );
  // Room below the lowest object to drop the next one
  const mobileRows =
    mobilePageRows(mobileBoxes) + (mobileEditing && !previewing ? 6 : 0);
  const pageSize = canvasSize(canvas);
  const size = useMemo(
    () =>
      showMobile
        ? { width: MOBILE_COLUMNS * CELL, height: mobileRows * CELL }
        : pageSize,
    [showMobile, mobileRows, pageSize.width, pageSize.height],
  );
  // Leaving the editor leaves its mobile layout too
  useEffect(() => {
    if (!editMode) setMobileEditing(false);
  }, [editMode]);
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
  // The canvas fits its visuals to the page; the phone page grows with them
  const fitting = !!size && !!editMode && !showMobile && !mobileEditing;
  const overflowing = fitting && contentHeight > room + 1;

  // The page is a limit: a change that makes the visuals overflow it (a
  // chart dropped on a full page) shrinks them back inside, in a few passes
  // since row gutters do not scale. A page that already overflowed when it
  // was opened is left as it was.
  const fitPasses = useRef(0);
  const fitted = useRef(false);
  const measuredLayout = useRef(layout);
  useEffect(() => {
    // Changes made on the phone page never fit the canvas when it comes back
    if (!fitting) {
      measuredLayout.current = layout;
      fitPasses.current = 0;
      return;
    }
    if (!contentHeight) return;
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
    if (!fitting) return undefined;
    const onFit = () => {
      fitPasses.current = 3;
      dispatch(fitToCanvas(room, contentHeight));
    };
    window.addEventListener(FIT_PAGE_EVENT, onFit);
    return () => window.removeEventListener(FIT_PAGE_EVENT, onFit);
  }, [fitting, room, contentHeight, dispatch]);

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
      setViewportHeight(Math.max(320, window.innerHeight - top - 20));
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

  // The filter pane keeps its own size beside the scaled page
  const paneWidth = useFilterDockWidth();
  const zoom = useMemo(() => {
    if (!size || !available) return 1;
    // On the phone of the editor the page fills the width of its screen
    if (mobileEditing) {
      return (previewing ? viewerWidth : device.width) / size.width;
    }
    // The phone page fills the width of a phone
    if (showMobile) return canvasZoom(size, { width: available });
    if (presenting) {
      return canvasZoom(size, {
        width: available - paneWidth,
        height: windowHeight - PRESENTING_MARGIN,
      });
    }
    if (view.mode === 'custom') return clampZoom(view.zoom);
    if (view.mode === 'fit-page') {
      return canvasZoom(size, {
        width: available - paneWidth,
        height: availableHeight || undefined,
      });
    }
    return canvasZoom(size, { width: available - paneWidth });
  }, [
    size,
    available,
    paneWidth,
    availableHeight,
    presenting,
    windowHeight,
    view,
    showMobile,
    mobileEditing,
    device.width,
    previewing,
    viewerWidth,
  ]);
  // The phone of the editor fits the room it has, or shows at its own size
  const displayScale = mobileEditing
    ? deviceScale(
        device,
        { width: available, height: availableHeight },
        mobileSettings.fit,
      )
    : 1;

  const scroll = !!size;
  // The desktop canvas zooms and pans; the phone of the editor scrolls itself
  const pannable = scroll && !mobileEditing;
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
    if (!element || !pannable) return undefined;
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
  }, [pannable]);

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
    if (!element || !pannable) return undefined;
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
  }, [pannable]);

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

  const pageFrame = (
    <div ref={frameRef} style={frameStyle}>
      <div ref={scaledRef} style={scaledStyle}>
        <TabsDockTarget style={{ width: '100%' }} />
        <Page
          ref={pageRef}
          data-test="mibi-canvas"
          className={cx(
            'mibi-canvas',
            editMode && !previewing && 'mibi-show-grid',
            showMobile && 'mibi-phone-page',
          )}
          $decorated={hasCanvasFormat(canvas)}
          $fixed={!!size && !mobileEditing}
          style={style}
          onClick={
            editMode && !mobileEditing
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
            <CanvasRoomContext.Provider
              value={fitting ? room - contentHeight : Infinity}
            >
              <MobileViewProvider value={mobileView}>
                <CanvasReadOnlyProvider value={mobileEditing || !!mobileView}>
                  <div ref={contentRef}>{children}</div>
                </CanvasReadOnlyProvider>
              </MobileViewProvider>
            </CanvasRoomContext.Provider>
            {mobileEditing && !previewing && pageId && (
              <MobileLayoutEditor
                pageId={pageId}
                boxes={mobileBoxes ?? []}
                zoom={zoom * displayScale}
                foldY={
                  // Where a viewer's first screen ends, below the bars of
                  // the app and beside the filter rail
                  ((safeHeightOf(device) -
                    VIEWER_HEADER_HEIGHT -
                    VIEWER_PAGE_TOP) *
                    size.width) /
                  viewerWidth
                }
              />
            )}
          </CanvasZoomContext.Provider>
        </Page>
      </div>
    </div>
  );

  return (
    <Wrap
      ref={wrapRef}
      className="mibi-viewport"
      style={scroll && viewportHeight ? { height: viewportHeight } : undefined}
    >
      <Outer
        ref={outerRef}
        $scroll={scroll}
        $editing={editMode}
        $phone={phone && !editMode}
        data-test="mibi-canvas-outer"
      >
        <ReportTheme>
          <Sheet style={size ? undefined : { width: '100%' }}>
            {mobileEditing ? (
              <DeviceFrame
                device={device}
                scale={displayScale}
                safeArea={mobileSettings.safeArea}
                viewer={
                  previewing
                    ? { title: reportTitle, rail: viewerRail, theme: appTheme }
                    : null
                }
              >
                {pageFrame}
              </DeviceFrame>
            ) : (
              pageFrame
            )}
            {size && !showMobile && !mobileEditing && <FilterDockTarget />}
          </Sheet>
        </ReportTheme>
      </Outer>
      {scroll && !presenting && !showMobile && !mobileEditing && (
        <ZoomToolbar zoom={zoom} />
      )}
    </Wrap>
  );
}
