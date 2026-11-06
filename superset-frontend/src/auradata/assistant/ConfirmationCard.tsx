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
import { Fragment } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { confirmationTitle } from './confirmations';
import type { Confirmation } from './types';

const Card = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 3}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};
  `}
`;

const Title = styled.strong`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    font-weight: ${theme.fontWeightStrong};

    .anticon {
      color: ${theme.colorWarning};
    }
  `}
`;

const Facts = styled.dl`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr);
    gap: ${theme.sizeUnit}px ${theme.sizeUnit * 3}px;
    margin: 0;
    font-size: ${theme.fontSizeSM}px;

    dt {
      font-family: ${theme.fontFamilyCode};
      color: ${theme.colorTextTertiary};
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  `}
`;

const Fold = styled.details`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};

    summary {
      border-radius: ${theme.sizeUnit}px;
      cursor: pointer;
    }
    summary:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
  `}
`;

const Details = styled.pre`
  ${({ theme }) => css`
    max-height: ${theme.sizeUnit * 40}px;
    margin: ${theme.sizeUnit * 2}px 0 0;
    padding: ${theme.sizeUnit * 2}px;
    overflow: auto;
    border-radius: ${theme.sizeUnit * 2}px;
    background: ${theme.colorFillTertiary};
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  `}
`;

const Actions = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

/** The plain values of a call, which is what a person can read at a glance. */
const factsOf = (input: Record<string, unknown>) => {
  const request = input.request;
  const fields =
    request && typeof request === 'object'
      ? (request as Record<string, unknown>)
      : input;
  return Object.entries(fields).filter(
    ([, value]) => typeof value === 'string' || typeof value === 'number',
  );
};

/**
 * Asks a person about one call of the assistant. What it will do shows exactly as
 * the server stored it, as plain text: the model wrote it, so nothing in it can act
 * as a link or as markup.
 */
export function ConfirmationCard({
  confirmation,
  disabled,
  onDecide,
}: {
  confirmation: Confirmation;
  disabled: boolean;
  onDecide: (approved: boolean) => void;
}) {
  const facts = factsOf(confirmation.input);
  return (
    <Card data-test="auradata-assistant-confirmation">
      <Title>
        <Icons.ExclamationCircleOutlined iconSize="m" />
        {confirmationTitle(confirmation)}
      </Title>
      {facts.length > 0 && (
        <Facts>
          {facts.map(([name, value]) => (
            <Fragment key={name}>
              <dt>{name}</dt>
              <dd>{String(value)}</dd>
            </Fragment>
          ))}
        </Facts>
      )}
      <Fold>
        <summary>{t('The exact call')}</summary>
        <Details data-test="auradata-assistant-confirmation-details">
          {JSON.stringify(confirmation.input, null, 2)}
        </Details>
      </Fold>
      <Actions>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          disabled={disabled}
          onClick={() => onDecide(false)}
          data-test="auradata-assistant-reject"
        >
          {t('Reject')}
        </Button>
        <Button
          buttonStyle="primary"
          buttonSize="small"
          disabled={disabled}
          onClick={() => onDecide(true)}
          data-test="auradata-assistant-approve"
        >
          {t('Approve')}
        </Button>
      </Actions>
    </Card>
  );
}
