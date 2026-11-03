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
import { useMemo } from 'react';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';
import { NAVBAR_MENU_POPUP_OFFSET } from './commonMenuData';

export interface Languages {
  [key: string]: {
    flag: string;
    url: string;
    name: string;
  };
}

interface LanguagePickerProps {
  locale: string;
  languages: Languages;
}

const StyledLabel = styled.div`
  & a {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.sizeUnit * 2}px;
    line-height: inherit;
    text-decoration: none;
  }

  & .current-language {
    margin-left: auto;
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

export const useLanguageMenuItems = ({
  locale,
  languages,
}: LanguagePickerProps): MenuItem =>
  useMemo(() => {
    const items: MenuItem[] = Object.keys(languages).map(langKey => ({
      key: langKey,
      label: (
        <StyledLabel className="f16">
          <Typography.Link href={languages[langKey].url}>
            <i className={`flag ${languages[langKey].flag}`} />
            {languages[langKey].name}
            {langKey === locale && (
              <Icons.CheckOutlined className="current-language" iconSize="s" />
            )}
          </Typography.Link>
        </StyledLabel>
      ),
    }));

    return {
      key: 'language-submenu',
      type: 'submenu' as const,
      label: (
        <span className="f16" aria-label={t('Languages')}>
          <i className={`flag ${languages[locale].flag}`} />
        </span>
      ),
      icon: <Icons.DownOutlined iconSize="xs" />,
      children: [
        {
          type: 'group' as const,
          label: t('Language'),
          key: 'language-group',
          children: items,
        },
      ],
      className: 'submenu-with-caret',
      popupClassName: 'language-picker-popup',
      popupOffset: NAVBAR_MENU_POPUP_OFFSET,
    };
  }, [languages, locale]);
