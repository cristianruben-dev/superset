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
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Loading, Select, Table } from '@superset-ui/core/components';

const USAGE_URL = '/api/v1/auradata_assistant/usage/';

/** What one row of a breakdown adds up to. */
interface Amounts {
  cost_usd: number;
  tokens: number;
  answers: number;
}

/** Answer of the usage API. */
interface Usage {
  month: string;
  total_usd: number;
  monthly_budget_usd: number | null;
  months: { month: string; cost_usd: number }[];
  by_model: (Amounts & { model: string | null })[];
  by_workspace: (Amounts & {
    workspace_id: number | null;
    name: string | null;
  })[];
  by_user: (Amounts & { user_id: number | null; name: string | null })[];
}

/** One row of a table on this page, whatever it breaks down. */
interface Row extends Amounts {
  key: string;
  name: string;
}

const money = (value: number) => `$${value.toFixed(2)}`;

const Page = styled.div`
  ${({ theme }) => css`
    display: grid;
    gap: var(--mb-space-section);
    width: 100%;
    max-width: 1040px;
    padding: var(--mb-space-page-top) var(--mb-space-gutter)
      ${theme.sizeUnit * 8}px;

    h2 {
      margin: 0 0 ${theme.sizeUnit * 2}px;
      font-size: 15px;
      font-weight: ${theme.fontWeightStrong};
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.sizeUnit * 4}px;
    }
    .month {
      width: 180px;
    }
    .total {
      font-family: ${theme.fontFamilyCode};
      font-size: 13px;
    }
  `}
`;

function Breakdown({ title, rows }: { title: string; rows: Row[] }) {
  const figure = { align: 'right' as const, className: 'auradata-figure' };
  const columns = useMemo(
    () => [
      { title, dataIndex: 'name', key: 'name' },
      {
        ...figure,
        title: t('Cost'),
        dataIndex: 'cost_usd',
        key: 'cost',
        render: money,
      },
      { ...figure, title: t('Answers'), dataIndex: 'answers', key: 'answers' },
      { ...figure, title: t('Tokens'), dataIndex: 'tokens', key: 'tokens' },
    ],
    [title],
  );
  return (
    <section>
      <h2>{title}</h2>
      <div className="superset-list-view">
        <Table<Row>
          data={rows}
          columns={columns}
          rowKey="key"
          usePagination={false}
          sticky={false}
          locale={{ emptyText: t('Nothing this month') }}
        />
      </div>
    </section>
  );
}

/**
 * «Usage» in the page of the assistant: what it spent by month, model, workspace and
 * user. Admins only, like the API behind it.
 */
export function AssistantUsage() {
  const [month, setMonth] = useState<string>();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    SupersetClient.get({
      endpoint: month ? `${USAGE_URL}?month=${month}` : USAGE_URL,
    }).then(
      ({ json }) => {
        if (live) {
          setUsage(json.result);
          setFailed(false);
        }
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [month]);

  if (failed) {
    return (
      <Page>
        <Alert
          type="error"
          showIcon
          title={t('The usage could not be loaded.')}
        />
      </Page>
    );
  }
  if (!usage) {
    return <Loading position="inline-centered" />;
  }
  return (
    <Page data-test="assistant-usage">
      <div className="summary">
        <div className="month">
          <Select
            ariaLabel={t('Month')}
            value={usage.month}
            showSearch={false}
            options={usage.months.map(item => ({
              value: item.month,
              label: `${item.month} · ${money(item.cost_usd)}`,
            }))}
            onChange={value => setMonth(String(value))}
          />
        </div>
        <span className="total" data-test="assistant-usage-total">
          {usage.monthly_budget_usd === null
            ? money(usage.total_usd)
            : `${money(usage.total_usd)} / ${money(usage.monthly_budget_usd)}`}
        </span>
      </div>
      <Breakdown
        title={t('Model')}
        rows={usage.by_model.map(row => ({
          ...row,
          key: row.model ?? '',
          name: row.model ?? t('Unknown'),
        }))}
      />
      <Breakdown
        title={t('Workspace')}
        rows={usage.by_workspace.map(row => ({
          ...row,
          key: String(row.workspace_id),
          name: row.name ?? t('No workspace'),
        }))}
      />
      <Breakdown
        title={t('User')}
        rows={usage.by_user.map(row => ({
          ...row,
          key: String(row.user_id),
          name: row.name ?? t('Deleted user'),
        }))}
      />
    </Page>
  );
}
