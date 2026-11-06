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
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import getBootstrapData from 'src/utils/getBootstrapData';
import { parseServerDate } from './conversationGroups';
import type { ArtifactDocument } from './types';

const Mark = styled.p`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    margin: 0 0 ${theme.sizeUnit * 3}px;
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeXS ?? theme.fontSizeSM}px;
    line-height: 1.5;
    color: ${theme.colorTextTertiary};
  `}
`;

const Note = styled.aside`
  ${({ theme }) => css`
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    margin-bottom: ${theme.sizeUnit * 6}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-left: 2px solid ${theme.colorPrimary};
    border-radius: 0 ${theme.sizeUnit}px ${theme.sizeUnit}px 0;
    background: ${theme.colorFillTertiary};
    font-size: ${theme.fontSizeSM}px;
    line-height: 1.5;
    color: ${theme.colorTextSecondary};

    .anticon {
      margin-top: ${theme.sizeUnit / 2}px;
      color: ${theme.colorPrimary};
    }
  `}
`;

const dateOf = (value: string) =>
  new Intl.DateTimeFormat(getBootstrapData().common?.locale || 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parseServerDate(value));

/** Says who made a document: the assistant, and with which model. */
export function DocumentMark({ model }: { model?: string | null }) {
  return (
    <Mark data-test="auradata-document-mark">
      <Icons.BulbOutlined iconSize="s" />
      {model
        ? t('Made by the assistant (model %s)', model)
        : t('Made by the assistant')}
    </Mark>
  );
}

/** Tells a reader that the text is the author's and the figures are theirs. */
export function ReaderNote({ document }: { document: ArtifactDocument }) {
  const hidden = document.blocks.filter(
    block => block.type === 'refused',
  ).length;
  return (
    <Note data-test="auradata-document-reader-note">
      <Icons.InfoCircleOutlined iconSize="s" />
      <div>
        {t(
          'Written by %s on %s, with the access %s had. Figures in charts and tables are read with your permissions; the text stays as it was written, and it may mention data you cannot see.',
          document.author ?? t('its author'),
          document.written_on
            ? dateOf(document.written_on)
            : dateOf(document.created_on),
          document.author ?? t('its author'),
        )}{' '}
        {hidden > 0 &&
          tn(
            '%s part is hidden from you.',
            '%s parts are hidden from you.',
            hidden,
            hidden,
          )}
      </div>
    </Note>
  );
}
