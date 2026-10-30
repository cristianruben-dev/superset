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
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import rison from 'rison';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Skeleton } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import getBootstrapData from 'src/utils/getBootstrapData';

export interface DashboardCardData {
  id: number;
  dashboard_title: string;
  url: string;
  published: boolean;
  changed_on_delta_humanized: string;
}

export interface RecentItem {
  item_type: string | null;
  item_url: string | null;
  item_title: string | null;
  time: number;
}

type DashboardTab = 'recent' | 'favorite';

const PAGE_SIZE = 8;

const Page = styled.div`
  ${({ theme }) => css`
    width: 100%;
    max-width: 1320px;
    margin: 0 auto;
    padding: ${theme.sizeUnit * 8}px ${theme.sizeUnit * 10}px
      ${theme.sizeUnit * 12}px;
  `}
`;

const Hero = styled.header`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 7}px;

    h1 {
      margin: 0;
      font-size: 28px;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.02em;
      color: ${theme.colorText};
    }

    p {
      margin: ${theme.sizeUnit}px 0 0;
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSize}px;
    }
  `}
`;

const Actions = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 10}px;
  `}
`;

const ActionCard = styled(Link)`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
    transition:
      border-color ${theme.motionDurationMid},
      box-shadow ${theme.motionDurationMid},
      transform ${theme.motionDurationMid};

    &:hover,
    &:focus-visible {
      color: ${theme.colorText};
      text-decoration: none;
      border-color: ${theme.colorPrimaryBorder};
      box-shadow: ${theme.boxShadow};
      transform: translateY(-1px);
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
      width: 38px;
      height: 38px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimary};
      font-size: 18px;
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
    margin-bottom: ${theme.sizeUnit * 10}px;
  `}
`;

const SectionHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 4}px;
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

const DashboardCard = styled(Link)`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    border-radius: ${theme.borderRadiusLG}px;
    border: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
    overflow: hidden;
    transition:
      border-color ${theme.motionDurationMid},
      box-shadow ${theme.motionDurationMid},
      transform ${theme.motionDurationMid};

    &:hover,
    &:focus-visible {
      color: ${theme.colorText};
      text-decoration: none;
      border-color: ${theme.colorPrimaryBorder};
      box-shadow: ${theme.boxShadow};
      transform: translateY(-2px);
    }

    .preview {
      position: relative;
      height: 96px;
      background: linear-gradient(
        135deg,
        ${theme.colorPrimaryBg},
        ${theme.colorFillSecondary}
      );
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      display: flex;
      align-items: flex-end;
      gap: 6px;
      padding: 0 ${theme.sizeUnit * 5}px ${theme.sizeUnit * 4}px;

      span {
        width: 14px;
        border-radius: 4px 4px 2px 2px;
        background: ${theme.colorPrimary};
      }
    }

    .body {
      padding: ${theme.sizeUnit * 3.5}px ${theme.sizeUnit * 4}px
        ${theme.sizeUnit * 4}px;
    }

    .title {
      display: block;
      font-weight: ${theme.fontWeightStrong};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: ${theme.sizeUnit * 1.5}px;
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

const RecentList = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 2}px;

    a {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      max-width: 320px;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
      border-radius: 999px;
      border: 1px solid ${theme.colorBorderSecondary};
      background: ${theme.colorBgContainer};
      color: ${theme.colorText};
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;

      &:hover {
        text-decoration: none;
        border-color: ${theme.colorPrimaryBorder};
        color: ${theme.colorPrimary};
      }

      .anticon {
        color: ${theme.colorPrimary};
      }

      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .when {
        color: ${theme.colorTextTertiary};
        font-weight: 400;
        white-space: nowrap;
      }
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

/** Bar heights of the card preview, varied per dashboard so cards differ. */
const previewBars = (id: number) =>
  [0, 1, 2, 3, 4].map(index => 18 + ((id * 37 + index * 23) % 44));

const locale = () => getBootstrapData().common?.locale || 'en';

/** "hace 5 minutos" style text for an epoch in milliseconds. */
export function relativeTime(epochMs: number, now = Date.now()): string {
  const seconds = Math.round((epochMs - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const [unit, size] = units.find(([, size]) => Math.abs(seconds) >= size) || [
    'second',
    1,
  ];
  return format.format(Math.round(seconds / size), unit);
}

export function greeting(hour = new Date().getHours()): string {
  if (hour < 12) {
    return t('Good morning');
  }
  if (hour < 20) {
    return t('Good afternoon');
  }
  return t('Good evening');
}

/** Greeting and quick actions shown at the top of the home page. */
export function HomeBanner() {
  const { user } = getBootstrapData();
  const name = user?.firstName || user?.username || '';
  const today = new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const actions = [
    {
      key: 'dashboard',
      to: '/dashboard/new/',
      icon: <Icons.DashboardOutlined />,
      title: t('New dashboard'),
      description: t('Start a report and add charts to it'),
    },
    {
      key: 'database',
      to: '/databaseview/list/',
      icon: <Icons.DatabaseOutlined />,
      title: t('Connect data'),
      description: t('Add a database or upload a file'),
    },
    {
      key: 'dataset',
      to: '/tablemodelview/list/',
      icon: <Icons.TableOutlined />,
      title: t('Datasets'),
      description: t('Prepare the tables your charts use'),
    },
    {
      key: 'sql',
      to: '/sqllab/?new=true',
      icon: <Icons.ConsoleSqlOutlined />,
      title: t('Explore with SQL'),
      description: t('Query your data directly in SQL Lab'),
    },
  ];

  return (
    <Page
      css={css`
        padding-bottom: 0 !important;
      `}
    >
      <Hero>
        <h1>{name ? `${greeting()}, ${name}` : greeting()}</h1>
        <p>{today.charAt(0).toUpperCase() + today.slice(1)}</p>
      </Hero>
      <Actions>
        {actions.map(action => (
          <ActionCard key={action.key} to={action.to} data-test="home-action">
            <span className="icon">{action.icon}</span>
            <span className="text">
              <span className="title">{action.title}</span>
              <span className="description">{action.description}</span>
            </span>
            <Icons.ArrowRightOutlined className="arrow" />
          </ActionCard>
        ))}
      </Actions>
    </Page>
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
      ],
    })}`,
  });
  return json.result as DashboardCardData[];
};

const fetchRecents = async () => {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/log/recent_activity/?q=${rison.encode({
      page_size: 12,
      distinct: true,
    })}`,
  });
  const seen = new Set<string>();
  return (json.result as RecentItem[]).filter(item => {
    if (item.item_type !== 'dashboard' || !item.item_url) {
      return false;
    }
    if (seen.has(item.item_url)) {
      return false;
    }
    seen.add(item.item_url);
    return true;
  });
};

/** Recently viewed dashboards and the dashboard grid of the home page. */
export function HomeContent() {
  const [tab, setTab] = useState<DashboardTab>('recent');
  const [dashboards, setDashboards] = useState<DashboardCardData[] | null>(
    null,
  );
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    fetchRecents()
      .then(items => setRecents(items.slice(0, 6)))
      .catch(() => setRecents([]));
  }, []);

  useEffect(() => {
    setDashboards(null);
    fetchDashboards(tab)
      .then(setDashboards)
      .catch(() => setDashboards([]));
  }, [tab]);

  const tabs: { key: DashboardTab; label: string }[] = [
    { key: 'recent', label: t('Recently edited') },
    { key: 'favorite', label: t('Favorites') },
  ];

  return (
    <Page
      css={css`
        padding-top: 0 !important;
      `}
    >
      {recents.length > 0 && (
        <Section>
          <SectionHeader>
            <h2>{t('Recently viewed')}</h2>
          </SectionHeader>
          <RecentList>
            {recents.map(item => (
              <Link key={item.item_url!} to={item.item_url!}>
                <Icons.DashboardOutlined />
                <span className="label">{item.item_title}</span>
                <span className="when">{relativeTime(item.time)}</span>
              </Link>
            ))}
          </RecentList>
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
                  height: 168px !important;
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
                <Link to="/dashboard/new/">
                  {t('Create your first dashboard')}
                </Link>
              )}
            </EmptyCard>
          )}
          {dashboards?.map(dashboard => (
            <DashboardCard
              key={dashboard.id}
              to={dashboard.url}
              data-test="home-dashboard-card"
            >
              <div className="preview" aria-hidden>
                {previewBars(dashboard.id).map((height, index) => (
                  <span
                    key={index}
                    style={{ height, opacity: 0.35 + index * 0.13 }}
                  />
                ))}
              </div>
              <div className="body">
                <span className="title">{dashboard.dashboard_title}</span>
                <div className="meta">
                  <span>{dashboard.changed_on_delta_humanized}</span>
                  <span
                    className={`status ${dashboard.published ? 'published' : ''}`}
                  >
                    {dashboard.published ? t('Published') : t('Draft')}
                  </span>
                </div>
              </div>
            </DashboardCard>
          ))}
        </Grid>
      </Section>
    </Page>
  );
}
