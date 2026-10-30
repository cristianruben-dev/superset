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
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject } from '@superset-ui/core';
import {
  AsyncSelect,
  Button,
  Loading,
  Modal,
  Select,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import getBootstrapData from 'src/utils/getBootstrapData';
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  searchMemberCandidates,
  setWorkspaceMember,
  userInitials,
  userName,
  WORKSPACE_ROLES,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
} from './api';
import { RoleBadge, roleDescription, roleLabel } from './roles';

const Body = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 5}px;

    .add {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;

      .people {
        flex: 1;
        min-width: 0;
      }

      .role {
        width: 150px;
      }
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      color: ${theme.colorTextSecondary};
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .members {
      display: flex;
      flex-direction: column;
      max-height: 340px;
      overflow-y: auto;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.borderRadiusLG}px;
    }

    .member {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 2.5}px ${theme.sizeUnit * 3}px;

      & + .member {
        border-top: 1px solid ${theme.colorBorderSecondary};
      }
    }

    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        ${theme.colorPrimaryHover},
        ${theme.colorPrimaryActive}
      );
      color: ${theme.colorTextLightSolid};
      font-size: 13px;
      font-weight: 600;
    }

    .who {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;

      .name {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .username {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextTertiary};
      }

      .you {
        margin-left: ${theme.sizeUnit * 1.5}px;
        font-size: ${theme.fontSizeSM}px;
        font-weight: 400;
        color: ${theme.colorTextTertiary};
      }
    }

    .member-role {
      width: 140px;
    }

    .roles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: ${theme.sizeUnit * 2}px;
    }

    .role-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: ${theme.sizeUnit * 1.5}px;
      padding: ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadius}px;
      background: ${theme.colorFillQuaternary};
      font-size: ${theme.fontSizeSM}px;
      line-height: 1.45;
      color: ${theme.colorTextSecondary};
    }

    .note {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};

      .anticon {
        margin-top: 2px;
      }
    }
  `}
`;

const roleOptions = () =>
  WORKSPACE_ROLES.map(role => ({ value: role, label: roleLabel(role) }));

export interface WorkspaceAccessModalProps {
  show: boolean;
  workspace: Workspace;
  onHide: () => void;
  /** The workspace after a change, or null when the user left it */
  onChanged: (workspace: Workspace | null) => void;
}

/** Who belongs to a workspace and with which role; admins change it. */
export function WorkspaceAccessModal({
  show,
  workspace,
  onHide,
  onChanged,
}: WorkspaceAccessModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [person, setPerson] = useState<{ value: number; label: string } | null>(
    null,
  );
  const [newRole, setNewRole] = useState<WorkspaceRole>('viewer');
  const [busy, setBusy] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const myId = getBootstrapData().user?.userId;
  const canManage = workspace.can_edit;
  const adminCount = (members || []).filter(m => m.role === 'admin').length;

  const load = useCallback(() => {
    fetchWorkspaceMembers(workspace.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [workspace.id]);

  useEffect(() => {
    if (show) {
      setMembers(null);
      setPerson(null);
      setNewRole('viewer');
      load();
    }
  }, [show, load]);

  const run = async (action: () => Promise<Workspace | null>, done: string) => {
    setBusy(true);
    try {
      const updated = await action();
      addSuccessToast(done);
      onChanged(updated);
      if (updated) load();
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(message || t('The change could not be saved'));
    } finally {
      setBusy(false);
    }
  };

  const loadPeople = useCallback(
    async (search: string) => {
      const users = await searchMemberCandidates(workspace.id, search);
      return {
        data: users.map(user => ({
          value: user.id,
          label: `${userName(user)} (${user.username})`,
        })),
        totalCount: users.length,
      };
    },
    [workspace.id],
  );

  const add = () =>
    person &&
    run(async () => {
      const updated = await setWorkspaceMember(workspace.id, person.value, newRole);
      setPerson(null);
      setSearchKey(key => key + 1);
      return updated;
    }, t('%s was added to the workspace', person.label));

  const lastAdmin = (member: WorkspaceMember) =>
    member.role === 'admin' && adminCount === 1;

  return (
    <Modal
      show={show}
      onHide={onHide}
      name="workspace-access"
      title={t('Access to %s', workspace.name)}
      width="640px"
      hideFooter
      destroyOnHidden
    >
      <Body data-test="workspace-access">
        {canManage && (
          <div>
            <div className="section-title">{t('Add people')}</div>
            <div className="add">
              <AsyncSelect
                key={searchKey}
                className="people"
                ariaLabel={t('Search people')}
                placeholder={t('Search by name, user or email')}
                options={loadPeople}
                value={person}
                labelInValue
                onChange={value =>
                  setPerson(value as { value: number; label: string } | null)
                }
                allowClear
              />
              <Select
                className="role"
                ariaLabel={t('Role')}
                options={roleOptions()}
                value={newRole}
                onChange={value => setNewRole(value as WorkspaceRole)}
              />
              <Button
                buttonStyle="primary"
                disabled={!person || busy}
                onClick={add}
              >
                {t('Add')}
              </Button>
            </div>
          </div>
        )}

        <div>
          <div className="section-title">
            {members
              ? tn('%s member', '%s members', members.length, members.length)
              : t('Members')}
          </div>
          <div className="members" data-test="workspace-members">
            {members === null && <Loading position="inline-centered" />}
            {members?.map(member => {
              const isMe = member.id === myId;
              return (
                <div className="member" key={member.id}>
                  <span className="avatar">{userInitials(member)}</span>
                  <span className="who">
                    <span className="name">
                      {userName(member) || member.username}
                      {isMe && <span className="you">{t('(you)')}</span>}
                    </span>
                    <span className="username">{member.username}</span>
                  </span>
                  {canManage ? (
                    <Tooltip
                      title={
                        lastAdmin(member)
                          ? t('A workspace needs at least one admin')
                          : undefined
                      }
                    >
                      <span>
                        <Select
                          className="member-role"
                          ariaLabel={t('Role of %s', userName(member))}
                          options={roleOptions()}
                          value={member.role}
                          disabled={busy || lastAdmin(member)}
                          onChange={value =>
                            run(
                              () =>
                                setWorkspaceMember(
                                  workspace.id,
                                  member.id,
                                  value as WorkspaceRole,
                                ),
                              t('Role updated'),
                            )
                          }
                        />
                      </span>
                    </Tooltip>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                  {(canManage || isMe) && (
                    <Tooltip
                      title={
                        lastAdmin(member)
                          ? t('A workspace needs at least one admin')
                          : isMe
                            ? t('Leave the workspace')
                            : t('Remove from the workspace')
                      }
                    >
                      <span>
                        <Button
                          buttonStyle="link"
                          buttonSize="small"
                          aria-label={
                            isMe
                              ? t('Leave the workspace')
                              : t('Remove %s', userName(member))
                          }
                          disabled={busy || lastAdmin(member)}
                          onClick={() =>
                            run(
                              () => removeWorkspaceMember(workspace.id, member.id),
                              isMe
                                ? t('You left the workspace')
                                : t('%s was removed', userName(member)),
                            )
                          }
                        >
                          {isMe ? (
                            <Icons.ExportOutlined iconSize="m" />
                          ) : (
                            <Icons.CloseOutlined iconSize="m" />
                          )}
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="roles">
          {WORKSPACE_ROLES.map(role => (
            <div className="role-card" key={role}>
              <RoleBadge role={role} />
              {roleDescription(role)}
            </div>
          ))}
        </div>
        <div className="note">
          <Icons.InfoCircleOutlined iconSize="m" />
          {t(
            'Dashboards in a workspace are only visible to its members. To see the data, people also need access to the datasets.',
          )}
        </div>
      </Body>
    </Modal>
  );
}
