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
    &:not(:empty) + .mibi-canvas {
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
    ${$bar &&
    css`
      flex: 1;
      min-width: 0;
      border-radius: 0;
      outline: 0;
      background: transparent;
      &:empty {
        display: block;
      }
      .dashboard-component-tabs {
        background: transparent;
      }
      .ant-tabs-nav {
        margin: 0;
        padding: 0 ${theme.sizeUnit * 2}px;
        &::before {
          border: 0;
        }
      }
      .ant-tabs-ink-bar {
        display: none;
      }
      .ant-tabs-nav-list {
        gap: ${theme.sizeUnit}px;
        align-items: stretch;
      }
      .ant-tabs-nav-list .ant-tabs-tab {
        position: relative;
        margin: 0 !important;
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: ${theme.colorTextSecondary};
        transition:
          background ${theme.motionDurationMid},
          color ${theme.motionDurationMid};
        &:hover {
          color: ${theme.colorText};
          background: ${theme.colorFillTertiary} !important;
        }
        &::after {
          content: '';
          position: absolute;
          left: ${theme.sizeUnit * 2}px;
          right: ${theme.sizeUnit * 2}px;
          bottom: 0;
          height: 3px;
          border-radius: 3px 3px 0 0;
          background: transparent;
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
      .ant-tabs-nav-list .ant-tabs-tab.ant-tabs-tab-active {
        background: ${theme.colorBgContainer} !important;
        box-shadow: 0 1px 0 ${theme.colorBgContainer};
        .ant-tabs-tab-btn {
          color: ${theme.colorText};
          font-weight: ${theme.fontWeightStrong};
        }
        &::after {
          background: ${theme.colorPrimary};
        }
      }
      .ant-tabs-nav-add {
        margin: ${theme.sizeUnit}px 0 ${theme.sizeUnit}px ${theme.sizeUnit}px;
        min-width: ${theme.sizeUnit * 8}px;
        border: 1px dashed ${theme.colorBorder} !important;
        border-radius: ${theme.borderRadius}px !important;
        background: transparent !important;
        color: ${theme.colorTextSecondary};
        &:hover {
          color: ${theme.colorPrimary};
          border-color: ${theme.colorPrimary} !important;
        }
      }
    `}

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
          data-test="mibi-tabs-scroll-left"
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
          data-test="mibi-tabs-scroll-right"
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
      data-test="mibi-tabs-dock"
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
    align-items: stretch;
    container-type: inline-size;
    /* The zoom gives up its slider, then its fit buttons, before the tabs
       give up their room */
    @container (max-width: 760px) {
      [data-test='mibi-zoom-toolbar'] .ant-slider,
      [data-test='mibi-zoom-toolbar'] .mibi-zoom-actual {
        display: none;
      }
    }
    @container (max-width: 560px) {
      [data-test='mibi-zoom-toolbar'] .mibi-zoom-fit {
        display: none;
      }
    }
    min-height: ${theme.sizeUnit * 10}px;
    border-top: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgLayout};
  `}
`;

const Extra = styled.div`
  ${({ theme }) => css`
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: 0 ${theme.sizeUnit * 3}px;
  `}
`;

/**
 * The bar at the bottom of a report, as in Power BI: the page tabs on the
 * left, and what ``children`` holds (the zoom) on the right.
 */
export function PageBar({ children }: { children?: ReactNode }) {
  return (
    <Bar data-test="mibi-page-bar">
      <TabsDockTarget bar />
      {children && <Extra>{children}</Extra>}
    </Bar>
  );
}
