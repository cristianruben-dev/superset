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
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Button, Tabs } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { type ApiKey, ApiKeyList } from 'src/features/apiKeys/ApiKeyList';
import {
  grantableApiKeyScopeOptions,
  readApiKeyScopes,
} from 'src/features/apiKeys/apiKeyScopes';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import copyTextToClipboard from 'src/utils/copy';
import { CommandGroup, PageHeader } from '../shell/PageHeader';
import { usePageCrumbs } from '../shell/pageCrumbs';
import { usePageStatus } from '../shell/pageStatus';
import {
  claudeCodeCommand,
  claudeDesktopConfig,
  KEY_PLACEHOLDER,
  mcpUrl,
} from './clientConfig';

/** The address of the MCP service and whether it takes API keys. */
interface McpConnection {
  url: string | null;
  api_keys_enabled: boolean;
}

const KeysTableWrapper = styled.div`
  width: 100%;

  @media (max-width: 767px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;

    .ant-table-wrapper {
      overflow-x: auto;
    }

    .ant-table {
      min-width: 680px;
    }

    .ant-table table {
      min-width: 680px;
    }

    .ant-table-thead > tr > th,
    .ant-table-tbody > tr > td {
      white-space: nowrap;
      word-break: keep-all;
    }

    .ant-btn {
      min-height: 24px;
      min-width: 24px;
      padding: 4px 8px;
    }
  }
`;

const Page = styled.div`
  ${({ theme }) => css`
    display: grid;
    gap: var(--mb-space-section);
    width: 100%;
    max-width: 1040px;
    padding: var(--mb-space-page-top) var(--mb-space-gutter)
      ${theme.sizeUnit * 8}px;
  `}
`;

const Section = styled.section`
  ${({ theme }) => css`
    display: grid;
    gap: ${theme.sizeUnit * 3}px;
    h2 {
      margin: 0;
      font-size: 15px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }
    p {
      margin: 0;
      max-width: 72ch;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const Facts = styled.ul`
  ${({ theme }) => css`
    display: grid;
    gap: ${theme.sizeUnit * 2}px;
    margin: 0;
    padding-left: ${theme.sizeUnit * 5}px;
    max-width: 72ch;
    color: ${theme.colorTextSecondary};
  `}
`;

const Field = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    flex-wrap: wrap;
    .label {
      font-family: ${theme.fontFamilyCode};
      font-size: 11px;
      color: ${theme.colorTextTertiary};
    }
    code {
      font-family: ${theme.fontFamilyCode};
      font-size: 13px;
      color: ${theme.colorText};
      word-break: break-all;
    }
  `}
`;

const Snippet = styled.div`
  ${({ theme }) => css`
    position: relative;
    pre {
      margin: 0;
      padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
      padding-right: ${theme.sizeUnit * 24}px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorFillQuaternary};
      font-family: ${theme.fontFamilyCode};
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      color: ${theme.colorText};
    }
    .copy {
      position: absolute;
      top: ${theme.sizeUnit * 2}px;
      right: ${theme.sizeUnit * 2}px;
    }
  `}
`;

function CopyBlock({ text, label }: { text: string; label: string }) {
  const { addDangerToast, addSuccessToast } = useToasts();
  return (
    <Snippet>
      <pre aria-label={label}>{text}</pre>
      <Button
        className="copy"
        buttonSize="small"
        icon={<Icons.CopyOutlined />}
        onClick={() =>
          copyTextToClipboard(() => Promise.resolve(text))
            .then(() => addSuccessToast(t('Copied to clipboard')))
            .catch(() => addDangerToast(t('Could not copy to the clipboard')))
        }
      >
        {t('Copy')}
      </Button>
    </Snippet>
  );
}

/** The ways to connect a client, with the key when it was just created. */
function ClientSetup({ url, apiKey }: { url: string; apiKey: string }) {
  return (
    <Tabs
      size="small"
      items={[
        {
          key: 'code',
          label: t('Claude Code'),
          children: (
            <Section>
              <p>{t('Run this command in a terminal:')}</p>
              <CopyBlock
                label={t('Claude Code command')}
                text={claudeCodeCommand(url, apiKey)}
              />
            </Section>
          ),
        },
        {
          key: 'desktop',
          label: t('Claude Desktop'),
          children: (
            <Section>
              <p>
                {t(
                  'Add this to claude_desktop_config.json (Settings › Developer › Edit config) and restart Claude Desktop. It needs Node.js.',
                )}
              </p>
              <CopyBlock
                label={t('Claude Desktop configuration')}
                text={claudeDesktopConfig(url, apiKey)}
              />
            </Section>
          ),
        },
      ]}
    />
  );
}

/**
 * «Conectar IA»: the personal API keys an AI client uses to work in AuraData BI
 * as the user, and the configuration of the client.
 */
export default function ConnectAiPage({
  user,
}: {
  user?: UserWithPermissionsAndRoles;
}) {
  const [connection, setConnection] = useState<McpConnection | null>(null);
  const [creating, setCreating] = useState(false);
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const keysEnabled = isFeatureEnabled(FeatureFlag.FabApiKeyEnabled);

  useEffect(() => {
    SupersetClient.get({ endpoint: '/api/v1/auradata/mcp_connection/' })
      .then(({ json }) => setConnection(json.result as McpConnection))
      .catch(() => setConnection({ url: null, api_keys_enabled: false }));
  }, []);

  usePageCrumbs([{ label: t('Connect AI') }]);
  const active = (keys || []).filter(
    key =>
      key.active &&
      !key.revoked_on &&
      !(key.expires_on && new Date(key.expires_on) < new Date()),
  ).length;
  usePageStatus([
    !!keys && tn('%s active key', '%s active keys', active, active),
  ]);

  const scopeOptions = useMemo(
    () => grantableApiKeyScopeOptions(user?.roles),
    [user?.roles],
  );
  const url = mcpUrl(connection?.url, window.location.origin);

  return (
    <>
      <PageHeader
        title={t('Connect AI')}
        meta={
          keys ? tn('%s active key', '%s active keys', active, active) : null
        }
      >
        {keysEnabled && (
          <CommandGroup label={t('Keys')}>
            <Button
              buttonStyle="primary"
              buttonSize="small"
              icon={<Icons.PlusOutlined />}
              onClick={() => setCreating(true)}
            >
              {t('New key')}
            </Button>
          </CommandGroup>
        )}
      </PageHeader>
      <Page data-test="connect-ai">
        <Section>
          <h2>{t('Your AI works as you')}</h2>
          <p>
            {t(
              'An AI assistant such as Claude can build and change your reports through the MCP service of AuraData BI. It signs in with a personal key that you create here.',
            )}
          </p>
          <Facts>
            <li>
              {t(
                'It sees and changes only what you can: your workspaces, your roles and your data access apply to it too.',
              )}
            </li>
            <li>
              {t(
                'The permissions of a key only narrow that. A read-only key can look at reports but not change them.',
              )}
            </li>
            <li>
              {t(
                'Treat a key like your password: whoever holds it acts as you. The permissions limit what the AI does through MCP, not the other uses of the key. Revoke it when you no longer use it.',
              )}
            </li>
          </Facts>
        </Section>

        {!keysEnabled || (connection && !connection.api_keys_enabled) ? (
          <Alert
            type="info"
            showIcon
            title={t('API keys are turned off')}
            description={t(
              'An administrator turns them on with FAB_API_KEY_ENABLED and MCP_API_KEY_ENABLED in the configuration.',
            )}
          />
        ) : (
          <>
            <Section>
              <h2>{t('Connect a client')}</h2>
              <Field>
                <span className="label">{t('MCP address')}</span>
                <code data-test="connect-ai-url">{url}</code>
              </Field>
              <p>
                {t(
                  'Create a key, then replace %s with it. The configuration with your key also shows when you create one.',
                  KEY_PLACEHOLDER,
                )}
              </p>
              <ClientSetup url={url} apiKey={KEY_PLACEHOLDER} />
            </Section>

            <Section>
              <h2>{t('Your keys')}</h2>
              <KeysTableWrapper>
                <ApiKeyList
                  hideToolbar
                  creating={creating}
                  onCreatingChange={setCreating}
                  onKeysChange={setKeys}
                  createModalProps={{
                    scopeOptions,
                    initialScopes: readApiKeyScopes(scopeOptions),
                    createdKeyExtra: key => (
                      <div
                        css={css`
                          margin-top: 16px;
                        `}
                      >
                        <ClientSetup url={url} apiKey={key} />
                      </div>
                    ),
                  }}
                />
              </KeysTableWrapper>
            </Section>
          </>
        )}
      </Page>
    </>
  );
}
