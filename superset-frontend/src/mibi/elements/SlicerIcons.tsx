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
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { headerTooltipStyle } from 'src/mibi/format/styles';
import type { VisualFormat } from 'src/mibi/format/types';
import { useElementAction } from './actions';
import type { FilterElement } from './types';

const Bar = styled.div`
  ${({ theme }) => css`
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    display: flex;
    gap: ${theme.sizeUnit / 2}px;
    color: var(--mb-v-icon-color, ${theme.colorTextSecondary});

    button,
    .mibi-slicer-help {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: ${theme.borderRadiusSM}px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    button:hover {
      background: ${theme.colorFillTertiary};
    }
    button:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
    }
    button:disabled {
      cursor: default;
      opacity: 0.6;
    }
  `}
`;

function IconButton({
  title,
  onClick,
  testId,
  children,
}: {
  title: ReactNode;
  onClick?: () => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Tooltip title={title} placement="top">
      <button
        type="button"
        aria-label={typeof title === 'string' ? title : undefined}
        data-test={testId}
        disabled={!onClick}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * The icons in the corner of a slicer, as Power BI shows them: an eraser that
 * clears what is chosen, the help text of the header and its action.
 */
export function SlicerIcons({
  filterId,
  config,
  format,
}: {
  filterId: string;
  config: FilterElement;
  format: VisualFormat | undefined;
}) {
  const dispatch = useDispatch();
  const chosen = useSelector((state: RootState) => {
    const value = state.dataMask[filterId]?.filterState?.value;
    return Array.isArray(value)
      ? value.some(item => item !== null && item !== undefined)
      : value !== null && value !== undefined && value !== '';
  });
  const link = format?.link;
  const runLink = useElementAction(link?.action, !!link?.show);
  const tooltip = format?.header?.tooltip;
  const showHelp = !!format?.header?.tooltipIcon && !!tooltip?.text;
  const showClear = config.showClear !== false && chosen;
  if (!showClear && !showHelp && !link?.show) return null;

  const clear = () =>
    dispatch(
      updateDataMask(filterId, {
        extraFormData: {},
        filterState: { value: null, label: undefined },
      }),
    );

  return (
    <Bar className="mibi-slicer-icons">
      {link?.show && (
        <IconButton
          title={
            runLink
              ? link.tooltip || t('Go to the action of this slicer')
              : link.disabledTooltip || t('This action is not available')
          }
          onClick={runLink}
          testId="mibi-slicer-link"
        >
          <Icons.LinkOutlined iconSize="m" />
        </IconButton>
      )}
      {showHelp && (
        <Tooltip
          title={tooltip?.text}
          placement="top"
          styles={{ container: headerTooltipStyle(tooltip ?? {}) }}
        >
          <span
            role="img"
            aria-label={tooltip?.text}
            data-test="mibi-slicer-help"
            className="mibi-slicer-help"
          >
            <Icons.QuestionCircleOutlined iconSize="m" />
          </span>
        </Tooltip>
      )}
      {showClear && (
        <IconButton
          title={t('Clear selections')}
          onClick={clear}
          testId="mibi-slicer-clear"
        >
          <Icons.ClearOutlined iconSize="m" />
        </IconButton>
      )}
    </Bar>
  );
}
