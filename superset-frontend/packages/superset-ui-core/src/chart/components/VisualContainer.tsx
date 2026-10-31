/*
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
import { CSSProperties, ReactNode } from 'react';
import {
  ResolvedFontStyle,
  VISUAL_DIVIDER_GAP,
  VISUAL_SUBTITLE_GAP,
  VISUAL_TITLE_BACKGROUND_PADDING,
  VisualContainerConfig,
  getVisualLineHeight,
  getVisualShadowCss,
  getVisualShadowMargin,
} from '../visualFormatting';

export type VisualContainerProps = {
  config: VisualContainerConfig;
  width: number;
  height: number;
  headerHeight: number;
  children: ReactNode;
};

const fontToCss = (font: ResolvedFontStyle): CSSProperties => ({
  fontFamily: font.fontFamily,
  fontSize: font.fontSize,
  fontWeight: font.bold ? 600 : 400,
  fontStyle: font.italic ? 'italic' : 'normal',
  color: font.color,
  lineHeight: `${getVisualLineHeight(font.fontSize)}px`,
  height: getVisualLineHeight(font.fontSize),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  margin: 0,
});

/**
 * Frame drawn around a chart when the user customizes its title, subtitle,
 * divider, background, border, shadow or padding from the "Format" controls.
 * Styles come from user-entered form data, so they are applied inline.
 */
export default function VisualContainer({
  config,
  width,
  height,
  headerHeight,
  children,
}: VisualContainerProps) {
  const { title, subtitle, divider, border, padding } = config;
  const margin = getVisualShadowMargin(config);

  const frameStyle: CSSProperties = {
    boxSizing: 'border-box',
    width: Math.max(width - margin * 2, 0),
    height: Math.max(height - margin * 2, 0),
    margin,
    padding,
    background: config.background,
    border: border
      ? `${border.width}px solid ${border.color ?? 'transparent'}`
      : undefined,
    borderRadius: border?.radius,
    boxShadow: getVisualShadowCss(config),
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div data-test="visual-container" style={frameStyle}>
      {headerHeight > 0 && (
        <div
          data-test="visual-container-header"
          style={{
            height: headerHeight,
            flex: '0 0 auto',
            boxSizing: 'border-box',
            paddingBottom: config.headerSpacing,
          }}
        >
          {title && (
            <h2
              data-test="visual-container-title"
              title={title.text}
              style={{
                ...fontToCss(title.font),
                textAlign: title.align,
                ...(title.background
                  ? {
                      background: title.background,
                      boxSizing: 'content-box',
                      padding: `${VISUAL_TITLE_BACKGROUND_PADDING}px ${
                        VISUAL_TITLE_BACKGROUND_PADDING * 2
                      }px`,
                    }
                  : {}),
              }}
            >
              {title.text}
            </h2>
          )}
          {subtitle && (
            <div
              data-test="visual-container-subtitle"
              title={subtitle.text}
              style={{
                ...fontToCss(subtitle.font),
                textAlign: subtitle.align,
                marginTop: title ? VISUAL_SUBTITLE_GAP : 0,
              }}
            >
              {subtitle.text}
            </div>
          )}
          {divider && (
            <hr
              data-test="visual-container-divider"
              style={{
                margin: 0,
                marginTop: title || subtitle ? VISUAL_DIVIDER_GAP : 0,
                border: 'none',
                borderTop: `${divider.width}px ${divider.style} ${
                  divider.color ?? 'currentColor'
                }`,
                height: 0,
              }}
            />
          )}
        </div>
      )}
      <div style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}
