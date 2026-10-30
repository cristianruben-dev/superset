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
import { Input, Modal, Select } from '@superset-ui/core/components';

export interface MetricFields {
  id?: number;
  metric_name: string;
  verbose_name?: string | null;
  expression: string;
  description?: string | null;
  d3format?: string | null;
}

const Body = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;

    label {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 1.5}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      color: ${theme.colorTextSecondary};
    }

    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${theme.sizeUnit * 3}px;
    }

    .expression textarea {
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeSM}px;
    }

    .hint {
      font-weight: 400;
      color: ${theme.colorTextTertiary};
    }

    .examples {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 1.5}px;

      button {
        all: unset;
        padding: 1px ${theme.sizeUnit * 2}px;
        border-radius: 999px;
        background: ${theme.colorFillTertiary};
        font-family: ${theme.fontFamilyCode};
        font-size: 11px;
        color: ${theme.colorTextSecondary};
        cursor: pointer;

        &:hover {
          background: ${theme.colorPrimaryBg};
          color: ${theme.colorPrimary};
        }
      }
    }
  `}
`;

const formatOptions = () => [
  { value: '', label: t('Automatic') },
  { value: ',d', label: t('Whole number (12,345)') },
  { value: ',.2f', label: t('Decimal (12,345.68)') },
  { value: '.1%', label: t('Percentage (12.3%)') },
  { value: '$,.2f', label: t('Currency ($12,345.68)') },
  { value: '.3s', label: t('Short (12.3k)') },
];

export interface MetricModalProps {
  show: boolean;
  metric?: MetricFields;
  /** Columns offered as quick examples for the expression */
  columns: string[];
  takenNames: string[];
  onHide: () => void;
  onSave: (metric: MetricFields) => Promise<void>;
}

/** Create or edit a metric: a named SQL aggregate, like a Power BI measure. */
export function MetricModal({
  show,
  metric,
  columns,
  takenNames,
  onHide,
  onSave,
}: MetricModalProps) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [expression, setExpression] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setName(metric?.metric_name || '');
      setLabel(metric?.verbose_name || '');
      setExpression(metric?.expression || '');
      setDescription(metric?.description || '');
      setFormat(metric?.d3format || '');
    }
  }, [show, metric]);

  const trimmedName = name.trim();
  const duplicate =
    trimmedName !== metric?.metric_name && takenNames.includes(trimmedName);
  const valid = !!trimmedName && !!expression.trim() && !duplicate;
  const examples = columns
    .slice(0, 3)
    .flatMap(column => [`SUM(${column})`, `AVG(${column})`]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        id: metric?.id,
        metric_name: trimmedName,
        verbose_name: label.trim() || null,
        expression: expression.trim(),
        description: description.trim() || null,
        d3format: format || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      name="metric"
      title={metric ? t('Edit metric') : t('New metric')}
      width="560px"
      primaryButtonName={metric ? t('Save') : t('Create')}
      primaryButtonLoading={saving}
      disablePrimaryButton={!valid || saving}
      onHandledPrimaryAction={save}
      destroyOnHidden
    >
      <Body data-test="metric-modal">
        <div className="pair">
          <label htmlFor="metric-name">
            {t('Name')}
            <Input
              id="metric-name"
              value={name}
              maxLength={255}
              placeholder="total_sales"
              status={duplicate ? 'error' : undefined}
              onChange={event => setName(event.target.value)}
              autoFocus
            />
            {duplicate && (
              <span className="hint">{t('Another metric has this name')}</span>
            )}
          </label>
          <label htmlFor="metric-label">
            {t('Display name')}
            <Input
              id="metric-label"
              value={label}
              placeholder={t('Total sales')}
              onChange={event => setLabel(event.target.value)}
            />
          </label>
        </div>
        <label htmlFor="metric-expression" className="expression">
          {t('SQL expression')}
          <Input.TextArea
            id="metric-expression"
            value={expression}
            autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder="SUM(amount)"
            onChange={event => setExpression(event.target.value)}
          />
        </label>
        {examples.length > 0 && (
          <div className="examples">
            {examples.map(example => (
              <button
                key={example}
                type="button"
                onClick={() => setExpression(example)}
              >
                {example}
              </button>
            ))}
          </div>
        )}
        <div className="pair">
          <label htmlFor="metric-format">
            {t('Number format')}
            <Select
              ariaLabel={t('Number format')}
              options={formatOptions()}
              value={format}
              onChange={value => setFormat((value as string) || '')}
            />
          </label>
          <label htmlFor="metric-description">
            {t('Description')}
            <Input
              id="metric-description"
              value={description}
              placeholder={t('Optional')}
              onChange={event => setDescription(event.target.value)}
            />
          </label>
        </div>
      </Body>
    </Modal>
  );
}
