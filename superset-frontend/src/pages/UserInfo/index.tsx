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

import { useCallback, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  SupersetClient,
  FeatureFlag,
  isFeatureEnabled,
} from '@superset-ui/core';
import { css, useTheme, styled } from '@apache-superset/core/theme';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { Descriptions } from 'src/components/Descriptions';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  UserInfoEditModal,
  UserInfoResetPasswordModal,
} from 'src/features/userInfo/UserInfoModal';
import { Icons, Collapse } from '@superset-ui/core/components';
import { ApiKeyList } from 'src/features/apiKeys/ApiKeyList';

const DescriptionsContainer = styled.div`
  ${({ theme }) => css`
    padding: 0 var(--mb-space-gutter) var(--mb-space-gutter);

    &&& > .ant-collapse {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      align-items: start;
      gap: ${theme.sizeUnit * 4}px;
      margin: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    &&& > .ant-collapse > .ant-collapse-item {
      margin: 0;
      border-radius: ${theme.borderRadiusLG}px;
      border: 1px solid ${theme.colorBorderSecondary};
      background: ${theme.colorBgContainer};
    }

    .ant-descriptions-item-label {
      white-space: nowrap;
    }
  `}
`;

const DescriptionTitle = styled.span`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

enum ModalType {
  ResetPassword = 'resetPassword',
  Edit = 'edit',
}

export function UserInfo({ user }: { user: UserWithPermissionsAndRoles }) {
  const theme = useTheme();
  const [modalState, setModalState] = useState({
    resetPassword: false,
    edit: false,
  });
  const openModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: true }));
  const closeModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: false }));
  const { addDangerToast } = useToasts();
  const [userDetails, setUserDetails] = useState(user);

  const getUserDetails = useCallback(() => {
    SupersetClient.get({ endpoint: '/api/v1/me/' })
      .then(({ json }) => {
        const transformedUser = {
          ...json.result,
          firstName: json.result.first_name,
          lastName: json.result.last_name,
        };
        setUserDetails(transformedUser);
      })
      .catch(error => {
        addDangerToast(`${t('Failed to fetch user info')}:`, error);
      });
  }, [userDetails]);

  useEffect(() => {
    getUserDetails();
  }, []);

  const SubMenuButtons: SubMenuProps['buttons'] = [
    {
      name: (
        <>
          <Icons.LockOutlined
            iconColor={theme.colorPrimary}
            iconSize="m"
            css={css`
              margin: auto ${theme.sizeUnit * 2}px auto 0;
              vertical-align: text-top;
            `}
          />
          {t('Reset my password')}
        </>
      ),
      buttonStyle: 'secondary',
      onClick: () => {
        openModal(ModalType.ResetPassword);
      },
      'data-test': 'reset-password-button',
    },
    {
      name: (
        <>
          <Icons.FormOutlined
            iconSize="m"
            css={css`
              margin: auto ${theme.sizeUnit * 2}px auto 0;
              vertical-align: text-top;
            `}
          />
          {t('Edit user')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        openModal(ModalType.Edit);
      },
      'data-test': 'edit-user-button',
    },
  ];

  return (
    <>
      <SubMenu name={t('Your user information')} buttons={SubMenuButtons} />
      <DescriptionsContainer>
        <Collapse
          defaultActiveKey={[
            'userInfo',
            'personalInfo',
            ...(isFeatureEnabled(FeatureFlag.FabApiKeyEnabled)
              ? ['apiKeys']
              : []),
          ]}
          ghost
        >
          <Collapse.Panel
            header={<DescriptionTitle>{t('User info')}</DescriptionTitle>}
            key="userInfo"
          >
            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: '120px' }}
            >
              <Descriptions.Item label={t('User Name')}>
                {user.username}
              </Descriptions.Item>
              <Descriptions.Item label={t('Is Active?')}>
                {user.isActive ? t('Yes') : t('No')}
              </Descriptions.Item>
              <Descriptions.Item label={t('Roles')}>
                {user.roles ? Object.keys(user.roles).join(', ') : t('None')}
              </Descriptions.Item>
              <Descriptions.Item label={t('Groups')}>
                {user.groups.length ? user.groups.join(', ') : t('None')}
              </Descriptions.Item>
              <Descriptions.Item label={t('Login count')}>
                {user.loginCount}
              </Descriptions.Item>
            </Descriptions>
          </Collapse.Panel>
          <Collapse.Panel
            header={<DescriptionTitle>{t('Personal info')}</DescriptionTitle>}
            key="personalInfo"
          >
            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: '120px' }}
            >
              <Descriptions.Item label={t('First Name')}>
                {userDetails.firstName}
              </Descriptions.Item>
              <Descriptions.Item label={t('Last Name')}>
                {userDetails.lastName}
              </Descriptions.Item>
              <Descriptions.Item label={t('Email')}>
                {user.email}
              </Descriptions.Item>
            </Descriptions>
          </Collapse.Panel>
          {isFeatureEnabled(FeatureFlag.FabApiKeyEnabled) && (
            <Collapse.Panel
              header={<DescriptionTitle>{t('API Keys')}</DescriptionTitle>}
              key="apiKeys"
            >
              <ApiKeyList />
            </Collapse.Panel>
          )}
        </Collapse>
      </DescriptionsContainer>
      {modalState.resetPassword && (
        <UserInfoResetPasswordModal
          onHide={() => closeModal(ModalType.ResetPassword)}
          show={modalState.resetPassword}
          onSave={() => {
            closeModal(ModalType.ResetPassword);
          }}
        />
      )}
      {modalState.edit && (
        <UserInfoEditModal
          onHide={() => closeModal(ModalType.Edit)}
          show={modalState.edit}
          onSave={() => {
            closeModal(ModalType.Edit);
            getUserDetails();
          }}
          user={userDetails}
        />
      )}
    </>
  );
}

export default UserInfo;
