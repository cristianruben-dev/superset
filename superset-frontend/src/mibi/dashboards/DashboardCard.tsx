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
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { CertifiedBadge } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { DashboardPreview } from './DashboardPreview';
import type { PreviewRows } from './useDashboardPreviews';

const Card = styled.div`
  ${({ theme }) => css`
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    overflow: hidden;
    transition:
      border-color ${theme.motionDurationMid},
      box-shadow ${theme.motionDurationMid},
      transform ${theme.motionDurationMid};

    &:hover,
    &:focus-within {
      border-color: ${theme.colorPrimaryBorder};
      box-shadow: ${theme.boxShadow};
      transform: translateY(-2px);
    }

    &.selected {
      border-color: ${theme.colorPrimary};
      box-shadow: 0 0 0 2px ${theme.colorPrimaryBorder};
    }

    a,
    a:hover {
      color: inherit;
      text-decoration: none;
    }

    .preview {
      position: relative;
      display: block;
      height: 150px;
      background: linear-gradient(
        160deg,
        ${theme.colorBgLayout},
        ${theme.colorPrimaryBg}
      );
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top;
      }
    }

    .preview-inner {
      display: block;
      height: 100%;
      transition: opacity ${theme.motionDurationMid};
    }

    .empty-preview {
      position: absolute;
      inset: ${theme.sizeUnit * 3}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${theme.sizeUnit}px;
      border: 1.5px dashed ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;

      .anticon {
        font-size: 18px;
      }
    }

    .body {
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px
        ${theme.sizeUnit * 3.5}px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      margin-bottom: ${theme.sizeUnit}px;
    }

    .title {
      flex: 1;
      min-width: 0;
      font-weight: ${theme.fontWeightStrong};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      margin-right: -${theme.sizeUnit}px;
      color: ${theme.colorTextTertiary};

      .ant-btn {
        padding: 0 ${theme.sizeUnit}px;
        height: auto;
      }
    }

    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }

    .status {
      flex-shrink: 0;
      padding: 1px ${theme.sizeUnit * 2}px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      background: ${theme.colorFillSecondary};
      color: ${theme.colorTextSecondary};

      &.published {
        background: ${theme.colorSuccessBg};
        color: ${theme.colorSuccessText};
      }
    }
  `}
`;

const PlaceholderRows: PreviewRows = [
  [
    { width: 4, height: 30, kind: 'big_number' },
    { width: 4, height: 30, kind: 'big_number' },
    { width: 4, height: 30, kind: 'big_number' },
  ],
  [
    { width: 7, height: 50, kind: 'line' },
    { width: 5, height: 50, kind: 'bar' },
  ],
];

export interface DashboardCardProps {
  id: number;
  title: string;
  url: string;
  published: boolean;
  modified: string;
  /** Layout preview; undefined while it loads */
  preview?: PreviewRows;
  /** Screenshot of the dashboard, when thumbnails are enabled */
  thumbnailUrl?: string | null;
  /** Favorite star, menus... shown next to the title */
  actions?: ReactNode;
  selected?: boolean;
  certifiedBy?: string | null;
  certificationDetails?: string | null;
  /** Replaces navigation, e.g. to select the card in bulk mode */
  onSelect?: () => void;
}

/** The dashboard card used on the home page and in the dashboard list. */
export function DashboardCard({
  id,
  title,
  url,
  published,
  modified,
  preview,
  thumbnailUrl,
  actions,
  selected,
  certifiedBy,
  certificationDetails,
  onSelect,
}: DashboardCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const showThumbnail = !!thumbnailUrl && !thumbnailFailed;

  const previewContent = showThumbnail ? (
    <img
      src={thumbnailUrl!}
      alt=""
      loading="lazy"
      onError={() => setThumbnailFailed(true)}
    />
  ) : preview && preview.length === 0 ? (
    <span className="empty-preview">
      <Icons.PlusOutlined />
      {t('Empty dashboard')}
    </span>
  ) : (
    <DashboardPreview rows={preview || PlaceholderRows} seed={id} />
  );

  const linkProps = onSelect
    ? {
        to: url,
        onClick: (event: React.MouseEvent) => {
          event.preventDefault();
          onSelect();
        },
      }
    : { to: url };

  return (
    <Card
      className={selected ? 'selected' : undefined}
      data-test="mibi-dashboard-card"
    >
      <Link className="preview" tabIndex={-1} aria-hidden {...linkProps}>
        <span
          className="preview-inner"
          style={{ opacity: preview || showThumbnail ? 1 : 0.45 }}
        >
          {previewContent}
        </span>
      </Link>
      <div className="body">
        <div className="title-row">
          {certifiedBy && (
            <CertifiedBadge
              certifiedBy={certifiedBy}
              details={certificationDetails || undefined}
              size="m"
            />
          )}
          <Link className="title" {...linkProps} title={title}>
            {title}
          </Link>
          {actions && (
            <span
              className="card-actions"
              role="presentation"
              onClick={event => event.stopPropagation()}
            >
              {actions}
            </span>
          )}
        </div>
        <div className="meta">
          <span>{modified}</span>
          <span className={`status ${published ? 'published' : ''}`}>
            {published ? t('Published') : t('Draft')}
          </span>
        </div>
      </div>
    </Card>
  );
}
