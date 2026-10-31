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
import type { ReactNode } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import { HelpTooltip } from './HelpTooltip';
import type { HelpIllustrationKind } from './illustrations';

export type FieldHelpContent = {
  kind: HelpIllustrationKind;
  text: ReactNode;
};

/** The info icon next to a Format pane field; opens a drawing of what it does. */
export const FieldHelp = ({
  label,
  help,
}: {
  label: ReactNode;
  help: FieldHelpContent;
}) => {
  const theme = useTheme();
  return (
    <HelpTooltip title={label} description={help.text} kind={help.kind}>
      <span
        role="img"
        tabIndex={0}
        aria-label={t('Help')}
        data-test="mibi-field-help"
        css={css`
          display: inline-flex;
          margin-left: ${theme.sizeUnit * 1.5}px;
          color: ${theme.colorTextQuaternary};
          font-size: ${theme.fontSizeSM}px;
          line-height: 1;
          vertical-align: middle;
          cursor: help;
          transition: color 0.15s;
          &:hover,
          &:focus-visible {
            color: ${theme.colorPrimary};
            outline: none;
          }
        `}
      >
        <Icons.InfoCircleOutlined iconSize="s" />
      </span>
    </HelpTooltip>
  );
};
