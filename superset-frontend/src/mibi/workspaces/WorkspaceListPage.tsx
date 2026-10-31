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
import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Input, Skeleton } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { fetchWorkspaces, workspaceUrl, type Workspace } from './api';
import { WorkspaceCard } from './WorkspaceCard';
import { WorkspaceModal } from './WorkspaceModal';

export const Page = styled.div`
  ${({ theme }) => css`
    width: 100%;
    max-width: 1320px;
    margin: 0 auto;
    padding: ${theme.sizeUnit * 8}px ${theme.sizeUnit * 10}px
      ${theme.sizeUnit * 12}px;
  `}
`;

const Header = styled.header`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 6}px;

    .titles {
      flex: 1;
      min-width: min(260px, 100%);
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
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
    }

    .search {
      width: 240px;
    }
  `}
`;

export const Grid = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    gap: ${theme.sizeUnit * 4}px;
  `}
`;

const NewCard = styled.button`
  ${({ theme }) => css`
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit * 2}px;
    min-height: 228px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1.5px dashed ${theme.colorBorder};
    color: ${theme.colorTextSecondary};
    font-weight: 500;
    text-align: center;
    cursor: pointer;
    transition:
      border-color ${theme.motionDurationMid},
      color ${theme.motionDurationMid},
      background ${theme.motionDurationMid};

    .plus {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};
      font-size: 18px;
    }

    small {
      max-width: 200px;
      font-weight: 400;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }

    &:hover,
    &:focus-visible {
      border-color: ${theme.colorPrimary};
      color: ${theme.colorPrimary};
      background: ${theme.colorPrimaryBg};
    }
  `}
`;

const Empty = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 16}px ${theme.sizeUnit * 6}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    text-align: center;

    .art {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      margin-bottom: ${theme.sizeUnit * 2}px;

      span {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: ${theme.colorPrimaryBg};
        border: 1px solid ${theme.colorPrimaryBorder};
      }

      span:nth-of-type(2) {
        transform: translateY(-8px);
        background: ${theme.colorPrimary};
        border-color: ${theme.colorPrimary};
      }
    }

    h2 {
      margin: 0;
      font-size: ${theme.fontSizeXL}px;
      font-weight: ${theme.fontWeightStrong};
    }

    p {
      max-width: 440px;
      margin: 0;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

/** All the workspaces, as cards. */
export default function WorkspaceListPage() {
  const history = useHistory();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (workspaces || []).filter(
      ws =>
        !query ||
        ws.name.toLowerCase().includes(query) ||
        (ws.description || '').toLowerCase().includes(query),
    );
  }, [workspaces, search]);

  const modal = (
    <WorkspaceModal
      show={creating}
      onHide={() => setCreating(false)}
      onSaved={workspace => {
        setCreating(false);
        history.push(workspaceUrl(workspace.id));
      }}
    />
  );

  return (
    <Page data-test="workspace-list">
      <Header>
        <div className="titles">
          <h1>{t('Workspaces')}</h1>
          <p>{t('Group your dashboards by team, area or project.')}</p>
        </div>
        {!!workspaces?.length && (
          <div className="tools">
            <Input
              className="search"
              allowClear
              prefix={<Icons.SearchOutlined iconSize="m" />}
              placeholder={t('Search workspaces')}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <Button
              buttonStyle="primary"
              icon={<Icons.PlusOutlined />}
              onClick={() => setCreating(true)}
            >
              {t('New workspace')}
            </Button>
          </div>
        )}
      </Header>

      {workspaces === null && (
        <Grid>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton.Node
              key={index}
              active
              css={css`
                width: 100% !important;
                height: 228px !important;
                border-radius: 12px;
              `}
            />
          ))}
        </Grid>
      )}

      {workspaces?.length === 0 && (
        <Empty>
          <div className="art" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <h2>{t('Create your first workspace')}</h2>
          <p>
            {t(
              'A workspace keeps the dashboards of a team or project together, with its own name, picture and description.',
            )}
          </p>
          <Button
            buttonStyle="primary"
            icon={<Icons.PlusOutlined />}
            onClick={() => setCreating(true)}
          >
            {t('New workspace')}
          </Button>
        </Empty>
      )}

      {!!workspaces?.length && (
        <Grid>
          {visible.map(workspace => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
          {!search && (
            <NewCard type="button" onClick={() => setCreating(true)}>
              <span className="plus">
                <Icons.PlusOutlined />
              </span>
              {t('New workspace')}
              <small>{t('For a team, an area or a project')}</small>
            </NewCard>
          )}
        </Grid>
      )}
      {modal}
    </Page>
  );
}
