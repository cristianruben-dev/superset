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

import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Slider } from '@superset-ui/core/components';
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  setCanvasView,
  useCanvasView,
} from './canvasView';

const Bar = styled.div`
  ${({ theme }) => css`
    position: absolute;
    right: ${theme.sizeUnit * 4}px;
    bottom: ${theme.sizeUnit * 3}px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgElevated};
    box-shadow: ${theme.boxShadowSecondary};
    .ant-slider {
      width: ${theme.sizeUnit * 28}px;
      margin: 0 ${theme.sizeUnit}px;
    }
    .percent {
      min-width: ${theme.sizeUnit * 11}px;
      text-align: right;
      font-size: ${theme.fontSizeSM}px;
      font-variant-numeric: tabular-nums;
    }
  `}
`;

/** Zoom controls of the report, like the ones at the bottom of Power BI. */
export function ZoomToolbar({ zoom }: { zoom: number }) {
  const view = useCanvasView();
  const step = (direction: 1 | -1) =>
    setCanvasView({
      mode: 'custom',
      zoom: clampZoom(Math.round(zoom * 100 + direction * 10) / 100),
    });
  return (
    <Bar data-test="mibi-zoom-toolbar">
      <Button
        buttonSize="xsmall"
        buttonStyle={view.mode === 'fit-page' ? 'primary' : 'tertiary'}
        onClick={() => setCanvasView({ mode: 'fit-page' })}
      >
        {t('Fit page')}
      </Button>
      <Button
        buttonSize="xsmall"
        buttonStyle={view.mode === 'fit-width' ? 'primary' : 'tertiary'}
        onClick={() => setCanvasView({ mode: 'fit-width' })}
      >
        {t('Fit width')}
      </Button>
      <Button
        buttonSize="xsmall"
        buttonStyle="tertiary"
        onClick={() => setCanvasView({ mode: 'custom', zoom: 1 })}
      >
        100%
      </Button>
      <Button
        buttonSize="xsmall"
        buttonStyle="tertiary"
        aria-label={t('Zoom out')}
        onClick={() => step(-1)}
      >
        −
      </Button>
      <Slider
        min={Math.round(MIN_ZOOM * 100)}
        max={Math.round(MAX_ZOOM * 100)}
        value={Math.round(zoom * 100)}
        onChange={(value: number) =>
          setCanvasView({ mode: 'custom', zoom: value / 100 })
        }
        tooltip={{ open: false }}
      />
      <Button
        buttonSize="xsmall"
        buttonStyle="tertiary"
        aria-label={t('Zoom in')}
        onClick={() => step(1)}
      >
        +
      </Button>
      <span className="percent">{Math.round(zoom * 100)}%</span>
    </Bar>
  );
}
