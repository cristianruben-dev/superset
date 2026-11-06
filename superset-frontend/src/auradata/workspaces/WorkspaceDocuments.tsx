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
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import getBootstrapData from 'src/utils/getBootstrapData';
import { ensureAppRoot } from 'src/utils/pathUtils';
import {
  fetchSharedDocuments,
  unshareArtifact,
} from 'src/auradata/assistant/client';
import { parseServerDate } from 'src/auradata/assistant/conversationGroups';
import type { SharedDocument } from 'src/auradata/assistant/types';

const List = styled.ul`
  ${({ theme }) => css`
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid ${theme.colorBorderSecondary};

    li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 2}px 0;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }
    .meta {
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const dateOf = (value: string) =>
  new Intl.DateTimeFormat(getBootstrapData().common?.locale || 'en', {
    dateStyle: 'medium',
  }).format(parseServerDate(value));

/**
 * The documents of the assistant shared in a workspace, which this person can read. The
 * server decides that one by one; with none, the section does not show. An author who
 * lost the report gets no link, only the way to stop sharing it.
 */
export function WorkspaceDocuments({
  workspaceId,
  title,
}: {
  workspaceId: number;
  title: (count: number) => JSX.Element;
}) {
  const [documents, setDocuments] = useState<SharedDocument[]>([]);

  useEffect(() => {
    let live = true;
    fetchSharedDocuments(workspaceId).then(
      found => {
        if (live) setDocuments(found);
      },
      () => {
        if (live) setDocuments([]);
      },
    );
    return () => {
      live = false;
    };
  }, [workspaceId]);

  const stopSharing = async (id: string) => {
    await unshareArtifact(id);
    setDocuments(found => found.filter(item => item.id !== id));
  };

  if (!documents.length) return null;
  return (
    <>
      {title(documents.length)}
      <List data-test="auradata-workspace-documents">
        {documents.map(item => (
          <li key={item.id}>
            {item.opens ? (
              <a href={ensureAppRoot(`/assistant/document/${item.id}/`)}>
                {item.title}
              </a>
            ) : (
              <span>
                {item.title}{' '}
                <Button
                  buttonSize="xsmall"
                  buttonStyle="link"
                  onClick={() => stopSharing(item.id)}
                  data-test="auradata-workspace-document-stop"
                >
                  {t('Stop sharing')}
                </Button>
              </span>
            )}
            <span className="meta">
              {`${item.author ?? ''} · ${dateOf(item.shared_on)}`}
            </span>
          </li>
        ))}
      </List>
    </>
  );
}
