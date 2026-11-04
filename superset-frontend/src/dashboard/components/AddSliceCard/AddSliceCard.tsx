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

import {
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  PropsWithChildren,
  RefObject,
  FC,
} from 'react';

import { t } from '@apache-superset/core/translation';
import { css } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { GenericLink, usePluginContext } from 'src/components';
import { VizTypeTile } from 'src/auradata/vizIcons/VizTypeIcon';
import { Theme } from '@emotion/react';

const TruncatedTextWithTooltip = ({
  children,
  tooltipText,
  ...props
}: PropsWithChildren<{
  tooltipText?: string;
}>) => {
  // Uses React.useState for testing purposes
  const [isTruncated, setIsTruncated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setIsTruncated(
      ref.current ? ref.current.scrollWidth > ref.current.clientWidth : false,
    );
  }, [children]);

  const div = (
    <div
      {...props}
      ref={ref}
      css={css`
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      `}
    >
      {children}
    </div>
  );

  return isTruncated ? (
    <Tooltip title={tooltipText || children}>{div}</Tooltip>
  ) : (
    div
  );
};

const SliceAddedBadgePlaceholder: FC<{
  placeholderRef: (element: HTMLDivElement) => void;
}> = ({ placeholderRef }) => (
  <div
    ref={placeholderRef}
    css={(theme: Theme) => css`
      /* Display styles */
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      color: ${theme.colorPrimaryText};
      font-size: ${theme.fontSizeXS}px;
      letter-spacing: 0.02em;
      padding: ${theme.sizeUnit / 2}px ${theme.sizeUnit * 2}px;
      margin-left: ${theme.sizeUnit * 4}px;
      pointer-events: none;

      visibility: hidden;
    `}
  >
    {t('Added')}
  </div>
);

const SliceAddedBadge: FC<{ placeholder?: HTMLDivElement }> = ({
  placeholder,
}) => (
  <div
    css={(theme: Theme) => css`
      /* Display styles */
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      color: ${theme.colorPrimaryText};
      font-size: ${theme.fontSizeXS}px;
      letter-spacing: 0.02em;
      padding: ${theme.sizeUnit / 2}px ${theme.sizeUnit * 2}px;
      margin-left: ${theme.sizeUnit * 4}px;
      pointer-events: none;

      /* Position styles */
      display: ${placeholder ? 'unset' : 'none'};
      position: absolute;
      top: ${placeholder ? `${placeholder.offsetTop}px` : 'unset'};
      left: ${placeholder ? `${placeholder.offsetLeft - 2}px` : 'unset'};
    `}
  >
    {t('Added')}
  </div>
);

const AddSliceCard: FC<{
  datasourceUrl?: string;
  datasourceName?: string;
  innerRef?:
    | RefObject<HTMLDivElement>
    | ((node: HTMLDivElement | null) => void);
  isSelected?: boolean;
  lastModified?: string;
  sliceName: string;
  style?: CSSProperties;
  visType: string;
}> = ({
  datasourceUrl,
  datasourceName = '-',
  innerRef,
  isSelected = false,
  lastModified,
  sliceName,
  style = {},
  visType,
}) => {
  const [sliceAddedBadge, setSliceAddedBadge] = useState<HTMLDivElement>();
  const { mountedPluginMetadata } = usePluginContext();
  const vizName = useMemo(
    () => mountedPluginMetadata[visType]?.name || t('Unknown type'),
    [mountedPluginMetadata, visType],
  );

  return (
    <div ref={innerRef} style={style}>
      <div
        data-test="chart-card"
        css={(theme: Theme) => css`
          border: 1px solid ${theme.colorBorder};
          border-radius: ${theme.borderRadius}px;
          padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
          margin: 0 ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px;
          position: relative;
          cursor: ${isSelected ? 'not-allowed' : 'move'};
          white-space: nowrap;
          overflow: hidden;
          line-height: 1.3;
          color: ${theme.colorText};

          &:hover {
            /* background: ${theme.colorFillTertiary}; */
          }

          opacity: ${isSelected ? 0.4 : 'unset'};
        `}
      >
        <div
          css={css`
            display: flex;
          `}
        >
          <Tooltip title={vizName}>
            <span
              data-test="viz-type-tile"
              css={(theme: Theme) => css`
                align-self: flex-start;
                margin-right: ${theme.sizeUnit * 3}px;
              `}
            >
              <VizTypeTile vizType={visType} size="m" title={vizName} />
            </span>
          </Tooltip>
          <div
            css={css`
              flex-grow: 1;
              min-width: 0;
            `}
          >
            <div
              data-test="card-title"
              css={(theme: Theme) => css`
                margin-bottom: 2px;
                font-weight: ${theme.fontWeightStrong};
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <TruncatedTextWithTooltip>{sliceName}</TruncatedTextWithTooltip>
              {isSelected ? (
                <SliceAddedBadgePlaceholder
                  placeholderRef={setSliceAddedBadge}
                />
              ) : null}
            </div>
            <div
              css={(theme: Theme) => css`
                display: flex;
                gap: ${theme.sizeUnit * 2}px;
                justify-content: space-between;
                font-size: ${theme.fontSizeSM}px;
                color: ${theme.colorTextSecondary};
              `}
            >
              <span
                css={css`
                  min-width: 0;
                `}
              >
                <TruncatedTextWithTooltip tooltipText={datasourceName}>
                  {datasourceUrl ? (
                    <GenericLink to={datasourceUrl}>
                      {datasourceName}
                    </GenericLink>
                  ) : (
                    datasourceName
                  )}
                </TruncatedTextWithTooltip>
              </span>
              <span
                css={css`
                  flex: none;
                `}
              >
                {lastModified}
              </span>
            </div>
          </div>
        </div>
      </div>
      <SliceAddedBadge placeholder={sliceAddedBadge} />
    </div>
  );
};

export default AddSliceCard;
