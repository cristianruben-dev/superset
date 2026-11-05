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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';

const Notice = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px;

    h3 {
      margin: 0;
      font-size: ${theme.fontSizeLG}px;
      font-weight: ${theme.fontWeightStrong};
    }
    p,
    ul {
      margin: 0;
    }
    ul {
      padding-left: ${theme.sizeUnit * 5}px;
    }
    button {
      align-self: flex-start;
    }
  `}
`;

/**
 * What the assistant sends to Anthropic, the first time someone opens it. The answer is
 * kept on the server, for the person, and the server sends nothing until it has it. When
 * this text changes, `PRIVACY_NOTICE_VERSION` in `governance.py` changes with it.
 */
export function PrivacyNotice({ onAccept }: { onAccept: () => Promise<void> }) {
  const { addDangerToast } = useToasts();
  const [saving, setSaving] = useState(false);

  const accept = () => {
    setSaving(true);
    onAccept().catch(() => {
      setSaving(false);
      addDangerToast(t('Your answer could not be saved. Try again.'));
    });
  };

  return (
    <Notice data-test="auradata-assistant-privacy">
      <h3>{t('Before you start')}</h3>
      <p>
        {t(
          'The assistant runs on Claude, from Anthropic. To answer you, this travels to the Anthropic API:',
        )}
      </p>
      <ul>
        <li>{t('What you write, and the conversation so far.')}</li>
        <li>
          {t('The report, page, filters and selection you have on screen.')}
        </li>
        <li>
          {t(
            'The data it reads to answer, data rows included. It sees what you can see, and nothing more.',
          )}
        </li>
      </ul>
      <p>
        {t(
          'Your conversations are kept on this server, and only you can open them. Nothing is sent until you accept.',
        )}
      </p>
      <Button
        buttonStyle="primary"
        onClick={accept}
        loading={saving}
        data-test="auradata-assistant-accept"
      >
        {t('I understand, continue')}
      </Button>
    </Notice>
  );
}
