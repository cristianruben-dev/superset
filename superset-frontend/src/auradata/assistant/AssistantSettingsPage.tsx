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
import { SupersetClient } from '@superset-ui/core';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Checkbox,
  InputNumber,
  Select,
  Switch,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import Tabs from '@superset-ui/core/components/Tabs';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { CommandGroup, PageHeader } from '../shell/PageHeader';
import { usePageCrumbs } from '../shell/pageCrumbs';
import { usePageStatus } from '../shell/pageStatus';
import { AssistantUsage } from './AssistantUsage';

const SETTINGS_URL = '/api/v1/auradata_assistant/settings/';

/** One model of the catalog, as the settings API describes it. */
interface AssistantModel {
  id: string;
  display_name: string;
  status: string;
  known: boolean;
  offered: boolean;
  input_price: number;
  output_price: number;
}

/** Why the model list is the built-in one instead of the live one. */
type ModelsProblem =
  | 'no_api_key'
  | 'sdk_missing'
  | 'rejected_key'
  | 'unreachable'
  | 'unavailable';

/** Answer of the settings API. */
interface AssistantSettings {
  enabled: boolean;
  edit_enabled: boolean;
  default_model: string;
  allowed_models: string[] | null;
  monthly_budget_usd: number | null;
  has_api_key: boolean;
  models: AssistantModel[];
  models_source: 'live' | 'table';
  models_problem: ModelsProblem | null;
}

/** What the admin is changing before saving it. */
interface Draft {
  enabled: boolean;
  editEnabled: boolean;
  defaultModel: string;
  allowed: string[];
  budget: number | null;
}

const draftOf = (settings: AssistantSettings): Draft => ({
  enabled: settings.enabled,
  editEnabled: settings.edit_enabled,
  defaultModel: settings.default_model,
  allowed:
    settings.allowed_models ??
    settings.models.filter(model => model.offered).map(model => model.id),
  budget: settings.monthly_budget_usd,
});

const sameDraft = (a: Draft, b: Draft) =>
  a.enabled === b.enabled &&
  a.editEnabled === b.editEnabled &&
  a.defaultModel === b.defaultModel &&
  a.budget === b.budget &&
  [...a.allowed].sort().join() === [...b.allowed].sort().join();

const problemMessage = (problem: ModelsProblem) =>
  ({
    no_api_key: t(
      'The server has no Anthropic key. Set ANTHROPIC_API_KEY in its configuration.',
    ),
    sdk_missing: t('The Anthropic SDK is not installed on this server.'),
    rejected_key: t(
      'Anthropic rejected the key of this server. Check ANTHROPIC_API_KEY.',
    ),
    unreachable: t('Anthropic could not be reached from this server.'),
    unavailable: t('Anthropic did not return its list of models.'),
  })[problem];

const money = (value: number) => `$${value.toFixed(2)}`;

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

const Setting = styled.label`
  ${({ theme }) => css`
    display: grid;
    gap: ${theme.sizeUnit}px;
    max-width: 320px;
    color: ${theme.colorText};
  `}
`;

const ModelRow = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${theme.sizeUnit}px ${theme.sizeUnit * 4}px;
    align-items: baseline;
    padding: ${theme.sizeUnit * 2}px 0;
    border-bottom: 1px solid ${theme.colorSplit};
    .price {
      font-family: ${theme.fontFamilyCode};
      font-size: 12px;
      color: ${theme.colorTextSecondary};
    }
    .note {
      grid-column: 1 / -1;
      padding-left: ${theme.sizeUnit * 6}px;
      font-size: 12px;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

/**
 * «Asistente de IA» in Administration: whether the assistant runs, the models
 * it offers and its monthly budget.
 */
export default function AssistantSettingsPage() {
  const { addDangerToast, addSuccessToast } = useToasts();
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback((refresh: boolean) => {
    setWorking(true);
    return SupersetClient.get({
      endpoint: refresh ? `${SETTINGS_URL}?refresh=true` : SETTINGS_URL,
    })
      .then(({ json }) => {
        const loaded = json.result as AssistantSettings;
        setSettings(loaded);
        setDraft(current => current ?? draftOf(loaded));
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setWorking(false));
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const save = () => {
    if (!draft) {
      return;
    }
    setWorking(true);
    SupersetClient.put({
      endpoint: SETTINGS_URL,
      jsonPayload: {
        enabled: draft.enabled,
        edit_enabled: draft.editEnabled,
        default_model: draft.defaultModel,
        allowed_models: draft.allowed,
        monthly_budget_usd: draft.budget,
      },
    })
      .then(({ json }) => {
        const saved = json.result as AssistantSettings;
        setSettings(saved);
        setDraft(draftOf(saved));
        addSuccessToast(t('The settings were saved.'));
      })
      .catch(() => addDangerToast(t('The settings could not be saved.')))
      .finally(() => setWorking(false));
  };

  const toggleModel = (id: string, checked: boolean) => {
    setDraft(current => {
      if (!current) {
        return current;
      }
      const allowed = checked
        ? [...current.allowed, id]
        : current.allowed.filter(model => model !== id);
      return {
        ...current,
        allowed,
        defaultModel: allowed.includes(current.defaultModel)
          ? current.defaultModel
          : (allowed[0] ?? ''),
      };
    });
  };

  const defaultOptions = useMemo(() => {
    const names = new Map(
      settings?.models.map(model => [model.id, model.display_name]),
    );
    return (draft?.allowed ?? []).map(id => ({
      value: id,
      label: names.get(id) ?? id,
    }));
  }, [draft?.allowed, settings?.models]);

  usePageCrumbs([{ label: t('AI assistant') }]);
  const count = draft?.allowed.length ?? 0;
  const offering =
    !!draft && tn('%s model offered', '%s models offered', count, count);
  usePageStatus([offering]);

  const dirty = !!settings && !!draft && !sameDraft(draft, draftOf(settings));

  return (
    <>
      <PageHeader title={t('AI assistant')} meta={offering || null}>
        <CommandGroup label={t('Models')}>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            icon={<Icons.SyncOutlined />}
            disabled={working || !settings}
            onClick={() => load(true)}
          >
            {t('Refresh list')}
          </Button>
        </CommandGroup>
        <CommandGroup label={t('Settings')}>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            disabled={working || !dirty || !count}
            onClick={save}
          >
            {t('Save')}
          </Button>
        </CommandGroup>
      </PageHeader>
      <Tabs
        defaultActiveKey="settings"
        items={[
          {
            key: 'settings',
            label: t('Settings'),
            children: (
              <Page data-test="assistant-settings">
                {failed && (
                  <Alert
                    type="error"
                    showIcon
                    title={t('The settings could not be loaded.')}
                  />
                )}
                {settings && draft && (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      closable={false}
                      data-test="assistant-privacy-notice"
                      title={t('The data you query is sent to Anthropic')}
                      description={t(
                        'The assistant sees what each user sees, data rows included. What they ask and the data it reads travel to the Anthropic API.',
                      )}
                    />

                    <Section>
                      <h2>{t('Availability')}</h2>
                      <p>
                        {t(
                          'While it is off, nobody can open the assistant. The key of Anthropic stays on the server.',
                        )}
                      </p>
                      <Setting>
                        <span>
                          <Switch
                            aria-label={t('Turn on the assistant')}
                            checked={draft.enabled}
                            onChange={enabled =>
                              setDraft({ ...draft, enabled })
                            }
                          />{' '}
                          {t('Turn on the assistant')}
                        </span>
                      </Setting>
                      <Setting>
                        <span>
                          <Switch
                            aria-label={t('Let it change reports')}
                            checked={draft.editEnabled}
                            onChange={editEnabled =>
                              setDraft({ ...draft, editEnabled })
                            }
                          />{' '}
                          {t('Let it change reports')}
                        </span>
                      </Setting>
                      <p>
                        {t(
                          'Without this, the assistant only answers questions. A workspace can turn off the assistant or this option for itself, never turn them on.',
                        )}
                      </p>
                    </Section>

                    <Section>
                      <h2>{t('Models')}</h2>
                      {settings.models_problem && (
                        <Alert
                          type="warning"
                          showIcon
                          closable={false}
                          data-test="assistant-models-problem"
                          title={t(
                            'This list is the one built into AuraData BI and may be out of date.',
                          )}
                          description={problemMessage(settings.models_problem)}
                        />
                      )}
                      <p>
                        {t(
                          'Choose the models users can pick. Prices are in dollars per million tokens, input / output.',
                        )}
                      </p>
                      <div>
                        {settings.models.map(model => (
                          <ModelRow key={model.id}>
                            <Checkbox
                              checked={draft.allowed.includes(model.id)}
                              onChange={event =>
                                toggleModel(model.id, event.target.checked)
                              }
                            >
                              {model.display_name}
                            </Checkbox>
                            <span className="price">
                              {money(model.input_price)} /{' '}
                              {money(model.output_price)}
                            </span>
                            {!model.known && (
                              <span className="note">
                                {t(
                                  'AuraData BI does not know this model yet: it runs with cautious settings and this price is an upper estimate.',
                                )}
                              </span>
                            )}
                          </ModelRow>
                        ))}
                      </div>
                      <Setting>
                        {t('Default model')}
                        <Select
                          ariaLabel={t('Default model')}
                          value={draft.defaultModel || undefined}
                          options={defaultOptions}
                          onChange={value =>
                            setDraft({ ...draft, defaultModel: String(value) })
                          }
                        />
                      </Setting>
                    </Section>

                    <Section>
                      <h2>{t('Monthly budget')}</h2>
                      <p>
                        {t(
                          'The most the assistant may spend in a month, in dollars. People get a notice at 80% and it stops at 100%, once the answer under way ends. Leave it empty for no limit. A workspace can set its own limit too.',
                        )}
                      </p>
                      <Setting>
                        {t('Monthly budget (USD)')}
                        <InputNumber
                          aria-label={t('Monthly budget (USD)')}
                          min={0}
                          value={draft.budget}
                          onChange={value =>
                            setDraft({
                              ...draft,
                              budget: value === null ? null : Number(value),
                            })
                          }
                        />
                      </Setting>
                    </Section>
                  </>
                )}
              </Page>
            ),
          },
          {
            key: 'usage',
            label: t('Usage'),
            children: <AssistantUsage />,
          },
        ]}
      />
    </>
  );
}
