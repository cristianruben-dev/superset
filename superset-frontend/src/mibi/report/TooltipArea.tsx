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
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import type { RootState } from 'src/dashboard/types';
import { CELL } from 'src/mibi/format/types';
import { tooltipPageOf } from './tooltipPages';

const Area = styled.div`
  ${({ theme }) => css`
    position: absolute;
    left: 0;
    top: 0;
    z-index: 0;
    pointer-events: none;
    border: 2px dashed ${theme.colorPrimary};
    background: ${theme.colorPrimaryBg};
    opacity: 0.6;
    span {
      position: absolute;
      right: 0;
      top: 100%;
      padding: 0 ${theme.sizeUnit}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorPrimary};
      white-space: nowrap;
    }
  `}
`;

/**
 * While editing a tooltip page: the area that shows as tooltip, under the
 * objects of the page.
 */
export function TooltipArea({ pageId }: { pageId: string | undefined }) {
  const page = useSelector((state: RootState) =>
    pageId
      ? tooltipPageOf(state.dashboardLayout.present[pageId]?.meta)
      : undefined,
  );
  if (!page) return null;
  const width = page.width * CELL;
  const height = page.height * CELL;
  return (
    <Area aria-hidden data-test="mibi-tooltip-area" style={{ width, height }}>
      <span>{t('Tooltip %s × %s', width, height)}</span>
    </Area>
  );
}
