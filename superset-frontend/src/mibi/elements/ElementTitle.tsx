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
import { css, styled } from '@apache-superset/core/theme';
import type { VisualFormat } from 'src/mibi/format/types';

const Head = styled.div`
  ${({ theme }) => css`
    flex: none;
    min-width: 0;
    padding-bottom: ${theme.sizeUnit}px;

    &.is-bleed {
      margin-left: calc(var(--mb-v-pad-left, 16px) * -1);
      margin-right: calc(var(--mb-v-pad-right, 16px) * -1);
      padding-left: var(--mb-v-pad-left, 16px);
      padding-right: var(--mb-v-pad-right, 16px);
    }
    .element-title,
    .element-subtitle {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .element-title {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.4;
      color: ${theme.colorText};
    }
    .element-subtitle {
      margin-top: 2px;
      font-size: 12px;
      line-height: 1.4;
      color: ${theme.colorTextTertiary};
    }
    .is-wrap {
      white-space: normal;
    }
  `}
`;

/**
 * The title and subtitle of a design element, from the General level of the
 * Format pane. Nothing shows until the title is turned on.
 */
export function ElementTitle({
  format,
  fallback,
}: {
  format: VisualFormat | undefined;
  /** What the title says when no text was written */
  fallback: string;
}) {
  const title = format?.title;
  if (!title?.show) return null;
  const text = title.template?.trim() || fallback;
  return (
    <Head
      data-test="mibi-element-title"
      className={title.divider && title.dividerBleed ? 'is-bleed' : undefined}
      style={{
        background: title.background,
        marginBottom: title.gap ?? 8,
        ...(title.divider && {
          borderBottom: `${title.dividerWidth ?? 1}px ${
            title.dividerStyle ?? 'solid'
          } ${title.dividerColor ?? 'currentColor'}`,
        }),
      }}
    >
      <div
        className={title.wrap ? 'element-title is-wrap' : 'element-title'}
        role={title.heading ? 'heading' : undefined}
        aria-level={title.heading}
        style={{
          fontSize: title.size,
          color: title.color,
          fontFamily: title.fontFamily,
          fontWeight: title.bold === false ? 400 : undefined,
          fontStyle: title.italic ? 'italic' : undefined,
          textDecoration: title.underline ? 'underline' : undefined,
          textAlign: title.align,
        }}
      >
        {text}
      </div>
      {title.subtitle && (
        <div
          className={
            title.subtitleWrap ? 'element-subtitle is-wrap' : 'element-subtitle'
          }
          data-test="mibi-element-subtitle"
          role={title.subtitleHeading ? 'heading' : undefined}
          aria-level={title.subtitleHeading}
          style={{
            fontSize: title.subtitleSize,
            color: title.subtitleColor,
            fontFamily: title.subtitleFamily,
            fontWeight: title.subtitleBold ? 700 : undefined,
            fontStyle: title.subtitleItalic ? 'italic' : undefined,
            textDecoration: title.subtitleUnderline ? 'underline' : undefined,
            textAlign: title.subtitleAlign ?? title.align,
          }}
        >
          {title.subtitle}
        </div>
      )}
    </Head>
  );
}
