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
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { ensureStaticPrefix } from 'src/utils/assetUrl';
import { AURA_GRADIENT, PRODUCT_TAG } from './brand';
import { ProductTag } from './Sidebar';

const Panel = styled.section`
  ${({ theme }) => css`
    flex: 1 1 0;
    max-width: 520px;
    color: ${theme.colorText};

    @media (max-width: 959px) {
      display: none;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      margin-bottom: ${theme.sizeUnit * 12}px;

      img {
        height: 30px;
      }
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 3}px;
      border: 1px solid ${theme.colorBorder};
      border-radius: 999px;
      background: ${theme.colorBgContainer};
      color: ${theme.colorTextSecondary};
      font-family: ${theme.fontFamilyCode};
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;

      &::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${AURA_GRADIENT};
      }
    }

    h1 {
      margin: ${theme.sizeUnit * 6}px 0 ${theme.sizeUnit * 4}px;
      font-size: 52px;
      line-height: 1.04;
      font-weight: ${theme.fontWeightStrong};
      letter-spacing: -0.035em;
      color: ${theme.colorText};

      .accent {
        display: block;
        background: ${AURA_GRADIENT};
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
    }

    p {
      max-width: 420px;
      margin: 0;
      color: ${theme.colorTextSecondary};
      font-size: 17px;
      line-height: 1.55;
    }

    ul {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 5}px;
      margin: ${theme.sizeUnit * 8}px 0 0;
      padding: 0;
      list-style: none;
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSize}px;

      li {
        display: inline-flex;
        align-items: center;
        gap: ${theme.sizeUnit * 1.5}px;
      }

      .anticon {
        color: ${theme.colorSuccess};
      }
    }

    footer {
      margin-top: ${theme.sizeUnit * 14}px;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;

      a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
  `}
`;

/** The AuraData side of the sign in page: logo, promise and highlights. */
export function LoginBrand() {
  const theme = useTheme();
  return (
    <Panel data-test="login-brand">
      <div className="logo">
        {theme.brandLogoUrl && (
          <img
            src={ensureStaticPrefix(theme.brandLogoUrl)}
            alt={theme.brandLogoAlt || ''}
          />
        )}
        <ProductTag>{PRODUCT_TAG}</ProductTag>
      </div>
      <span className="eyebrow">{t('Business analytics')}</span>
      <h1>
        {t('Clear data.')}
        <span className="accent">{t('Precise decisions.')}</span>
      </h1>
      <p>
        {t(
          'Dashboards and reports to understand your operation and decide with data.',
        )}
      </p>
      <ul>
        <li>
          <Icons.CheckOutlined iconSize="s" />
          {t('Live dashboards')}
        </li>
        <li>
          <Icons.CheckOutlined iconSize="s" />
          {t('Shared workspaces')}
        </li>
        <li>
          <Icons.CheckOutlined iconSize="s" />
          {t('PDF and PNG export')}
        </li>
      </ul>
      <footer>
        {t('A product of')}{' '}
        <a href="https://auradata.mx" target="_blank" rel="noreferrer">
          AuraData
        </a>
      </footer>
    </Panel>
  );
}
