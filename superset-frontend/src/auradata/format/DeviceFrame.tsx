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
import { forwardRef, type ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  css,
  styled,
  useTheme,
  type SupersetTheme,
} from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { CLOSED_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import { pixelsOf, safeHeightOf, type MobileDevice } from './mobileDevices';

/** The hour every phone picture shows: a drawing, never translated. */
const STATUS_BAR_TIME = '9:41';

/**
 * Colors of the phone itself: hardware, the same in light and dark themes.
 */
const HARDWARE = {
  // eslint-disable-next-line theme-colors/no-literal-colors
  body: '#1c1c1e',
  // eslint-disable-next-line theme-colors/no-literal-colors
  edge: '#3a3a3c',
  // eslint-disable-next-line theme-colors/no-literal-colors
  inner: '#111111',
  // eslint-disable-next-line theme-colors/no-literal-colors
  key: '#2c2c2e',
  // eslint-disable-next-line theme-colors/no-literal-colors
  glass: '#000000',
  // eslint-disable-next-line theme-colors/no-literal-colors
  shadow: 'rgba(0, 0, 0, 0.45)',
  // eslint-disable-next-line theme-colors/no-literal-colors
  outline: 'rgba(0, 0, 0, 0.35)',
};

/**
 * What the app takes of a phone screen around a report, as measured on a
 * phone 393 points wide: the top bar (57) and the report header (65) above,
 * the room above the page, and the closed filter rail on the right.
 */
export const VIEWER_HEADER_HEIGHT = 122;
export const VIEWER_PAGE_TOP = 12;
export const VIEWER_RAIL_WIDTH = CLOSED_FILTER_BAR_WIDTH;

/** What the preview draws around the page, as a phone viewer sees it. */
export interface ViewerChrome {
  title: string;
  /** The report shows the closed filter rail beside the page */
  rail: boolean;
  /** The theme of the app, which the bars use instead of the report's */
  theme: SupersetTheme;
}

/** Width of the body of the phone around its screen, in points. */
const BEZEL = 12;
/** Room above and below the screen of a phone with a home button. */
const HOME_BUTTON_BEZEL = 64;
/** Height of the line that names the device above it, in screen pixels. */
export const DEVICE_CAPTION_HEIGHT = 40;
/** Room kept around the device on the stage, in screen pixels. */
const STAGE_MARGIN = 24;

/** Size of the phone with its body, in points. */
export function deviceFrameSize(device: MobileDevice) {
  const vertical = device.homeButton ? HOME_BUTTON_BEZEL : BEZEL;
  return {
    width: device.width + BEZEL * 2,
    height: device.height + vertical * 2,
  };
}

/**
 * How much the phone is scaled on screen: to fit the room of the editor, or
 * at its own size (never larger than it is).
 */
export function deviceScale(
  device: MobileDevice,
  room: { width: number; height: number },
  fit: boolean,
): number {
  if (!fit || !room.width || !room.height) return 1;
  const frame = deviceFrameSize(device);
  const scale = Math.min(
    (room.width - STAGE_MARGIN * 2) / frame.width,
    (room.height - DEVICE_CAPTION_HEIGHT - STAGE_MARGIN * 2) / frame.height,
    1,
  );
  return Number.isFinite(scale) && scale > 0.2 ? scale : 0.2;
}

const Stage = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${STAGE_MARGIN / 2}px 0 ${STAGE_MARGIN}px;
    margin: 0 auto;
    .auradata-device-caption {
      height: ${DEVICE_CAPTION_HEIGHT - theme.sizeUnit * 2}px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      gap: ${theme.sizeUnit * 1.5}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
      white-space: nowrap;
    }
    .auradata-device-caption strong {
      color: ${theme.colorText};
      font-weight: ${theme.fontWeightStrong};
    }
    .auradata-device-chip {
      padding: 1px ${theme.sizeUnit * 2}px;
      border-radius: 999px;
      background: ${theme.colorFillTertiary};
      font-family: 'Geist Mono', ${theme.fontFamilyCode};
      font-size: 11px;
    }
  `}
`;

const Body = styled.div<{ $radius: number }>`
  ${({ $radius }) => css`
    position: relative;
    box-sizing: border-box;
    border-radius: ${$radius ? $radius + BEZEL : 52}px;
    background: ${HARDWARE.body};
    box-shadow:
      inset 0 0 0 1.5px ${HARDWARE.edge},
      inset 0 0 0 4px ${HARDWARE.inner},
      0 24px 48px -12px ${HARDWARE.shadow},
      0 0 0 1px ${HARDWARE.outline};
    .auradata-device-key {
      position: absolute;
      width: 4px;
      border-radius: 2px;
      background: ${HARDWARE.key};
    }
  `}
`;

const Screen = styled.div<{ $radius: number }>`
  ${({ theme, $radius }) => css`
    position: absolute;
    overflow: hidden;
    border-radius: ${$radius}px;
    background: ${theme.colorBgLayout};
    isolation: isolate;
  `}
`;

const Viewport = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  .auradata-device-scroll {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
`;

/** The top bar and the report header of the app, drawn plainly. */
function ViewerBars({ chrome }: { chrome: ViewerChrome }) {
  const { theme } = chrome;
  return (
    <div
      aria-hidden
      data-test="auradata-device-viewer-bars"
      css={css`
        flex: none;
        height: ${VIEWER_HEADER_HEIGHT}px;
        display: flex;
        flex-direction: column;
        background: ${theme.colorBgContainer};
        color: ${theme.colorText};
        border-bottom: 1px solid ${theme.colorBorderSecondary};
        .bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          box-sizing: border-box;
        }
        .top {
          height: 57px;
          border-bottom: 1px solid ${theme.colorBorderSecondary};
        }
        .header {
          flex: 1;
        }
        .title {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 20px;
          font-weight: 600;
        }
        .dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${theme.colorFillSecondary};
        }
        .icon {
          color: ${theme.colorTextSecondary};
          font-size: 18px;
        }
      `}
    >
      <div className="bar top">
        <img
          src="/static/assets/images/auradata/mark.svg"
          alt=""
          width={34}
          height={22}
        />
        <Icons.SearchOutlined className="icon" iconSize="l" />
        <span style={{ flex: 1 }} />
        <span className="dot" />
      </div>
      <div className="bar header">
        <span className="title">{chrome.title}</span>
        <Icons.StarOutlined className="icon" iconSize="l" />
        <Icons.EllipsisOutlined className="icon" iconSize="l" />
      </div>
    </div>
  );
}

/** The closed filter rail beside the page. */
function ViewerRail({ chrome }: { chrome: ViewerChrome }) {
  const { theme } = chrome;
  return (
    <div
      aria-hidden
      data-test="auradata-device-viewer-rail"
      css={css`
        flex: none;
        width: ${VIEWER_RAIL_WIDTH}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding-top: 16px;
        background: ${theme.colorBgContainer};
        color: ${theme.colorTextSecondary};
        border-left: 1px solid ${theme.colorBorderSecondary};
        span {
          writing-mode: vertical-rl;
          font-size: 11px;
          font-weight: 600;
        }
      `}
    >
      <Icons.FilterOutlined iconSize="m" />
      <span>{t('Filters')}</span>
    </div>
  );
}

const SafeMark = styled.div<{ $edge: 'top' | 'bottom' }>`
  ${({ theme, $edge }) => css`
    position: absolute;
    left: 0;
    right: 0;
    z-index: 3;
    pointer-events: none;
    background: repeating-linear-gradient(
      135deg,
      ${theme.colorPrimary}1f 0 6px,
      transparent 6px 12px
    );
    border-${$edge === 'top' ? 'bottom' : 'top'}: 1px dashed
      ${theme.colorPrimary};
    span {
      position: absolute;
      right: 10px;
      ${$edge === 'top' ? 'bottom: 3px;' : 'top: 3px;'}
      padding: 0 5px;
      border-radius: 4px;
      font-size: 10px;
      line-height: 16px;
      color: ${theme.colorTextLightSolid};
      background: ${theme.colorPrimary};
      font-family: 'Geist Mono', ${theme.fontFamilyCode};
    }
  `}
`;

/** The time, network and battery of the status bar, as a phone draws them. */
function StatusBar({ device }: { device: MobileDevice }) {
  const theme = useTheme();
  const compact = device.cutout === 'none';
  const height = compact ? device.safeTop : 54;
  const ink = theme.colorText;
  // The time and the icons sit beside the cutout
  const side = device.cutout === 'notch' ? 30 : compact ? 8 : 34;
  return (
    <div
      aria-hidden
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: ${height}px;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: ${compact ? 0 : 6}px ${side}px 0;
        color: ${ink};
        font-size: ${compact ? 12 : 16}px;
        font-weight: 600;
        letter-spacing: -0.2px;
        font-family: -apple-system, 'SF Pro Text', ${theme.fontFamily};
      `}
    >
      <span>{STATUS_BAR_TIME}</span>
      <svg
        width={compact ? 56 : 68}
        height={compact ? 10 : 12}
        viewBox="0 0 68 12"
        fill={ink}
      >
        <rect x="0" y="8" width="3" height="4" rx="1" />
        <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
        <rect x="10" y="3" width="3" height="9" rx="1" />
        <rect x="15" y="0.5" width="3" height="11.5" rx="1" />
        <path d="M30 3.2a10 10 0 0 1 13 0l-1.4 1.6a7.8 7.8 0 0 0-10.2 0zM32.6 6.2a6 6 0 0 1 7.8 0L39 7.8a3.8 3.8 0 0 0-5 0zM36.5 11.5 34.8 9.6a2.6 2.6 0 0 1 3.4 0z" />
        <rect
          x="44.5"
          y="0.5"
          width="20"
          height="11"
          rx="3.2"
          fill="none"
          stroke={ink}
          strokeOpacity="0.4"
        />
        <rect x="46.5" y="2.5" width="16" height="7" rx="1.8" />
        <path d="M66 4v4a2 2 0 0 0 0-4z" fillOpacity="0.4" />
      </svg>
    </div>
  );
}

function Cutout({ device }: { device: MobileDevice }) {
  if (device.cutout === 'island') {
    return (
      <div
        aria-hidden
        css={css`
          position: absolute;
          z-index: 4;
          top: 11px;
          left: 50%;
          width: 125px;
          height: 37px;
          margin-left: -62.5px;
          border-radius: 20px;
          background: ${HARDWARE.glass};
        `}
      />
    );
  }
  if (device.cutout === 'notch') {
    const width = device.width < 380 ? 154 : 162;
    return (
      <div
        aria-hidden
        css={css`
          position: absolute;
          z-index: 4;
          top: 0;
          left: 50%;
          width: ${width}px;
          height: 32px;
          margin-left: ${-width / 2}px;
          border-radius: 0 0 20px 20px;
          background: ${HARDWARE.glass};
        `}
      />
    );
  }
  return null;
}

/**
 * A phone around the page: its body, the status bar, the notch or the Dynamic
 * Island and the home indicator. The page scrolls inside the safe area of the
 * screen, as it does on the phone; `safeArea` marks what lies outside it.
 */
export const DeviceFrame = forwardRef<
  HTMLDivElement,
  {
    device: MobileDevice;
    scale: number;
    safeArea: boolean;
    /** Draws the bars of the app around the page, as a viewer sees it */
    viewer?: ViewerChrome | null;
    children: ReactNode;
  }
>(function DeviceFrame(
  { device, scale, safeArea, viewer, children },
  viewportRef,
) {
  const theme = useTheme();
  const frame = deviceFrameSize(device);
  const top = device.homeButton ? HOME_BUTTON_BEZEL : BEZEL;
  const pixels = pixelsOf(device);
  return (
    <Stage data-test="auradata-device-stage" data-device={device.id}>
      <div
        className="auradata-device-caption"
        data-test="auradata-device-caption"
      >
        <strong>{device.name}</strong>
        <span className="auradata-device-chip">
          {t('%s × %s pt', device.width, device.height)}
        </span>
        <span className="auradata-device-chip">
          {t('%s × %s px · @%sx', pixels.width, pixels.height, device.scale)}
        </span>
        <span className="auradata-device-chip" title={t('Safe area')}>
          {t('Safe area %s × %s pt', device.width, safeHeightOf(device))}
        </span>
        {scale < 0.999 && (
          <span className="auradata-device-chip">
            {Math.round(scale * 100)}%
          </span>
        )}
      </div>
      <div
        style={{
          width: frame.width * scale,
          height: frame.height * scale,
          flex: 'none',
        }}
      >
        <Body
          $radius={device.radius}
          data-test="auradata-device"
          style={{
            width: frame.width,
            height: frame.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <span
            className="auradata-device-key"
            style={{ left: -3, top: 120, height: 30 }}
          />
          <span
            className="auradata-device-key"
            style={{ left: -3, top: 180, height: 60 }}
          />
          <span
            className="auradata-device-key"
            style={{ left: -3, top: 250, height: 60 }}
          />
          <span
            className="auradata-device-key"
            style={{ right: -3, top: 200, height: 90 }}
          />
          {device.homeButton && (
            <span
              aria-hidden
              css={css`
                position: absolute;
                left: 50%;
                bottom: ${(HOME_BUTTON_BEZEL - 46) / 2}px;
                width: 46px;
                height: 46px;
                margin-left: -23px;
                border-radius: 50%;
                box-shadow: inset 0 0 0 2px ${HARDWARE.edge};
              `}
            />
          )}
          <Screen
            $radius={device.radius}
            style={{
              left: BEZEL,
              top,
              width: device.width,
              height: device.height,
            }}
          >
            <StatusBar device={device} />
            <Cutout device={device} />
            <Viewport
              data-test="auradata-device-viewport"
              style={{ top: device.safeTop, bottom: device.safeBottom }}
            >
              {viewer && <ViewerBars chrome={viewer} />}
              <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <div
                  ref={viewportRef}
                  className="auradata-device-scroll"
                  style={viewer ? { paddingTop: VIEWER_PAGE_TOP } : undefined}
                >
                  {children}
                </div>
                {viewer?.rail && <ViewerRail chrome={viewer} />}
              </div>
            </Viewport>
            {!device.homeButton && (
              <div
                aria-hidden
                css={css`
                  position: absolute;
                  z-index: 4;
                  left: 50%;
                  bottom: 8px;
                  width: ${device.width > 420 ? 140 : 134}px;
                  height: 5px;
                  margin-left: ${device.width > 420 ? -70 : -67}px;
                  border-radius: 3px;
                  background: ${theme.colorText};
                  opacity: 0.85;
                `}
              />
            )}
            {safeArea && (
              <>
                <SafeMark
                  $edge="top"
                  data-test="auradata-safe-top"
                  style={{ top: 0, height: device.safeTop }}
                >
                  <span>{t('%s pt', device.safeTop)}</span>
                </SafeMark>
                {device.safeBottom > 0 && (
                  <SafeMark
                    $edge="bottom"
                    data-test="auradata-safe-bottom"
                    style={{ bottom: 0, height: device.safeBottom }}
                  >
                    <span>{t('%s pt', device.safeBottom)}</span>
                  </SafeMark>
                )}
              </>
            )}
          </Screen>
        </Body>
      </div>
    </Stage>
  );
});
