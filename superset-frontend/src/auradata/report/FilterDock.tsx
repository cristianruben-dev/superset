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
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { css, styled } from '@apache-superset/core/theme';

/**
 * The filter pane of a report sits against the right edge of its page, as
 * tall as the page, so the two read as one sheet. The page (CanvasFrame)
 * offers the dock; the dashboard builder puts the filter bar in it.
 */
type FilterDockValue = {
  slot: HTMLElement | null;
  setSlot: (element: HTMLElement | null) => void;
  width: number;
  setWidth: (width: number) => void;
};

const FilterDockContext = createContext<FilterDockValue | null>(null);

/** The state of a dock: the builder owns it, to place the bar by it. */
export function useFilterDockState(): FilterDockValue {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  return useMemo(() => ({ slot, setSlot, width, setWidth }), [slot, width]);
}

export function FilterDockProvider({
  value,
  children,
}: {
  value: FilterDockValue;
  children: ReactNode;
}) {
  return (
    <FilterDockContext.Provider value={value}>
      {children}
    </FilterDockContext.Provider>
  );
}

/** Width the pane takes beside the page, 0 when it has no dock or no bar. */
export const useFilterDockWidth = () =>
  useContext(FilterDockContext)?.width ?? 0;

/** Whether the page offers a dock for the filter pane. */
export const useHasFilterDock = () => !!useContext(FilterDockContext)?.slot;

const Dock = styled.div<{ $width: number; $edge?: boolean }>`
  ${({ theme, $width, $edge }) => css`
    position: relative;
    flex: none;
    box-sizing: border-box;
    width: ${$width}px;
    /* As tall as the page, and never too short to use while open: a small
       zoom or a tooltip page leaves the page only a few lines high */
    &:has([data-test='filter-bar'].open) {
      min-height: ${theme.sizeUnit * 100}px;
    }
    background: var(--mb-bg-container, ${theme.colorBgContainer});
    border-radius: 0 ${theme.borderRadiusLG * 1.5}px
      ${theme.borderRadiusLG * 1.5}px 0;
    outline: 1px solid ${theme.colorBorderSecondary};
    box-shadow: ${theme.boxShadowTertiary};
    &:empty {
      display: none;
    }
    /* A pane of the report at its edge, as tall as the page area, not a
       part of the page */
    ${
      $edge &&
      css`
        align-self: stretch;
        min-height: 0;
        border-radius: 0;
        outline: 0;
        box-shadow: none;
        border-left: 1px solid ${theme.colorBorderSecondary};
        background: ${theme.colorBgContainer};
        &:has([data-test='filter-bar'].open) {
          min-height: 0;
        }
      `
    }
  `}
`;

/**
 * Where the filter bar goes: right of the page, with its height, or with
 * ``atEdge`` at the right edge of the report, as tall as the page area.
 */
export function FilterDockTarget({ atEdge = false }: { atEdge?: boolean }) {
  const context = useContext(FilterDockContext);
  return (
    <Dock
      data-test="auradata-filter-dock"
      ref={context?.setSlot}
      $width={context?.width ?? 0}
      $edge={atEdge}
    />
  );
}

/** Renders its children in the dock, with the width the pane needs. */
export function InFilterDock({
  width,
  children,
}: {
  width: number;
  children: ReactNode;
}) {
  const context = useContext(FilterDockContext);
  const setWidth = context?.setWidth;
  useEffect(() => {
    setWidth?.(width);
    return () => setWidth?.(0);
  }, [width, setWidth]);
  return context?.slot ? createPortal(children, context.slot) : null;
}
