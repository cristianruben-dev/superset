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
import { ReactNode } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { HelpIllustration, helpKindFor } from './illustrations';

export const HELP_TOOLTIP_WIDTH = 248;

/**
 * Body of the help tooltip shown next to a control label: an illustration of
 * what the control changes, the control's name and its explanation. Controls
 * without a matching illustration show the explanation alone.
 */
export function HelpTooltipContent({
  name,
  label,
  description,
}: {
  name?: string;
  label?: ReactNode;
  description: ReactNode;
}) {
  const theme = useTheme();
  const kind = helpKindFor(name);
  return (
    <div
      data-test="help-tooltip"
      css={css`
        display: flex;
        flex-direction: column;
        gap: ${theme.sizeUnit * 2}px;
        padding: ${theme.sizeUnit}px;
        color: ${theme.colorText};
      `}
    >
      {kind && (
        <div
          css={css`
            background: ${theme.colorBgContainer};
            border: 1px solid ${theme.colorBorderSecondary};
            border-radius: ${theme.borderRadius}px;
            padding: ${theme.sizeUnit * 2}px;
          `}
        >
          <HelpIllustration kind={kind} />
        </div>
      )}
      {typeof label === 'string' && (
        <strong
          css={css`
            font-size: ${theme.fontSizeSM}px;
            line-height: 1.3;
          `}
        >
          {label}
        </strong>
      )}
      <span
        css={css`
          font-size: ${theme.fontSizeSM}px;
          line-height: 1.45;
          color: ${theme.colorTextSecondary};
        `}
      >
        {description}
      </span>
    </div>
  );
}
