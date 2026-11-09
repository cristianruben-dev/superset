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
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import type { RootState } from 'src/dashboard/types';
import { topLevelTabs, visibleTabs } from 'src/auradata/present/dashboardTabs';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';

/**
 * The tabs of a report sit on top of its page, as wide as the page, so the
 * two read as one sheet. The page (CanvasFrame) offers the dock; the dashboard
 * builder puts the tabs in it.
 */
const TabsDockContext = createContext<{
  slot: HTMLElement | null;
  setSlot: (element: HTMLElement | null) => void;
} | null>(null);

export function TabsDockProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <TabsDockContext.Provider value={value}>
      {children}
    </TabsDockContext.Provider>
  );
}

const Dock = styled.div<{ $bar?: boolean }>`
  ${({ theme, $bar }) => css`
    position: relative;
    flex: none;
    box-sizing: border-box;
    border-radius: ${theme.borderRadiusLG * 1.5}px
      ${theme.borderRadiusLG * 1.5}px 0 0;
    outline: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};

    /* Joined to the page below */
    &:not(:empty) + .auradata-canvas {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
    &:empty {
      display: none;
    }

    /* Tabs keep a readable width; when they do not fit the page the strip
       scrolls, with arrows, instead of squeezing them */
    .ant-tabs-nav-list .ant-tabs-tab {
      flex: none;
      min-width: ${theme.sizeUnit * 24}px;
      justify-content: center;
    }
    .ant-tabs-tab-btn {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .empty-droptarget {
      min-height: ${theme.sizeUnit * 4}px;
    }

    /* As in Power BI: the pages are a bar at the bottom of the report, of
       a fixed size whatever the zoom of the page */
    ${
      $bar &&
      css`
        flex: 1;
        min-width: 0;
        align-self: stretch;
        border-radius: 0;
        outline: 0;
        background: transparent;
        &:empty {
          display: block;
        }
        .dashboard-component-tabs,
        .dashboard-component-tabs > div,
        .ant-tabs,
        .ant-tabs-nav,
        .ant-tabs-nav-wrap,
        .ant-tabs-nav-list {
          height: 100%;
        }
        .dashboard-component-tabs {
          background: transparent;
        }
        .ant-tabs-nav {
          margin: 0;
          /* Over the padding Superset sets from the width of the filter bar */
          padding: 0 !important;
          min-height: 0;
          &::before {
            border: 0;
          }
        }
        .ant-tabs-ink-bar {
          display: none;
        }
        .ant-tabs-nav-list {
          gap: 0;
          align-items: stretch;
        }
        /* Flat tabs side by side, split by hairlines, as in Power BI */
        .ant-tabs-nav-list .ant-tabs-tab {
          position: relative;
          box-sizing: border-box;
          /* As tall as its row, so the name sits in its middle */
          height: ${theme.sizeUnit * 10}px;
          margin: 0 !important;
          padding: 0 ${theme.sizeUnit * 5}px;
          border: 0 !important;
          border-right: 1px solid ${theme.colorSplit} !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: ${theme.colorTextSecondary};
          font-size: ${theme.fontSize}px;
          transition:
            background ${theme.motionDurationMid},
            color ${theme.motionDurationMid};
          &:hover {
            color: ${theme.colorText};
            background: ${theme.colorFillQuaternary} !important;
          }
          &::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 3px;
            background: transparent;
            transition: background ${theme.motionDurationMid};
          }
        }
        .ant-tabs-nav-list .ant-tabs-tab.ant-tabs-tab-active {
          background: ${theme.colorFillQuaternary} !important;
          .ant-tabs-tab-btn {
            color: ${theme.colorText};
            font-weight: ${theme.fontWeightStrong};
          }
          &::after {
            background: ${theme.colorPrimary};
          }
        }
        /* The title being renamed reads as the tab, not as a field */
        .ant-tabs-tab .editable-title input,
        .ant-tabs-tab .editable-title textarea {
          padding: 0;
          border: 0;
          outline: 0;
          box-shadow: none;
          background: transparent;
          color: inherit;
          font: inherit;
        }
        .ant-tabs-nav-add {
          align-self: center;
          margin: 0 ${theme.sizeUnit * 2}px;
          min-width: ${theme.sizeUnit * 7}px;
          height: ${theme.sizeUnit * 7}px;
          border: 0 !important;
          border-radius: ${theme.borderRadius}px !important;
          background: transparent !important;
          color: ${theme.colorTextSecondary};
          &:hover {
            color: ${theme.colorPrimary};
            background: ${theme.colorPrimaryBg} !important;
          }
        }
        .ant-tabs-nav-more {
          align-self: center;
        }
        /* The link to a page is in the share menu; a tab only shows its name */
        .anchor-link-container {
          display: none;
        }
      `
    }

    .empty-droptarget:before {
      position: absolute;
      content: '';
      display: none;
      width: calc(100% - ${theme.sizeUnit * 2}px);
      height: calc(100% - ${theme.sizeUnit * 2}px);
      left: ${theme.sizeUnit}px;
      top: ${theme.sizeUnit}px;
      border: 1px dashed transparent;
      border-radius: ${theme.borderRadius}px;
      opacity: 0.5;
    }
  `}
`;

const SCROLL_STEP = 220;

const ScrollButton = styled.button<{ $side: 'left' | 'right' }>`
  ${({ theme, $side }) => css`
    position: absolute;
    top: 0;
    bottom: 0;
    ${$side}: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 7}px;
    padding: 0;
    border: 0;
    color: ${theme.colorTextSecondary};
    background: linear-gradient(
      ${$side === 'left' ? '90deg' : '270deg'},
      ${theme.colorBgContainer} 55%,
      transparent
    );
    cursor: pointer;
    &:hover {
      color: ${theme.colorPrimary};
    }
  `}
`;

/**
 * Arrows over the tab strip when the tabs are wider than the page. Ant
 * Design scrolls the strip on wheel events, so the arrows send those.
 */
function TabsScrollButtons({ dock }: { dock: HTMLElement | null }) {
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    if (!dock) return undefined;
    const read = () => {
      const wrap = dock.querySelector('.ant-tabs-nav-wrap');
      setMore({
        left: !!wrap?.classList.contains('ant-tabs-nav-wrap-ping-left'),
        right: !!wrap?.classList.contains('ant-tabs-nav-wrap-ping-right'),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(dock, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [dock]);

  const scroll = useCallback(
    (direction: 1 | -1) => {
      dock?.querySelector('.ant-tabs-nav-wrap')?.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: direction * SCROLL_STEP,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [dock],
  );

  return (
    <>
      {more.left && (
        <ScrollButton
          type="button"
          $side="left"
          aria-label={t('Previous tabs')}
          data-test="auradata-tabs-scroll-left"
          onClick={() => scroll(-1)}
        >
          <Icons.LeftOutlined iconSize="s" />
        </ScrollButton>
      )}
      {more.right && (
        <ScrollButton
          type="button"
          $side="right"
          aria-label={t('Next tabs')}
          data-test="auradata-tabs-scroll-right"
          onClick={() => scroll(1)}
        >
          <Icons.RightOutlined iconSize="s" />
        </ScrollButton>
      )}
    </>
  );
}

/**
 * Where the tabs go: right above the page, with its width and zoom, or with
 * ``bar`` in the page bar at the bottom of the report.
 */
export function TabsDockTarget({
  style,
  bar = false,
}: {
  style?: CSSProperties;
  bar?: boolean;
}) {
  const context = useContext(TabsDockContext);
  const slot = context?.slot ?? null;
  return (
    <Dock
      data-test="auradata-tabs-dock"
      ref={context?.setSlot}
      style={style}
      $bar={bar}
    >
      <TabsScrollButtons dock={slot} />
    </Dock>
  );
}

/** Renders its children in the dock when there is one, in place otherwise. */
export function InTabsDock({ children }: { children: ReactNode }) {
  const slot = useContext(TabsDockContext)?.slot ?? null;
  return slot ? createPortal(children, slot) : <>{children}</>;
}

const Bar = styled.div`
  ${({ theme }) => css`
    flex: none;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    container-type: inline-size;
    border-top: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    /* The page count sits in the middle while the zoom fits beside it, and
       at the start otherwise; then the zoom gives up its slider, then its
       fit choice */
    @container (max-width: 1240px) {
      .auradata-page-status {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .auradata-page-status-start {
        display: none;
      }
    }
    @container (max-width: 720px) {
      [data-test='auradata-zoom-toolbar'] .ant-slider {
        display: none;
      }
    }
    @container (max-width: 560px) {
      [data-test='auradata-zoom-toolbar'] .auradata-zoom-fit,
      [data-test='auradata-zoom-toolbar'] .auradata-zoom-split {
        display: none;
      }
    }
  `}
`;

/** The first level of the bar: the page tabs, with the whole width. */
const TabsRow = styled.div<{ $empty: boolean }>`
  ${({ theme, $empty }) => css`
    flex: none;
    display: ${$empty ? 'none' : 'flex'};
    align-items: stretch;
    box-sizing: border-box;
    height: ${theme.sizeUnit * 10}px;
    padding: 0 ${theme.sizeUnit * 2}px;
  `}
`;

/**
 * The second level: where the reader is among the pages, in the middle, and
 * the zoom at the end.
 */
const StatusRow = styled.div<{ $split: boolean }>`
  ${({ theme, $split }) => css`
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    column-gap: ${theme.sizeUnit * 4}px;
    box-sizing: border-box;
    height: ${theme.sizeUnit * 10}px;
    padding: 0 ${theme.sizeUnit * 4}px;
    border-top: ${$split ? `1px solid ${theme.colorSplit}` : 0};
    background: ${theme.colorFillQuaternary};
  `}
`;

const Pager = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    .auradata-page-count {
      min-width: ${theme.sizeUnit * 22}px;
      text-align: center;
      white-space: nowrap;
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeSM}px;
      font-variant-numeric: tabular-nums;
      color: ${theme.colorText};
    }
  `}
`;

const End = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 3}px;
    min-width: 0;
  `}
`;

const Arrow = styled.button`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 7}px;
    height: ${theme.sizeUnit * 7}px;
    padding: 0;
    border: 0;
    border-radius: ${theme.borderRadius}px;
    background: transparent;
    color: ${theme.colorTextSecondary};
    cursor: pointer;
    &:hover:not(:disabled) {
      color: ${theme.colorText};
      background: ${theme.colorFillTertiary};
    }
    &:disabled {
      color: ${theme.colorTextQuaternary};
      cursor: default;
    }
  `}
`;

/** Whether the browser shows the app full screen, and a way to switch it. */
function useFullScreen() {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const read = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', read);
    return () => document.removeEventListener('fullscreenchange', read);
  }, []);
  const toggle = useCallback(() => {
    // A frame without ``allowfullscreen`` refuses: the page stays as it is
    const change = document.fullscreenElement
      ? document.exitFullscreen?.()
      : document.documentElement.requestFullscreen?.();
    change?.catch(() => {});
  }, []);
  return { on, toggle };
}

/**
 * The bar at the bottom of a report, in two levels: the page tabs, and under
 * them a status row with the arrows to the previous and next page around the
 * page count, as in an embedded Power BI report, and what ``children`` holds
 * (the zoom) at its end, before the full screen button.
 */
export function PageBar({ children }: { children?: ReactNode }) {
  const dispatch = useDispatch();
  const editMode = useSelector(
    (state: RootState) => !!state.dashboardState?.editMode,
  );
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout?.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState?.activeTabs,
  );
  // Editors go through every page, viewers through the ones they can see
  const pages = useMemo(
    () => (layout ? (editMode ? topLevelTabs : visibleTabs)(layout) : []),
    [layout, editMode],
  );
  const index = pages.findIndex(page => activeTabs?.includes(page.id));
  const go = (step: -1 | 1) => {
    const page = pages[index + step];
    if (page) dispatch(setDirectPathToChild(page.path));
  };
  const several = pages.length > 1;
  const fullScreen = useFullScreen();
  return (
    <Bar data-test="auradata-page-bar">
      {/* Kept mounted without pages: the tabs dock is where they would go */}
      <TabsRow $empty={pages.length === 0} data-test="auradata-page-tabs-row">
        <TabsDockTarget bar />
      </TabsRow>
      <StatusRow
        className="auradata-page-status"
        data-test="auradata-page-status"
        $split={pages.length > 0}
      >
        <span className="auradata-page-status-start" />
        <Pager>
          {several && (
            <Arrow
              type="button"
              aria-label={t('Previous page')}
              data-test="auradata-page-previous"
              disabled={index <= 0}
              onClick={() => go(-1)}
            >
              <Icons.LeftOutlined iconSize="s" />
            </Arrow>
          )}
          {pages.length > 0 && index >= 0 && (
            <span
              className="auradata-page-count"
              data-test="auradata-page-count"
            >
              {t('Page %s of %s', index + 1, pages.length)}
            </span>
          )}
          {several && (
            <Arrow
              type="button"
              aria-label={t('Next page')}
              data-test="auradata-page-next"
              disabled={index < 0 || index >= pages.length - 1}
              onClick={() => go(1)}
            >
              <Icons.RightOutlined iconSize="s" />
            </Arrow>
          )}
        </Pager>
        <End>
          {children}
          {/* Not offered where the browser forbids it, as in a frame that
              was not allowed to go full screen */}
          {document.fullscreenEnabled && (
            <Arrow
              type="button"
              aria-label={
                fullScreen.on ? t('Exit full screen') : t('Full screen')
              }
              title={fullScreen.on ? t('Exit full screen') : t('Full screen')}
              aria-pressed={fullScreen.on}
              data-test="auradata-page-full-screen"
              onClick={fullScreen.toggle}
            >
              {fullScreen.on ? (
                <Icons.FullscreenExitOutlined iconSize="m" />
              ) : (
                <Icons.FullscreenOutlined iconSize="m" />
              )}
            </Arrow>
          )}
        </End>
      </StatusRow>
    </Bar>
  );
}
