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
import type { ReactElement, ReactNode } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { Tooltip, type TooltipProps } from '@superset-ui/core/components';
import { HelpIllustration, type HelpIllustrationKind } from './illustrations';
import { helpIllustrationFor } from './registry';

export const HELP_CARD_WIDTH = 264;

export type HelpCardProps = {
  title?: ReactNode;
  description: ReactNode;
  kind?: HelpIllustrationKind;
};

/** The body of a help tooltip: a drawing of the control, its name and what it does. */
export const HelpCard = ({ title, description, kind }: HelpCardProps) => {
  const theme = useTheme();
  return (
    <div
      data-test="help-card"
      css={css`
        width: ${HELP_CARD_WIDTH}px;
        max-width: calc(100vw - ${theme.sizeUnit * 8}px);
        color: ${theme.colorText};
        text-align: left;
        @keyframes mibi-help-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.45;
          }
        }
        .hl {
          animation: mibi-help-pulse 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hl {
            animation: none;
          }
        }
      `}
    >
      {kind && (
        <div
          css={css`
            padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2}px 0;
            background: linear-gradient(
              180deg,
              ${theme.colorPrimaryBg} 0%,
              ${theme.colorBgElevated} 100%
            );
            border-radius: ${theme.borderRadiusLG}px ${theme.borderRadiusLG}px 0
              0;
          `}
        >
          <HelpIllustration kind={kind} />
        </div>
      )}
      <div
        css={css`
          padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 3.5}px
            ${theme.sizeUnit * 3.5}px;
        `}
      >
        {title && (
          <div
            css={css`
              font-size: ${theme.fontSize}px;
              font-weight: ${theme.fontWeightStrong};
              letter-spacing: -0.01em;
              line-height: 1.3;
              margin-bottom: ${theme.sizeUnit}px;
            `}
          >
            {title}
          </div>
        )}
        <div
          css={css`
            font-size: ${theme.fontSizeSM}px;
            line-height: 1.5;
            color: ${theme.colorTextSecondary};
          `}
        >
          {description}
        </div>
      </div>
    </div>
  );
};

export type HelpTooltipProps = Omit<TooltipProps, 'title' | 'children'> & {
  /** Name of the control; picks the drawing when `kind` is not given. */
  controlName?: string;
  kind?: HelpIllustrationKind;
  title?: ReactNode;
  description: ReactNode;
  children: ReactElement;
};

/** A tooltip with a drawing, in the app's style. Falls back to text only. */
export const HelpTooltip = ({
  controlName,
  kind,
  title,
  description,
  children,
  placement = 'left',
  ...rest
}: HelpTooltipProps) => {
  const theme = useTheme();
  return (
    <Tooltip
      placement={placement}
      mouseEnterDelay={0.12}
      color={theme.colorBgElevated}
      classNames={{ root: 'mibi-help-tooltip' }}
      title={
        <HelpCard
          title={title}
          description={description}
          kind={kind ?? helpIllustrationFor(controlName)}
        />
      }
      {...rest}
    >
      {children}
    </Tooltip>
  );
};
