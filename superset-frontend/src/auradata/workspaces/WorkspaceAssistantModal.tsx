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
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  InputNumber,
  Modal,
  Switch,
} from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';

/** The assistant in a workspace, as its admins see it. */
interface WorkspaceAssistant {
  enabled: boolean;
  edit_enabled: boolean;
  monthly_budget_usd: number | null;
  spent_usd: number;
  global_enabled: boolean;
  global_edit_enabled: boolean;
}

const url = (workspaceId: number) =>
  `/api/v1/auradata_assistant/workspace/${workspaceId}/`;

const Body = styled.div`
  ${({ theme }) => css`
    display: grid;
    gap: ${theme.sizeUnit * 4}px;

    label {
      display: grid;
      gap: ${theme.sizeUnit}px;
    }
    .spent {
      color: ${theme.colorTextSecondary};
    }
    .spent strong {
      font-family: ${theme.fontFamilyCode};
      font-weight: normal;
    }
  `}
`;

/**
 * The switches and the limit of the assistant in a workspace, for its admins. They only
 * narrow what the platform allows, so what it has turned off shows here as off.
 */
export function WorkspaceAssistantModal({
  workspaceId,
  show,
  onHide,
}: {
  workspaceId: number;
  show: boolean;
  onHide: () => void;
}) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const [draft, setDraft] = useState<WorkspaceAssistant | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setDraft(null);
    SupersetClient.get({ endpoint: url(workspaceId) }).then(
      ({ json }) => setDraft(json.result),
      () => {
        addDangerToast(t('The assistant settings could not be loaded.'));
        onHide();
      },
    );
  }, [addDangerToast, onHide, show, workspaceId]);

  const save = () => {
    if (!draft) return;
    setSaving(true);
    SupersetClient.put({
      endpoint: url(workspaceId),
      jsonPayload: {
        enabled: draft.enabled,
        edit_enabled: draft.edit_enabled,
        monthly_budget_usd: draft.monthly_budget_usd,
      },
    })
      .then(() => {
        addSuccessToast(t('The settings were saved.'));
        onHide();
      })
      .catch(() => addDangerToast(t('The settings could not be saved.')))
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('AI assistant in this workspace')}
      footer={
        <>
          <Button buttonStyle="secondary" onClick={onHide}>
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            onClick={save}
            disabled={!draft}
            loading={saving}
          >
            {t('Save')}
          </Button>
        </>
      }
    >
      {draft && (
        <Body data-test="workspace-assistant">
          {!draft.global_enabled && (
            <Alert
              type="info"
              showIcon
              closable={false}
              message={t(
                'An admin of the platform turned the assistant off for everyone.',
              )}
            />
          )}
          <label>
            <span>
              <Switch
                aria-label={t('Turn on the assistant')}
                checked={draft.enabled && draft.global_enabled}
                disabled={!draft.global_enabled}
                onChange={enabled => setDraft({ ...draft, enabled })}
              />{' '}
              {t('Turn on the assistant')}
            </span>
          </label>
          <label>
            <span>
              <Switch
                aria-label={t('Let it change reports')}
                checked={draft.edit_enabled && draft.global_edit_enabled}
                disabled={!draft.global_edit_enabled || !draft.enabled}
                onChange={edit_enabled => setDraft({ ...draft, edit_enabled })}
              />{' '}
              {t('Let it change reports')}
            </span>
          </label>
          <label>
            {t('Monthly budget (USD)')}
            <InputNumber
              aria-label={t('Monthly budget (USD)')}
              min={0}
              value={draft.monthly_budget_usd}
              onChange={value =>
                setDraft({
                  ...draft,
                  monthly_budget_usd: value === null ? null : Number(value),
                })
              }
            />
          </label>
          <p className="spent">
            {t('Spent this month:')}{' '}
            <strong>{`$${draft.spent_usd.toFixed(2)}`}</strong>
          </p>
        </Body>
      )}
    </Modal>
  );
}
