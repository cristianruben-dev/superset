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
import { ensureStaticPrefix } from 'src/utils/assetUrl';
import { COMPANY_NAME, PRODUCT_TAG } from './brand';
import { ProductTag } from './Sidebar';

const Logo = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;

    img {
      height: 30px;
    }
  `}
`;

const Footer = styled.footer`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit * 6}px;
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;

    a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  `}
`;

/** The AuraData logo with its product tag, above the sign in form. */
export function LoginLogo() {
  const theme = useTheme();
  return (
    <Logo data-test="login-brand">
      {theme.brandLogoUrl && (
        <img
          src={ensureStaticPrefix(theme.brandLogoUrl)}
          alt={theme.brandLogoAlt || ''}
        />
      )}
      <ProductTag>{PRODUCT_TAG}</ProductTag>
    </Logo>
  );
}

/** The byline under the sign in form. */
export function LoginFooter() {
  return (
    <Footer>
      {t('A product of')}{' '}
      <a href="https://auradata.mx" target="_blank" rel="noreferrer">
        {COMPANY_NAME}
      </a>
    </Footer>
  );
}
