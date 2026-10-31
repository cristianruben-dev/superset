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

const Dock = styled.div`
  ${({ theme }) => css`
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

/** Where the tabs go: right above the page, with its width and zoom. */
export function TabsDockTarget({ style }: { style?: CSSProperties }) {
  const context = useContext(TabsDockContext);
  const slot = context?.slot ?? null;
  return (
    <Dock data-test="mibi-tabs-dock" ref={context?.setSlot} style={style}>
      <TabsScrollButtons dock={slot} />
    </Dock>
  );
}

/** Renders its children in the dock when there is one, in place otherwise. */
export function InTabsDock({ children }: { children: ReactNode }) {
  const slot = useContext(TabsDockContext)?.slot ?? null;
  return slot ? createPortal(children, slot) : <>{children}</>;
}
