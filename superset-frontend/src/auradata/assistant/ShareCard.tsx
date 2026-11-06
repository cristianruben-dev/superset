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
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import {
  AssistantError,
  fetchShareCard,
  shareArtifact,
  unshareArtifact,
} from './client';
import type { Artifact, ShareCardData } from './types';

const Card = styled.section`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    margin-bottom: ${theme.sizeUnit * 5}px;
    padding: ${theme.sizeUnit * 4}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.sizeUnit * 2}px;
    background: ${theme.colorBgContainer};
    box-shadow: ${theme.boxShadowTertiary};
    font-size: ${theme.fontSizeSM}px;
    line-height: 1.5;
    color: ${theme.colorText};

    h2 {
      margin: 0;
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
    }
    p {
      margin: 0;
    }
    ul {
      margin: 0;
      padding-left: ${theme.sizeUnit * 5}px;
    }
    li {
      overflow-wrap: anywhere;
    }
    code {
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
    }
  `}
`;

const Warning = styled.p`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-left: 2px solid ${theme.colorWarning};
    background: ${theme.colorWarningBg};
  `}
`;

const Actions = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const problemText = (problem: ShareCardData['problem']) =>
  problem === 'no_workspace'
    ? t('This report is in no workspace, so there is nobody to share with.')
    : t('Only a member of the workspace of this report can share this.');

/** The link a member of the workspace opens. */
const linkOf = (id: string) =>
  `${window.location.origin}${ensureAppRoot(`/assistant/document/${id}/`)}`;

function Passages({ card }: { card: ShareCardData }) {
  if (!card.passages.length) {
    return (
      <p>
        {card.text_blocks
          ? t('Its text mentions no figures.')
          : t('It has no text: every figure is read by whoever opens it.')}
      </p>
    );
  }
  return (
    <>
      <p>
        {tn(
          'Its text mentions %s figure:',
          'Its text mentions %s figures:',
          card.numbers,
          card.numbers,
        )}
      </p>
      <ul data-test="auradata-share-passages">
        {card.passages.map((passage, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={index}>{passage}</li>
        ))}
      </ul>
      {card.more_passages > 0 && (
        <p>
          {tn(
            'And %s more passage.',
            'And %s more passages.',
            card.more_passages,
            card.more_passages,
          )}
        </p>
      )}
    </>
  );
}

function BlocksFacts({ card }: { card: ShareCardData }) {
  const partial = card.datasets.filter(item => !item.for_every_member);
  return (
    <>
      {card.filters.length > 0 && (
        <p>
          {t('Each reader also sees what the blocks filter by:')}{' '}
          {card.filters.map(({ column, values }, index) => (
            <span key={column}>
              {index > 0 && ' · '}
              <code>{column}</code>: {values.map(String).join(', ')}
            </span>
          ))}
        </p>
      )}
      {partial.length > 0 && (
        <p>
          {t(
            'Some members may not reach %s: they will read a note where those blocks go.',
            partial.map(item => item.name).join(', '),
          )}
        </p>
      )}
      {card.draft && (
        <p>
          {t(
            'This report is a draft: only members who can see the draft will read the document.',
          )}
        </p>
      )}
    </>
  );
}

/**
 * What a person reads before sharing a document, and where they stop sharing it. What
 * the card says holds for the version it shows: the server refuses another one. Text
 * comes from the model and goes through as plain text.
 */
export function ShareCard({
  artifact,
  onChange,
  onClose,
}: {
  artifact: Artifact;
  onChange: (changed: Artifact) => void;
  onClose: () => void;
}) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const [card, setCard] = useState<ShareCardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(false);
  const shared = artifact.share;
  const current = shared?.version === artifact.version;

  useEffect(() => {
    let live = true;
    setCard(null);
    fetchShareCard(artifact.id).then(
      found => {
        if (live) setCard(found);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [artifact.id, artifact.version]);

  const act = async (run: () => Promise<Artifact>, done: string) => {
    setWorking(true);
    try {
      onChange(await run());
      addSuccessToast(done);
      onClose();
    } catch (error) {
      addDangerToast(
        error instanceof AssistantError
          ? error.message
          : t('This document could not be shared.'),
      );
    } finally {
      setWorking(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(linkOf(artifact.id));
    addSuccessToast(t('Link copied.'));
  };

  if (failed) {
    return <Card>{t('This document could not be shared.')}</Card>;
  }
  if (!card) {
    return (
      <Card>
        <Loading position="inline-centered" size="s" />
      </Card>
    );
  }
  const canShare = !card.problem && !current;
  return (
    <Card aria-label={t('Share this document')} data-test="auradata-share-card">
      {shared && (
        <>
          <h2>
            {t(
              'Shared with «%s», version %s',
              shared.workspace ?? '',
              shared.version,
            )}
          </h2>
          <p>
            {current
              ? t('Readers see this version, each with their own permissions.')
              : t(
                  'Readers still see version %s. Share this one if it should reach them.',
                  shared.version,
                )}
          </p>
        </>
      )}
      {!current &&
        (card.problem ? (
          <p data-test="auradata-share-problem">{problemText(card.problem)}</p>
        ) : (
          <>
            <h2>
              {tn(
                'Share version %s with «%s» (%s member)',
                'Share version %s with «%s» (%s members)',
                card.members,
                card.version,
                card.workspace ?? '',
                card.members,
              )}
            </h2>
            <Warning data-test="auradata-share-warning">
              {t(
                'Charts, tables and figures are read with the permissions of each reader, but the text is not: it stays as the assistant wrote it with your access, and row level security does not reach it. Everyone who opens the document reads it. Check that it says nothing they should not see.',
              )}
            </Warning>
            <Passages card={card} />
            <BlocksFacts card={card} />
          </>
        ))}
      <Actions>
        <Button buttonSize="small" buttonStyle="secondary" onClick={onClose}>
          {t('Close')}
        </Button>
        {shared && (
          <>
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              icon={<Icons.LinkOutlined iconSize="s" />}
              onClick={copyLink}
            >
              {t('Copy link')}
            </Button>
            <Button
              buttonSize="small"
              buttonStyle="danger"
              disabled={working}
              onClick={() =>
                act(() => unshareArtifact(artifact.id), t('No longer shared.'))
              }
              data-test="auradata-share-stop"
            >
              {t('Stop sharing')}
            </Button>
          </>
        )}
        {canShare && (
          <Button
            buttonSize="small"
            disabled={working}
            onClick={() =>
              act(
                () => shareArtifact(artifact.id, card.version),
                t('Shared with the workspace.'),
              )
            }
            data-test="auradata-share-confirm"
          >
            {t('Share version %s', card.version)}
          </Button>
        )}
      </Actions>
    </Card>
  );
}
