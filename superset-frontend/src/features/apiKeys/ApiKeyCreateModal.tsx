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
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  FormModal,
  FormItem,
  Input,
  Button,
  Modal,
  Select,
} from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import copyTextToClipboard from 'src/utils/copy';
import {
  API_KEY_SCOPE_OPTIONS,
  getApiKeyScopesHelpText,
  serializeApiKeyScopes,
} from './apiKeyScopes';

export interface ApiKeyCreateModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
  /** Scopes to offer; every supported scope when left out. */
  scopeOptions?: { label: string; value: string }[];
  /** Scopes selected when the form opens. */
  initialScopes?: string[];
  /** Shown under the new key, the only time it can be read. */
  createdKeyExtra?: (key: string) => ReactNode;
}

interface FormValues {
  name: string;
  scopes?: string[];
}

export function ApiKeyCreateModal({
  show,
  onHide,
  onSuccess,
  scopeOptions = API_KEY_SCOPE_OPTIONS,
  initialScopes,
  createdKeyExtra,
}: ApiKeyCreateModalProps) {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  const handleFormSubmit = async (values: FormValues) => {
    try {
      const scopes = serializeApiKeyScopes(values.scopes);
      const response = await SupersetClient.post({
        endpoint: '/api/v1/security/api_keys/',
        jsonPayload: {
          name: values.name,
          ...(scopes && { scopes }),
        },
      });
      const key = response.json?.result?.key;
      if (!key) {
        throw new Error('API response did not include a key');
      }
      setCreatedKey(key);
      addSuccessToast(t('API key created successfully'));
    } catch (error) {
      addDangerToast(t('Failed to create API key'));
      throw error;
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) {
      return;
    }
    try {
      await copyTextToClipboard(() => Promise.resolve(createdKey));
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      addDangerToast(t('Failed to copy API key to clipboard'));
    }
  };

  const handleClose = () => {
    if (createdKey) {
      onSuccess();
    }
    setCreatedKey(null);
    setCopied(false);
    onHide();
  };

  if (createdKey) {
    return (
      <Modal
        show={show}
        onHide={handleClose}
        title={t('API Key Created')}
        maskClosable={false}
        closable={false}
        footer={
          <Button type="primary" onClick={handleClose}>
            {t('Done')}
          </Button>
        }
      >
        <Alert
          type="warning"
          message={t('Save this API key securely')}
          description={t(
            'This is the only time you will see this key. Store it securely.',
          )}
          showIcon
          css={css`
            margin-bottom: ${theme.sizeUnit * 4}px;
          `}
        />
        <div
          css={css`
            display: flex;
            gap: ${theme.sizeUnit * 2}px;
            align-items: center;
          `}
        >
          <Input
            value={createdKey}
            readOnly
            css={css`
              flex: 1;
              font-family: monospace;
            `}
          />
          <Button onClick={handleCopyKey}>
            {copied ? t('Copied!') : t('Copy')}
          </Button>
        </div>
        {createdKeyExtra?.(createdKey)}
      </Modal>
    );
  }

  return (
    <FormModal
      show={show}
      onHide={handleClose}
      title={t('Create API Key')}
      onSave={() => {}}
      formSubmitHandler={handleFormSubmit}
      requiredFields={['name']}
      initialValues={initialScopes ? { scopes: initialScopes } : undefined}
    >
      <FormItem
        name="name"
        label={t('Name')}
        rules={[{ required: true, message: t('API key name is required') }]}
      >
        <Input
          name="name"
          placeholder={t('e.g., CI/CD Pipeline, Analytics Script')}
        />
      </FormItem>
      <FormItem
        name="scopes"
        label={t('MCP scopes')}
        help={getApiKeyScopesHelpText()}
      >
        <Select
          name="scopes"
          mode="multiple"
          allowClear
          showSearch
          options={scopeOptions}
          placeholder={t('Select MCP resource scopes (optional)')}
          data-test="api-key-scopes-select"
          getPopupContainer={(trigger: HTMLElement) =>
            trigger.closest<HTMLElement>('.ant-modal-container') ?? trigger
          }
        />
      </FormItem>
    </FormModal>
  );
}
