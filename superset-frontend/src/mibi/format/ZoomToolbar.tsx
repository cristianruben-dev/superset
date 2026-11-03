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
import { Button, Select, Slider } from '@superset-ui/core/components';
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  setCanvasView,
  useCanvasView,
} from './canvasView';

const Bar = styled.div<{ $docked?: boolean }>`
  ${({ theme, $docked }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    ${$docked
      ? css`
          padding: 0;
          .percent {
            font-family: ${theme.fontFamilyCode};
          }
          .mibi-zoom-step {
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${theme.sizeUnit * 6}px;
            height: ${theme.sizeUnit * 6}px;
            padding: 0;
            border: 0;
            border-radius: ${theme.borderRadius}px;
            background: transparent;
            color: ${theme.colorTextSecondary};
            font-size: ${theme.fontSizeLG}px;
            line-height: 1;
            cursor: pointer;
            &:hover {
              color: ${theme.colorText};
              background: ${theme.colorFillTertiary};
            }
          }
          .ant-slider {
            margin: 0 ${theme.sizeUnit}px;
          }
          /* A compact choice that keeps to the height of the bar */
          .mibi-zoom-fit {
            width: ${theme.sizeUnit * 44}px;
            .ant-select-selector {
              height: ${theme.sizeUnit * 7}px !important;
              min-height: 0 !important;
              padding-block: 0 !important;
              font-size: ${theme.fontSizeSM}px;
            }
            .ant-select-selection-item,
            .ant-select-selection-search-input {
              height: ${theme.sizeUnit * 7 - 2}px !important;
              line-height: ${theme.sizeUnit * 7 - 2}px !important;
            }
          }
        `
      : css`
          position: absolute;
          right: ${theme.sizeUnit * 4}px;
          bottom: ${theme.sizeUnit * 3}px;
          z-index: 20;
          padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
          border-radius: ${theme.borderRadiusLG}px;
          border: 1px solid ${theme.colorBorderSecondary};
          background: ${theme.colorBgElevated};
          box-shadow: ${theme.boxShadowSecondary};
        `}
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

/**
 * Zoom controls of the report, like the ones at the bottom of Power BI:
 * floating over the page, or ``docked`` in the page bar.
 */
export function ZoomToolbar({
  zoom,
  docked = false,
}: {
  zoom: number;
  docked?: boolean;
}) {
  const view = useCanvasView();
  const step = (direction: 1 | -1) =>
    setCanvasView({
      mode: 'custom',
      zoom: clampZoom(Math.round(zoom * 100 + direction * 10) / 100),
    });
  if (docked) {
    // As in the status bar of Power BI: the zoom, then how the page fits
    const fit =
      view.mode === 'custom' ? (zoom === 1 ? 'actual' : 'custom') : view.mode;
    return (
      <Bar data-test="mibi-zoom-toolbar" $docked>
        <button
          type="button"
          className="mibi-zoom-step"
          aria-label={t('Zoom out')}
          onClick={() => step(-1)}
        >
          −
        </button>
        <Slider
          min={Math.round(MIN_ZOOM * 100)}
          max={Math.round(MAX_ZOOM * 100)}
          value={Math.round(zoom * 100)}
          onChange={(value: number) =>
            setCanvasView({ mode: 'custom', zoom: value / 100 })
          }
          tooltip={{ open: false }}
        />
        <button
          type="button"
          className="mibi-zoom-step"
          aria-label={t('Zoom in')}
          onClick={() => step(1)}
        >
          +
        </button>
        <span className="percent">{Math.round(zoom * 100)}%</span>
        <Select
          className="mibi-zoom-fit"
          ariaLabel={t('Fit')}
          data-test="mibi-zoom-fit"
          value={fit}
          showSearch={false}
          onChange={value => {
            if (value === 'actual') setCanvasView({ mode: 'custom', zoom: 1 });
            else if (value === 'fit-page' || value === 'fit-width') {
              setCanvasView({ mode: value });
            }
          }}
          options={[
            { value: 'fit-page', label: t('Fit page') },
            { value: 'fit-width', label: t('Fit width') },
            { value: 'actual', label: t('Actual size') },
            ...(fit === 'custom'
              ? [{ value: 'custom', label: t('Custom') }]
              : []),
          ]}
        />
      </Bar>
    );
  }

  return (
    <Bar data-test="mibi-zoom-toolbar" $docked={docked}>
      <Button
        buttonSize="xsmall"
        className="mibi-zoom-fit"
        buttonStyle={view.mode === 'fit-page' ? 'primary' : 'tertiary'}
        onClick={() => setCanvasView({ mode: 'fit-page' })}
      >
        {t('Fit page')}
      </Button>
      <Button
        buttonSize="xsmall"
        className="mibi-zoom-fit"
        buttonStyle={view.mode === 'fit-width' ? 'primary' : 'tertiary'}
        onClick={() => setCanvasView({ mode: 'fit-width' })}
      >
        {t('Fit width')}
      </Button>
      <Button
        buttonSize="xsmall"
        buttonStyle="tertiary"
        className="mibi-zoom-actual"
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
