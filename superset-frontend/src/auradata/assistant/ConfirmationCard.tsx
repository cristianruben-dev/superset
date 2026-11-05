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
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { confirmationTitle } from './confirmations';
import type { Confirmation } from './types';

const Card = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px;
    border: 1px solid ${theme.colorWarningBorder};
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorWarningBg};
  `}
`;

const Title = styled.strong`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const Details = styled.pre`
  ${({ theme }) => css`
    max-height: ${theme.sizeUnit * 40}px;
    margin: 0;
    overflow: auto;
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
  return (
    <Card data-test="auradata-assistant-confirmation">
      <Title>{confirmationTitle(confirmation)}</Title>
      <Details data-test="auradata-assistant-confirmation-details">
        {JSON.stringify(confirmation.input, null, 2)}
      </Details>
      <Actions>
        <Button
          buttonStyle="secondary"
          disabled={disabled}
          onClick={() => onDecide(false)}
          data-test="auradata-assistant-reject"
        >
          {t('Reject')}
        </Button>
        <Button
          buttonStyle="primary"
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
