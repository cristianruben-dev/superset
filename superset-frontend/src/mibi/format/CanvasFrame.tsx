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
import { t } from '@apache-superset/core/translation';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { fitToCanvas } from './actions';
import { useShowGrid } from './gridGuides';
import { PHONE_WIDTH, useMobilePreview, usePhoneScreen } from './mobile';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import type { RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { usePresenting } from 'src/mibi/present/presentation';
import { selectVisual } from './selection';
import { canvasSize, canvasStyle, canvasZoom, hasCanvasFormat } from './styles';

const Outer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const Overflow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    width: 100%;
    margin-bottom: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${theme.colorWarningBorder};
    background: ${theme.colorWarningBg};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;

    .message {
      flex: 1;
      min-width: 0;
    }
  `}
`;

const PageEnd = styled.div`
  ${({ theme }) => css`
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px dashed ${theme.colorWarning};
    pointer-events: none;
    z-index: 2;

    span {
      position: absolute;
      right: ${theme.sizeUnit * 2}px;
      top: ${theme.sizeUnit}px;
      padding: 2px ${theme.sizeUnit * 2}px;
      border-radius: 999px;
      background: ${theme.colorWarning};
      color: ${theme.colorTextLightSolid};
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
    }
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

/** Zoom of a fixed size canvas, so drag and resize can follow the mouse. */
export const useCanvasZoom = () => useContext(CanvasZoomContext);

/** Whether the canvas uses its mobile layout: one object per line. */
export const useCanvasMobile = () => useContext(CanvasMobileContext);

// Room the presentation keeps around a canvas fitted to the screen
const PRESENTING_MARGIN = 32;

/**
 * Wraps the dashboard grid with the canvas format: background, padding,
 * spacing and, for a fixed size, a page of that size zoomed to fit the space
 * (the width, or the whole screen while presenting).
 */
export function CanvasFrame({ children }: { children: ReactNode }) {
  const theme = useTheme();
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

  // Fitting runs a few passes: row gutters do not scale with the visuals
  const fitPasses = useRef(0);
  const fit = () => {
    fitPasses.current = 4;
    dispatch(fitToCanvas(room, contentHeight));
  };
  useEffect(() => {
    if (fitPasses.current <= 0) return;
    fitPasses.current -= 1;
    if (overflowing) dispatch(fitToCanvas(room, contentHeight));
    else fitPasses.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHeight]);

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
      ...canvasStyle(canvas, theme),
      ...(size
        ? { width: size.width, minHeight: size.height, zoom }
        : undefined),
      ...(previewing ? { width: PHONE_WIDTH } : undefined),
    }),
    [canvas, theme, size, zoom, previewing],
  );

  return (
    <Outer ref={outerRef} data-test="mibi-canvas-outer">
      {overflowing && size && (
        <Overflow role="status" data-test="mibi-canvas-overflow">
          <Icons.WarningOutlined iconSize="m" />
          <span className="message">
            {t(
              'The content is %s px tall and the page %s px. What goes past the dashed line makes the page taller when exported.',
              Math.round(contentHeight + padding()),
              size.height,
            )}
          </span>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            data-test="mibi-fit-canvas"
            onClick={fit}
          >
            {t('Fit to the canvas')}
          </Button>
        </Overflow>
      )}
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
        {size && editMode && (
          <PageEnd style={{ top: size.height }} data-test="mibi-page-end">
            <span>{t('End of page · %s px', size.height)}</span>
          </PageEnd>
        )}
        <CanvasZoomContext.Provider value={zoom}>
          <CanvasMobileContext.Provider value={mobile}>
            <div ref={contentRef}>{children}</div>
          </CanvasMobileContext.Provider>
        </CanvasZoomContext.Provider>
      </Page>
    </Outer>
  );
}
