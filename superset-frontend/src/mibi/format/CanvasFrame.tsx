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
import { useSelector } from 'react-redux';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import type { RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { usePresenting } from 'src/mibi/present/presentation';
import { selectVisual } from './selection';
import { canvasSize, canvasStyle, canvasZoom, hasCanvasFormat } from './styles';

const Outer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`;

const Page = styled.div<{ $decorated: boolean; $fixed: boolean }>`
  ${({ theme, $decorated, $fixed }) => css`
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

/** Zoom of a fixed size canvas, so drag and resize can follow the mouse. */
export const useCanvasZoom = () => useContext(CanvasZoomContext);

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
  const size = canvasSize(canvas);

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
    }),
    [canvas, theme, size, zoom],
  );

  return (
    <Outer ref={outerRef} data-test="mibi-canvas-outer">
      <Page
        data-test="mibi-canvas"
        className="mibi-canvas"
        $decorated={hasCanvasFormat(canvas)}
        $fixed={!!size}
        style={style}
        onClick={
          editMode
            ? event => {
                // A click on the canvas itself formats the canvas
                const target = event.target as Element;
                if (!target.closest?.('.dashboard-component-chart-holder')) {
                  selectVisual(null);
                }
              }
            : undefined
        }
      >
        <CanvasZoomContext.Provider value={zoom}>
          {children}
        </CanvasZoomContext.Provider>
      </Page>
    </Outer>
  );
}
