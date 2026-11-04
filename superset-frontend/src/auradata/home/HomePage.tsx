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
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { Link, useHistory } from 'react-router-dom';
import rison from 'rison';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { Button, FaveStar, Skeleton } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useFavoriteStatus } from 'src/views/CRUD/hooks';
import { navigateTo } from 'src/utils/navigationUtils';
import { AURA_TONES, type AuraTone } from '../shell/brand';
import { CommandGroup, PageHeader } from '../shell/PageHeader';
import { usePageStatus } from '../shell/pageStatus';
import { relativeTime } from '../time';
import { DashboardCard, useDashboardPreviews } from '../dashboards';
import {
  fetchWorkspaces,
  WorkspaceAvatar,
  workspaceUrl,
  type Workspace,
} from '../workspaces';

export interface DashboardCardData {
  id: number;
  dashboard_title: string;
  url: string;
  published: boolean;
  changed_on_delta_humanized: string;
  thumbnail_url?: string | null;
}

type DashboardTab = 'recent' | 'favorite';

const PAGE_SIZE = 8;

const Page = styled.div`
  ${({ theme }) => css`
    width: 100%;
    padding: var(--mb-space-page-top) var(--mb-space-gutter)
      ${theme.sizeUnit * 8}px;
  `}
`;

const Actions = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 6}px;

    @media (max-width: 767px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `}
`;

const ActionCard = styled(Link)`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 5}px;
    border-radius: 20px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
    box-shadow: ${theme.boxShadow};
    /* The cards of auradata.mx: they lift slowly with a soft landing */
    transition:
      border-color 0.7s cubic-bezier(0.32, 0.72, 0, 1),
      box-shadow 0.7s cubic-bezier(0.32, 0.72, 0, 1),
      transform 0.7s cubic-bezier(0.32, 0.72, 0, 1);

    &:hover,
    &:focus-visible {
      color: ${theme.colorText};
      text-decoration: none;
      border-color: ${theme.colorPrimaryBorder};
      box-shadow: ${theme.boxShadowSecondary};
      transform: translateY(-4px);
    }

    &:hover .arrow {
      opacity: 1;
      transform: translateX(0);
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--tone-tint);
      color: var(--tone-color);
      font-size: 19px;
    }

    .text {
      flex: 1;
      min-width: 0;
    }

    .title {
      display: block;
      font-weight: ${theme.fontWeightStrong};
      margin-bottom: 2px;
    }

    .description {
      display: block;
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
      line-height: 1.45;
    }

    .arrow {
      align-self: center;
      color: ${theme.colorPrimary};
      opacity: 0;
      transform: translateX(-4px);
      transition:
        opacity ${theme.motionDurationMid},
        transform ${theme.motionDurationMid};
    }
  `}
`;

const Section = styled.section`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 6}px;
  `}
`;

const SectionHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 4}px;

    h2 {
      margin: 0;
      font-size: ${theme.fontSizeLG}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    .see-all {
      margin-left: auto;
      display: inline-flex;
      white-space: nowrap;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      color: ${theme.colorPrimary};
    }
  `}
`;

const Tabs = styled.div`
  ${({ theme }) => css`
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

      &[aria-selected='true'] {
        background: ${theme.colorBgContainer};
        color: ${theme.colorText};
        box-shadow: ${theme.boxShadowTertiary};
      }

      &:focus-visible {
        outline: 2px solid ${theme.colorPrimaryBorder};
      }
    }
  `}
`;

const Grid = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: ${theme.sizeUnit * 4}px;
  `}
`;

const WorkspaceStrip = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: ${theme.sizeUnit * 3}px;

    a {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadiusLG}px;
      border: 1px solid ${theme.colorBorderSecondary};
      background: ${theme.colorBgContainer};
      color: ${theme.colorText};
      transition:
        border-color ${theme.motionDurationMid},
        box-shadow ${theme.motionDurationMid},
        transform ${theme.motionDurationMid};

      &:hover {
        text-decoration: none;
        border-color: ${theme.colorPrimaryBorder};
        box-shadow: ${theme.boxShadowTertiary};
        transform: translateY(-1px);
      }
    }

    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .name {
      font-weight: ${theme.fontWeightStrong};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .count {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const EmptyCard = styled.div`
  ${({ theme }) => css`
    grid-column: 1 / -1;
    padding: ${theme.sizeUnit * 10}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px dashed ${theme.colorBorder};
    text-align: center;
    color: ${theme.colorTextSecondary};

    .anticon {
      font-size: 28px;
      color: ${theme.colorTextTertiary};
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    a {
      font-weight: 500;
    }
  `}
`;

export { relativeTime };

const NEW_DASHBOARD_URL = '/dashboard/new/';

/**
 * Creating a dashboard is a page of the server (its GET makes the dashboard and
 * redirects to it). The router would read `new` as a dashboard slug, so the
 * click leaves it and loads the page.
 */
const startDashboard = (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }
  event.preventDefault();
  navigateTo(NEW_DASHBOARD_URL, { assign: true });
};

/** Quick actions shown at the top of the home page. */
export function HomeBanner() {
  const actions = [
    {
      key: 'dashboard',
      tone: 'blue' as AuraTone,
      to: NEW_DASHBOARD_URL,
      onClick: startDashboard,
      icon: <Icons.DashboardOutlined />,
      title: t('New dashboard'),
      description: t('Start a report and add charts to it'),
    },
    // Data and SQL open from a dashboard, where the report is built
    {
      key: 'workspaces',
      tone: 'violet' as AuraTone,
      to: '/workspace/list/',
      icon: <Icons.AppstoreOutlined />,
      title: t('Workspaces'),
      description: t('Group dashboards and share them with your team'),
    },
  ];

  return (
    <Actions>
      {actions.map(action => (
        <ActionCard
          key={action.key}
          to={action.to}
          onClick={action.onClick}
          data-test="home-action"
          style={
            {
              '--tone-color': AURA_TONES[action.tone].color,
              '--tone-tint': AURA_TONES[action.tone].tint,
            } as CSSProperties
          }
        >
          <span className="icon">{action.icon}</span>
          <span className="text">
            <span className="title">{action.title}</span>
            <span className="description">{action.description}</span>
          </span>
          <Icons.ArrowRightOutlined className="arrow" />
        </ActionCard>
      ))}
    </Actions>
  );
}

const fetchDashboards = async (tab: DashboardTab) => {
  const filters =
    tab === 'favorite'
      ? [{ col: 'id', opr: 'dashboard_is_favorite', value: true }]
      : [];
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/dashboard/?q=${rison.encode({
      filters,
      order_column: 'changed_on_delta_humanized',
      order_direction: 'desc',
      page_size: PAGE_SIZE,
      columns: [
        'id',
        'dashboard_title',
        'url',
        'published',
        'changed_on_delta_humanized',
        'thumbnail_url',
      ],
    })}`,
  });
  return {
    dashboards: json.result as DashboardCardData[],
    count: json.count as number,
  };
};

/** Workspaces and the dashboard grid of the home page. */
export function HomeContent() {
  const [tab, setTab] = useState<DashboardTab>('recent');
  const [dashboards, setDashboards] = useState<DashboardCardData[] | null>(
    null,
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const history = useHistory();
  const [dashboardCount, setDashboardCount] = useState<number | null>(null);
  const dashboardIds = useMemo(
    () => (dashboards || []).map(dashboard => dashboard.id),
    [dashboards],
  );
  const previews = useDashboardPreviews(dashboardIds);
  const { addDangerToast } = useToasts();
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'dashboard',
    dashboardIds,
    addDangerToast,
  );

  useEffect(() => {
    fetchWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, []);

  useEffect(() => {
    setDashboards(null);
    fetchDashboards(tab)
      .then(({ dashboards: result, count }) => {
        setDashboards(result);
        if (tab === 'recent') setDashboardCount(count);
      })
      .catch(() => setDashboards([]));
  }, [tab]);

  const tabs: { key: DashboardTab; label: string }[] = [
    { key: 'recent', label: t('Recently edited') },
    { key: 'favorite', label: t('Favorites') },
  ];

  const startingOut =
    tab === 'recent' && dashboards?.length === 0 && !workspaces.length;

  const figures = [
    dashboardCount !== null &&
      tn('%s dashboard', '%s dashboards', dashboardCount, dashboardCount),
    workspaces.length > 0 &&
      tn('%s workspace', '%s workspaces', workspaces.length, workspaces.length),
  ].filter(Boolean);
  usePageStatus(figures);

  return (
    <>
      <PageHeader title={t('Home')} meta={figures.join(' · ') || undefined}>
        <CommandGroup label={t('Create')}>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            icon={<Icons.AppstoreOutlined />}
            onClick={() => history.push('/workspace/list/?new=true')}
          >
            {t('New workspace')}
          </Button>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            icon={<Icons.PlusOutlined />}
            onClick={() => navigateTo(NEW_DASHBOARD_URL, { assign: true })}
          >
            {t('New dashboard')}
          </Button>
        </CommandGroup>
      </PageHeader>
      <Page>
        {startingOut && <HomeBanner />}
        {workspaces.length > 0 && (
          <Section>
            <SectionHeader>
              <h2>{t('Workspaces')}</h2>
              <Link className="see-all" to="/workspace/list/">
                {t('See all')}
                <Icons.ArrowRightOutlined iconSize="s" />
              </Link>
            </SectionHeader>
            <WorkspaceStrip>
              {workspaces.slice(0, 8).map(workspace => (
                <Link key={workspace.id} to={workspaceUrl(workspace.id)}>
                  <WorkspaceAvatar workspace={workspace} size="m" />
                  <span className="text">
                    <span className="name">{workspace.name}</span>
                    <span className="count">
                      {tn(
                        '%s dashboard',
                        '%s dashboards',
                        workspace.dashboard_count,
                        workspace.dashboard_count,
                      )}
                    </span>
                  </span>
                </Link>
              ))}
            </WorkspaceStrip>
          </Section>
        )}
        <Section>
          <SectionHeader>
            <h2>{t('Dashboards')}</h2>
            <Tabs role="tablist">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </Tabs>
            <Link className="see-all" to="/dashboard/list/">
              {t('See all')}
              <Icons.ArrowRightOutlined iconSize="s" />
            </Link>
          </SectionHeader>
          <Grid>
            {dashboards === null &&
              Array.from({ length: 4 }, (_, index) => (
                <Skeleton.Node
                  key={index}
                  active
                  css={css`
                    width: 100% !important;
                    height: 222px !important;
                    border-radius: 12px;
                  `}
                />
              ))}
            {dashboards?.length === 0 && (
              <EmptyCard>
                <Icons.DashboardOutlined />
                <div>
                  {tab === 'favorite'
                    ? t('Mark dashboards with a star to find them here.')
                    : t('There are no dashboards yet.')}
                </div>
                {tab === 'recent' && (
                  <Link to={NEW_DASHBOARD_URL} onClick={startDashboard}>
                    {t('Create your first dashboard')}
                  </Link>
                )}
              </EmptyCard>
            )}
            {dashboards?.map(dashboard => (
              <DashboardCard
                key={dashboard.id}
                id={dashboard.id}
                title={dashboard.dashboard_title}
                url={dashboard.url}
                published={dashboard.published}
                modified={t(
                  'Modified %s',
                  dashboard.changed_on_delta_humanized,
                )}
                preview={previews[dashboard.id]}
                thumbnailUrl={
                  isFeatureEnabled(FeatureFlag.Thumbnails)
                    ? dashboard.thumbnail_url
                    : null
                }
                actions={
                  <FaveStar
                    itemId={dashboard.id}
                    saveFaveStar={saveFavoriteStatus}
                    isStarred={!!favoriteStatus[dashboard.id]}
                  />
                }
              />
            ))}
          </Grid>
        </Section>
      </Page>
    </>
  );
}
