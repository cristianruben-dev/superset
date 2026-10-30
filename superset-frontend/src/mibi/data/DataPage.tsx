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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useHistory } from 'react-router-dom';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  Button,
  Dropdown,
  Input,
  Skeleton,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { DatasourceModal } from 'src/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import DatabaseModal from 'src/features/databases/DatabaseModal';
import UploadDataModal from 'src/features/databases/UploadDataModel';
import type { DatasetObject } from 'src/features/datasets/types';
import type { ExtensionConfigs } from 'src/features/home/types';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { findPermission } from 'src/utils/findPermission';
import { uploadUserPerms } from 'src/views/CRUD/utils';
import tinycolor from 'tinycolor2';
import { WORKSPACE_COLORS } from '../workspaces/api';
import { Page } from '../workspaces/WorkspaceListPage';
import {
  datasetUrl,
  fetchConnections,
  fetchDataSets,
  fetchEditableDataset,
  type DataConnection,
  type DataSet,
} from './api';

type Kind = 'all' | 'physical' | 'virtual';
type Upload = 'csv' | 'excel' | 'columnar';

const Header = styled.header`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 8}px;

    .titles {
      flex: 1;
      min-width: 260px;
    }

    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.024em;
      line-height: 1.2;
      color: ${theme.colorText};
    }

    p {
      margin: ${theme.sizeUnit * 1.5}px 0 0;
      color: ${theme.colorTextSecondary};
    }

    .tools {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const SectionHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 3}px;
    margin-bottom: ${theme.sizeUnit * 4}px;

    h2 {
      margin: 0;
      font-size: ${theme.fontSizeLG}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    .count {
      padding: 0 ${theme.sizeUnit * 2}px;
      border-radius: 999px;
      background: ${theme.colorFillSecondary};
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      line-height: 20px;
    }

    .spacer {
      flex: 1;
    }

    .list-link {
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
    }
  `}
`;

const Connections = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: ${theme.sizeUnit * 3}px;
    margin-bottom: ${theme.sizeUnit * 10}px;
  `}
`;

const ConnectionCard = styled.div`
  ${({ theme }) => css`
    position: relative;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    cursor: pointer;
    transition:
      border-color ${theme.motionDurationMid},
      box-shadow ${theme.motionDurationMid},
      transform ${theme.motionDurationMid};

    &:hover {
      border-color: ${theme.colorPrimaryBorder};
      box-shadow: ${theme.boxShadowTertiary};
      transform: translateY(-1px);
    }

    &[aria-pressed='true'] {
      border-color: ${theme.colorPrimary};
      box-shadow: 0 0 0 3px ${theme.colorPrimaryBg};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
    }

    .top {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
    }

    .engine {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      color: ${theme.colorTextLightSolid};
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .name {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;

      strong {
        font-weight: ${theme.fontWeightStrong};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      span {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
      }
    }

    .menu {
      color: ${theme.colorTextTertiary};
    }

    .facts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};

      .datasets {
        font-weight: 500;
        color: ${theme.colorText};
      }

      .chip {
        padding: 0 ${theme.sizeUnit * 2}px;
        border-radius: 999px;
        background: ${theme.colorFillTertiary};
        line-height: 20px;
      }
    }
  `}
`;

const NewConnection = styled.button`
  ${({ theme }) => css`
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit * 2}px;
    min-height: 112px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1.5px dashed ${theme.colorBorder};
    color: ${theme.colorTextSecondary};
    font-weight: 500;
    cursor: pointer;
    transition:
      border-color ${theme.motionDurationMid},
      color ${theme.motionDurationMid};

    &:hover,
    &:focus-visible {
      border-color: ${theme.colorPrimary};
      color: ${theme.colorPrimary};
    }
  `}
`;

const Toolbar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;

    .search {
      width: 240px;
    }

    .kinds {
      display: inline-flex;
      padding: 3px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorFillSecondary};

      button {
        all: unset;
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 3}px;
        border-radius: ${theme.borderRadiusSM}px;
        font-size: ${theme.fontSizeSM}px;
        font-weight: 500;
        color: ${theme.colorTextSecondary};
        cursor: pointer;

        &[aria-pressed='true'] {
          background: ${theme.colorBgContainer};
          color: ${theme.colorText};
          box-shadow: ${theme.boxShadowTertiary};
        }
      }
    }

    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      padding: 0 ${theme.sizeUnit}px 0 ${theme.sizeUnit * 2.5}px;
      border-radius: 999px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      line-height: 24px;

      button {
        all: unset;
        display: inline-flex;
        padding: 2px;
        cursor: pointer;
      }
    }
  `}
`;

const Table = styled.div`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    overflow: hidden;

    .row {
      display: grid;
      grid-template-columns:
        minmax(240px, 2.2fr) minmax(140px, 1fr) minmax(110px, 0.8fr)
        minmax(130px, 0.9fr) 84px;
      align-items: center;
      gap: ${theme.sizeUnit * 4}px;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;

      & + .row {
        border-top: 1px solid ${theme.colorBorderSecondary};
      }
    }

    .row.head {
      padding-top: ${theme.sizeUnit * 2.5}px;
      padding-bottom: ${theme.sizeUnit * 2.5}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      color: ${theme.colorTextTertiary};
      background: ${theme.colorFillQuaternary};
    }

    .row:not(.head):hover {
      background: ${theme.colorFillQuaternary};

      .row-actions {
        opacity: 1;
      }
    }

    .dataset {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      min-width: 0;
      color: ${theme.colorText};

      &:hover {
        text-decoration: none;

        strong {
          color: ${theme.colorPrimary};
        }
      }
    }

    .kind {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};

      &.virtual {
        background: ${theme.colorWarningBg};
        color: ${theme.colorWarningText};
      }
    }

    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;

      strong {
        font-weight: ${theme.fontWeightStrong};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color ${theme.motionDurationFast};
      }

      span {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .cell {
      min-width: 0;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-actions {
      display: flex;
      justify-content: flex-end;
      gap: ${theme.sizeUnit}px;
      opacity: 0;
      transition: opacity ${theme.motionDurationFast};

      @media (hover: none) {
        opacity: 1;
      }
    }

    .row-actions:focus-within {
      opacity: 1;
    }

    .empty {
      padding: ${theme.sizeUnit * 12}px ${theme.sizeUnit * 6}px;
      text-align: center;
      color: ${theme.colorTextSecondary};

      strong {
        display: block;
        margin-bottom: ${theme.sizeUnit}px;
        color: ${theme.colorText};
        font-size: ${theme.fontSizeLG}px;
      }
    }
  `}
`;

/** A stable color per engine, from the workspace palette. */
const engineColor = (backend: string) => {
  const sum = [...backend].reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  const base = tinycolor(WORKSPACE_COLORS[sum % WORKSPACE_COLORS.length]);
  return `linear-gradient(135deg, ${base.clone().lighten(6).toHexString()}, ${base
    .clone()
    .darken(10)
    .toHexString()})`;
};

const engineInitials = (backend: string) =>
  backend
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase() || 'DB';

/** Connections, datasets and file uploads in one place. */
export default function DataPage() {
  const history = useHistory();
  const { addDangerToast } = useToasts();
  const user = useSelector<
    { user: UserWithPermissionsAndRoles },
    UserWithPermissionsAndRoles
  >(state => state.user);
  const conf = useSelector<
    { common: { conf: ExtensionConfigs } },
    ExtensionConfigs
  >(state => state.common.conf);
  const [connections, setConnections] = useState<DataConnection[] | null>(null);
  const [datasets, setDatasets] = useState<DataSet[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>('all');
  const [search, setSearch] = useState('');
  const [connectionModal, setConnectionModal] = useState<{
    open: boolean;
    id?: number;
  }>({ open: false });
  const [upload, setUpload] = useState<Upload | null>(null);
  const [editing, setEditing] = useState<DatasetObject | null>(null);

  const roles = user?.roles || {};
  const isAdmin = isUserAdmin(user);
  const canConnect = findPermission('can_write', 'Database', roles);
  const canAddDataset = findPermission('can_write', 'Dataset', roles);
  const uploads = uploadUserPerms(
    roles,
    conf?.CSV_EXTENSIONS || [],
    conf?.COLUMNAR_EXTENSIONS || [],
    conf?.EXCEL_EXTENSIONS || [],
    conf?.ALLOWED_EXTENSIONS || [],
  );
  const uploadsOn =
    isAdmin || !!connections?.some(connection => connection.allow_file_upload);

  const load = useCallback(() => {
    fetchConnections()
      .then(setConnections)
      .catch(() => setConnections([]));
    fetchDataSets()
      .then(setDatasets)
      .catch(() => setDatasets([]));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    (datasets || []).forEach(dataset =>
      map.set(dataset.database.id, (map.get(dataset.database.id) || 0) + 1),
    );
    return map;
  }, [datasets]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (datasets || []).filter(
      dataset =>
        (selected === null || dataset.database.id === selected) &&
        (kind === 'all' || dataset.kind === kind) &&
        (!query ||
          dataset.table_name.toLowerCase().includes(query) ||
          (dataset.schema || '').toLowerCase().includes(query) ||
          (dataset.description || '').toLowerCase().includes(query)),
    );
  }, [datasets, selected, kind, search]);

  const selectedConnection = connections?.find(c => c.id === selected);

  const editDataset = (id: number) =>
    fetchEditableDataset(id)
      .then(setEditing)
      .catch(() => addDangerToast(t('The dataset could not be loaded')));

  const connectItems = [
    canConnect && {
      key: 'database',
      icon: <Icons.DatabaseOutlined />,
      label: t('Connect a database'),
      onClick: () => setConnectionModal({ open: true }),
    },
    uploadsOn &&
      uploads.canUploadData && { type: 'divider' as const, key: 'divider' },
    uploadsOn &&
      uploads.canUploadCSV && {
        key: 'csv',
        icon: <Icons.UploadOutlined />,
        label: t('Upload CSV'),
        onClick: () => setUpload('csv'),
      },
    uploadsOn &&
      uploads.canUploadExcel && {
        key: 'excel',
        icon: <Icons.UploadOutlined />,
        label: t('Upload Excel'),
        onClick: () => setUpload('excel'),
      },
    uploadsOn &&
      uploads.canUploadColumnar && {
        key: 'columnar',
        icon: <Icons.UploadOutlined />,
        label: t('Upload columnar file'),
        onClick: () => setUpload('columnar'),
      },
  ].filter(Boolean) as { key: string }[];

  return (
    <Page data-test="data-page">
      <Header>
        <div className="titles">
          <h1>{t('Data')}</h1>
          <p>
            {t('Your connections and the datasets your charts are built on.')}
          </p>
        </div>
        <div className="tools">
          {canAddDataset && (
            <Button
              buttonStyle="secondary"
              icon={<Icons.TableOutlined />}
              onClick={() => history.push('/dataset/add/')}
            >
              {t('New dataset')}
            </Button>
          )}
          {connectItems.length > 0 && (
            <Dropdown menu={{ items: connectItems }} trigger={['click']}>
              <Button buttonStyle="primary" icon={<Icons.PlusOutlined />}>
                {t('Connect data')}
              </Button>
            </Dropdown>
          )}
        </div>
      </Header>

      <SectionHeader>
        <h2>{t('Connections')}</h2>
        {!!connections?.length && (
          <span className="count">{connections.length}</span>
        )}
        <span className="spacer" />
        <Link className="list-link" to="/databaseview/list/">
          {t('Open as a list')}
        </Link>
      </SectionHeader>
      <Connections>
        {connections === null &&
          Array.from({ length: 3 }, (_, index) => (
            <Skeleton.Node
              key={index}
              active
              css={css`
                width: 100% !important;
                height: 112px !important;
                border-radius: 12px;
              `}
            />
          ))}
        {connections?.map(connection => {
          const pressed = selected === connection.id;
          return (
            <ConnectionCard
              key={connection.id}
              role="button"
              tabIndex={0}
              aria-pressed={pressed}
              data-test="data-connection"
              onClick={() => setSelected(pressed ? null : connection.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelected(pressed ? null : connection.id);
                }
              }}
            >
              <div className="top">
                <span
                  className="engine"
                  style={{ background: engineColor(connection.backend) }}
                  aria-hidden
                >
                  {engineInitials(connection.backend)}
                </span>
                <span className="name">
                  <strong title={connection.database_name}>
                    {connection.database_name}
                  </strong>
                  <span>{connection.backend}</span>
                </span>
                {canConnect && (
                  <Tooltip title={t('Edit connection')}>
                    <Button
                      buttonStyle="link"
                      buttonSize="xsmall"
                      className="menu"
                      aria-label={t('Edit connection')}
                      onClick={event => {
                        event.stopPropagation();
                        setConnectionModal({ open: true, id: connection.id });
                      }}
                    >
                      <Icons.SettingOutlined iconSize="m" />
                    </Button>
                  </Tooltip>
                )}
              </div>
              <div className="facts">
                <span className="datasets">
                  {tn(
                    '%s dataset',
                    '%s datasets',
                    counts.get(connection.id) || 0,
                    counts.get(connection.id) || 0,
                  )}
                </span>
                {connection.expose_in_sqllab && (
                  <span className="chip">{t('SQL Lab')}</span>
                )}
                {connection.allow_file_upload && (
                  <span className="chip">{t('Uploads')}</span>
                )}
              </div>
            </ConnectionCard>
          );
        })}
        {canConnect && connections !== null && (
          <NewConnection
            type="button"
            onClick={() => setConnectionModal({ open: true })}
          >
            <Icons.PlusOutlined />
            {t('Connect a database')}
          </NewConnection>
        )}
      </Connections>

      <SectionHeader>
        <h2>{t('Datasets')}</h2>
        {datasets !== null && <span className="count">{visible.length}</span>}
        <Toolbar>
          {selectedConnection && (
            <span className="filter-chip">
              {selectedConnection.database_name}
              <button
                type="button"
                aria-label={t('Show all connections')}
                onClick={() => setSelected(null)}
              >
                <Icons.CloseOutlined iconSize="s" />
              </button>
            </span>
          )}
        </Toolbar>
        <span className="spacer" />
        <Toolbar>
          <div className="kinds" role="group" aria-label={t('Dataset type')}>
            {(
              [
                ['all', t('All')],
                ['physical', t('Tables')],
                ['virtual', t('SQL queries')],
              ] as [Kind, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={kind === key}
                onClick={() => setKind(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            className="search"
            allowClear
            prefix={<Icons.SearchOutlined iconSize="m" />}
            placeholder={t('Search datasets')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </Toolbar>
      </SectionHeader>
      <Table data-test="data-datasets">
        <div className="row head" aria-hidden>
          <span>{t('Dataset')}</span>
          <span>{t('Connection')}</span>
          <span>{t('Schema')}</span>
          <span>{t('Modified')}</span>
          <span />
        </div>
        {datasets === null && (
          <div className="row">
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          </div>
        )}
        {datasets !== null && visible.length === 0 && (
          <div className="empty">
            <strong>
              {datasets.length
                ? t('No datasets match')
                : t('There are no datasets yet')}
            </strong>
            {datasets.length
              ? t('Try another search or connection.')
              : t(
                  'Connect a database or upload a file, then create a dataset from one of its tables.',
                )}
          </div>
        )}
        {visible.map(dataset => (
          <div className="row" key={dataset.id} data-test="data-dataset">
            <Link className="dataset" to={datasetUrl(dataset.id)}>
              <span className={`kind ${dataset.kind}`} aria-hidden>
                {dataset.kind === 'virtual' ? (
                  <Icons.ConsoleSqlOutlined iconSize="m" />
                ) : (
                  <Icons.TableOutlined iconSize="m" />
                )}
              </span>
              <span className="text">
                <strong>{dataset.table_name}</strong>
                <span>
                  {dataset.description ||
                    (dataset.kind === 'virtual' ? t('SQL query') : t('Table'))}
                </span>
              </span>
            </Link>
            <span className="cell">{dataset.database.database_name}</span>
            <span className="cell">{dataset.schema || '—'}</span>
            <span className="cell">{dataset.changed_on_delta_humanized}</span>
            <span className="row-actions">
              {canAddDataset && (
                <Tooltip title={t('Edit dataset')}>
                  <Button
                    buttonStyle="link"
                    buttonSize="xsmall"
                    aria-label={t('Edit dataset')}
                    onClick={() => editDataset(dataset.id)}
                  >
                    <Icons.EditOutlined iconSize="m" />
                  </Button>
                </Tooltip>
              )}
              <Tooltip title={t('Open')}>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  aria-label={t('Open')}
                  onClick={() => history.push(datasetUrl(dataset.id))}
                >
                  <Icons.ArrowRightOutlined iconSize="m" />
                </Button>
              </Tooltip>
            </span>
          </div>
        ))}
      </Table>

      <DatabaseModal
        show={connectionModal.open}
        databaseId={connectionModal.id}
        dbEngine={undefined}
        onHide={() => setConnectionModal({ open: false })}
        onDatabaseAdd={load}
      />
      {(['csv', 'excel', 'columnar'] as Upload[]).map(type => (
        <UploadDataModal
          key={type}
          type={type}
          show={upload === type}
          onHide={() => {
            setUpload(null);
            load();
          }}
          allowedExtensions={
            {
              csv: conf?.CSV_EXTENSIONS,
              excel: conf?.EXCEL_EXTENSIONS,
              columnar: conf?.COLUMNAR_EXTENSIONS,
            }[type] || []
          }
        />
      ))}
      {editing && (
        <DatasourceModal
          datasource={editing}
          show
          onHide={() => setEditing(null)}
          onDatasourceSave={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </Page>
  );
}
