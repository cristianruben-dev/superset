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
import { Link } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Skeleton, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { datasetUrl } from '../data/api';
import type { WorkspaceDataset } from './api';

const List = styled.div`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    overflow: hidden;

    .row {
      display: grid;
      grid-template-columns:
        minmax(200px, 2fr) minmax(120px, 1fr) minmax(110px, 0.8fr)
        40px;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;

      & + .row {
        border-top: 1px solid ${theme.colorBorderSecondary};
      }
    }

    .dataset {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      min-width: 0;
      color: ${theme.colorText};
      font-weight: 600;

      &:hover {
        color: ${theme.colorPrimary};
        text-decoration: none;
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .cell {
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty {
      padding: ${theme.sizeUnit * 6}px;
      text-align: center;
      color: ${theme.colorTextSecondary};
    }

    @media (max-width: 767px) {
      .row {
        grid-template-columns: minmax(0, 1fr) 40px;
      }

      .cell {
        display: none;
      }
    }
  `}
`;

interface WorkspaceDatasetsProps {
  datasets: WorkspaceDataset[] | null;
  /** Contributors take datasets out of the workspace, which shares them */
  canContribute: boolean;
  onShare: (dataset: WorkspaceDataset) => void;
}

/**
 * The datasets of a workspace, like the semantic models of a Power BI workspace.
 * They are created from the "Data" menu of its dashboards.
 */
export function WorkspaceDatasets({
  datasets,
  canContribute,
  onShare,
}: WorkspaceDatasetsProps) {
  if (datasets === null) {
    return (
      <Skeleton.Node
        active
        css={css`
          width: 100% !important;
          height: 120px !important;
          border-radius: 12px;
        `}
      />
    );
  }
  return (
    <List data-test="workspace-datasets">
      {!datasets.length && (
        <div className="empty">
          {t(
            'Datasets created from the "Data" menu of its dashboards show up here.',
          )}
        </div>
      )}
      {datasets.map(dataset => (
        <div className="row" key={dataset.id} data-test="workspace-dataset">
          <Link className="dataset" to={datasetUrl(dataset.id)}>
            {dataset.kind === 'virtual' ? (
              <Icons.ConsoleSqlOutlined iconSize="m" />
            ) : (
              <Icons.TableOutlined iconSize="m" />
            )}
            <span>{dataset.table_name}</span>
          </Link>
          <span className="cell">
            {[dataset.database_name, dataset.schema]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="cell">{dataset.changed_on_delta_humanized}</span>
          {canContribute ? (
            <Tooltip title={t('Share with every workspace')}>
              <Button
                buttonStyle="link"
                buttonSize="xsmall"
                aria-label={t('Share with every workspace')}
                onClick={() => onShare(dataset)}
              >
                <Icons.ShareAltOutlined iconSize="m" />
              </Button>
            </Tooltip>
          ) : (
            <span />
          )}
        </div>
      ))}
    </List>
  );
}
