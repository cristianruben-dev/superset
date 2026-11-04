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
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { objectName } from 'src/auradata/format/objectName';

const Flow = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;

    .flow {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto 1.5fr;
      align-items: flex-start;
      gap: ${theme.sizeUnit * 2}px;
    }

    .node {
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.borderRadius}px;
      overflow-wrap: anywhere;
    }

    .kind {
      display: block;
      font-size: 11px;
      color: ${theme.colorTextTertiary};
    }

    .arrow {
      padding-top: ${theme.sizeUnit * 3}px;
      color: ${theme.colorTextTertiary};
    }

    ul {
      margin: 0;
      padding-left: ${theme.sizeUnit * 4}px;
    }
  `}
`;

interface Source {
  key: string;
  database: string;
  dataset: string;
  charts: string[];
}

type Datasource = {
  datasource_name?: string;
  table_name?: string;
  database?: { name?: string; database_name?: string };
};

/** Where the data of the report comes from: database, dataset and charts. */
export function LineageModal({
  show,
  onHide,
}: {
  show: boolean;
  onHide: () => void;
}) {
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const charts = useSelector((state: RootState) => state.charts);
  const datasources = useSelector(
    (state: RootState) =>
      state.datasources as unknown as Record<string, Datasource>,
  );

  const sources = useMemo(() => {
    const found = new Map<string, Source>();
    Object.values(layout).forEach(item => {
      if (item.type !== CHART_TYPE) return;
      const chart = charts[item.meta.chartId as number];
      const key = String(chart?.form_data?.datasource ?? '');
      const source = datasources[key];
      if (!found.has(key)) {
        found.set(key, {
          key,
          database:
            source?.database?.name ??
            source?.database?.database_name ??
            t('Unknown'),
          dataset:
            source?.datasource_name ?? source?.table_name ?? t('Unknown'),
          charts: [],
        });
      }
      found.get(key)!.charts.push(objectName(item));
    });
    return [...found.values()];
  }, [charts, datasources, layout]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Lineage')}
      hideFooter
      width={720}
    >
      <Flow data-test="mibi-lineage">
        {!sources.length && t('This report has no charts yet')}
        {sources.map(source => (
          <div className="flow" key={source.key}>
            <div className="node">
              <span className="kind">{t('Database')}</span>
              {source.database}
            </div>
            <Icons.ArrowRightOutlined className="arrow" iconSize="m" />
            <div className="node">
              <span className="kind">{t('Dataset')}</span>
              {source.dataset}
            </div>
            <Icons.ArrowRightOutlined className="arrow" iconSize="m" />
            <div className="node">
              <span className="kind">
                {t('Charts')} ({source.charts.length})
              </span>
              <ul>
                {source.charts.map((name, index) => (
                  // Two charts can share a name
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </Flow>
    </Modal>
  );
}
