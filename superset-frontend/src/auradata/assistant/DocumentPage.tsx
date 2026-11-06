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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { URL_PARAMS } from 'src/constants';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { getUrlParam } from 'src/utils/urlUtils';
import { dataBlocks } from './artifact';
import { ArtifactBlocks } from './ArtifactBlocks';
import { fetchDocument } from './client';
import { DocumentMark, ReaderNote } from './DocumentNotes';
import { layOutSheets } from './sheets';
import type { ArtifactDocument } from './types';

/** The width of a sheet of the export: `exports.SHEET_WIDTH` on the server. */
const SHEET_WIDTH = 1000;
const SHEET_HEIGHT = 1414;
const SHEET_MARGIN = 56;
/** An ECharts chart animates for this long after its data arrives. */
const CHART_ANIMATION_MS = 1300;

const Page = styled.main`
  ${({ theme }) => css`
    box-sizing: border-box;
    width: 100%;
    max-width: ${theme.sizeUnit * 200}px;
    margin: 0 auto;
    padding: ${theme.sizeUnit * 8}px ${theme.sizeUnit * 6}px
      ${theme.sizeUnit * 16}px;
    background: ${theme.colorBgContainer};

    &[data-capture='true'] {
      width: ${SHEET_WIDTH}px;
      max-width: none;
      min-height: ${SHEET_HEIGHT}px;
      margin: 0;
      padding: ${theme.sizeUnit * 14}px ${theme.sizeUnit * 16}px;
    }
  `}
`;

const Title = styled.h1`
  ${({ theme }) => css`
    margin: 0 0 ${theme.sizeUnit * 2}px;
    font-size: ${theme.sizeUnit * 8}px;
    line-height: 1.2;
    font-weight: ${theme.fontWeightStrong};
    letter-spacing: -0.015em;
    color: ${theme.colorText};
    overflow-wrap: anywhere;
  `}
`;

const Problem = styled.p`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit * 16}px auto;
    max-width: ${theme.sizeUnit * 110}px;
    text-align: center;
    color: ${theme.colorTextSecondary};
  `}
`;

const Back = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

/**
 * A document of the assistant on its own page: what its owner exports as a PDF and what
 * the members of a workspace read when it is shared with them. It is only to read: no
 * chat, no history, nothing to select. The figures are read here, as the person looking,
 * and whatever the server left out for this reader says so. Captured, it lays out on
 * sheets once every figure has arrived, and only then says it is ready.
 */
export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const capture = !!getUrlParam(URL_PARAMS.standalone);
  const [found, setFound] = useState<ArtifactDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
  const [ready, setReady] = useState(false);
  const page = useRef<HTMLElement>(null);

  useEffect(() => {
    let current = true;
    fetchDocument(id).then(
      document => {
        if (current) setFound(document);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [id]);

  const onSettled = useCallback(
    (block: string) =>
      setSettled(known =>
        known.has(block) ? known : new Set(known).add(block),
      ),
    [],
  );
  const pending = useMemo(
    () =>
      found
        ? dataBlocks(found.blocks).filter(block => !settled.has(block.id))
            .length
        : 1,
    [found, settled],
  );

  useEffect(() => {
    if (!found || pending > 0) return undefined;
    const timer = setTimeout(() => {
      if (capture && page.current) {
        layOutSheets(page.current, SHEET_HEIGHT, SHEET_MARGIN);
      }
      setReady(true);
    }, CHART_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [capture, found, pending]);

  if (failed) {
    return (
      <Problem data-test="auradata-document-missing">
        {t(
          'This document does not exist, or it is not shared with you. Ask its author.',
        )}
      </Problem>
    );
  }
  if (!found) return <Loading />;
  return (
    <Page
      ref={page}
      className={ready ? 'auradata-document-ready' : undefined}
      data-capture={capture}
      data-test="auradata-document"
    >
      {!capture && (
        <Back>
          <Button
            buttonStyle="link"
            buttonSize="small"
            href={ensureAppRoot(`/dashboard/${found.dashboard_id}/`)}
            icon={<Icons.ArrowLeftOutlined iconSize="s" />}
          >
            {t('Go to the report')}
          </Button>
        </Back>
      )}
      <Title>{found.title}</Title>
      <DocumentMark model={found.model_name} />
      {found.reader && <ReaderNote document={found} />}
      <ArtifactBlocks
        blocks={found.blocks}
        sources={found.sources}
        dashboardId={found.dashboard_id}
        onSettled={onSettled}
      />
    </Page>
  );
}
