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
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject } from '@superset-ui/core';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
} from '@superset-ui/core/components';
import { logging } from '@apache-superset/core/utils';
import {
  applyThemeToDashboards,
  listThemes,
  type FormatTheme,
} from 'src/mibi/format/themes';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  createWorkspace,
  DEFAULT_WORKSPACE_COLOR,
  deleteWorkspaceImage,
  updateWorkspace,
  uploadWorkspaceImage,
  WORKSPACE_COLORS,
  type Workspace,
} from './api';
import { WorkspaceAvatar } from './WorkspaceAvatar';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const Body = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 5}px;

    .picture {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 4}px;
      padding: ${theme.sizeUnit * 4}px;
      border-radius: ${theme.borderRadiusLG}px;
      background: ${theme.colorFillQuaternary};
      border: 1px dashed ${theme.colorBorder};
      transition:
        border-color ${theme.motionDurationMid},
        background ${theme.motionDurationMid};

      &.dragging {
        border-color: ${theme.colorPrimary};
        background: ${theme.colorPrimaryBg};
      }
    }

    .picture-copy {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit}px;
      min-width: 0;

      strong {
        font-weight: ${theme.fontWeightStrong};
      }

      span {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
      }
    }

    .picture-actions {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      margin-top: ${theme.sizeUnit * 2}px;
    }

    label.field,
    div.field {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 1.5}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      color: ${theme.colorTextSecondary};
    }

    .color-field {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 2}px;
    }

    .color-label {
      font-size: ${theme.fontSizeSM}px;
      font-weight: 500;
      color: ${theme.colorTextSecondary};
    }

    .theme-hint {
      font-weight: 400;
      color: ${theme.colorTextTertiary};
    }

    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 2}px;
    }

    .swatch {
      all: unset;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px ${theme.colorBorderSecondary};
      transition: transform ${theme.motionDurationFast};

      &:hover {
        transform: scale(1.1);
      }

      &[aria-checked='true'] {
        box-shadow:
          0 0 0 2px ${theme.colorBgElevated},
          0 0 0 4px ${theme.colorText};
      }

      &:focus-visible {
        outline: 2px solid ${theme.colorPrimaryBorder};
        outline-offset: 3px;
      }
    }
  `}
`;

export interface WorkspaceModalProps {
  show: boolean;
  /** The workspace to edit; a new one is created when it is missing */
  workspace?: Workspace;
  onHide: () => void;
  onSaved: (workspace: Workspace) => void;
}

/** Create or edit a workspace: picture, name, description and color. */
export function WorkspaceModal({
  show,
  workspace,
  onHide,
  onSaved,
}: WorkspaceModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEFAULT_WORKSPACE_COLOR);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [themes, setThemes] = useState<FormatTheme[]>();
  const [themeId, setThemeId] = useState<number | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setName(workspace?.name || '');
      setDescription(workspace?.description || '');
      setColor(workspace?.color || DEFAULT_WORKSPACE_COLOR);
      setFile(null);
      setRemoveImage(false);
      setThemeId(workspace?.format_theme_id ?? null);
      setApplyToAll(false);
    }
  }, [show, workspace]);

  useEffect(() => {
    if (!show) return;
    listThemes()
      .then(setThemes)
      .catch(error => {
        logging.error(error);
        setThemes([]);
      });
  }, [show]);

  const fileUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl],
  );

  const imageUrl =
    fileUrl || (removeImage ? null : workspace?.image_url || null);

  const pick = (candidate?: File | null) => {
    if (!candidate) return;
    if (!IMAGE_TYPES.includes(candidate.type)) {
      addDangerToast(t('Use a PNG, JPEG, GIF or WebP image'));
      return;
    }
    if (candidate.size > MAX_IMAGE_BYTES) {
      addDangerToast(t('The image is larger than 2 MB'));
      return;
    }
    setFile(candidate);
    setRemoveImage(false);
  };

  const save = async () => {
    const fields = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      format_theme_id: themeId,
    };
    setSaving(true);
    try {
      let saved = workspace
        ? await updateWorkspace(workspace.id, fields)
        : await createWorkspace(fields);
      if (file) {
        saved = await uploadWorkspaceImage(saved.id, file);
      } else if (removeImage && workspace?.image_url) {
        saved = await deleteWorkspaceImage(saved.id);
      }
      if (themeId && applyToAll && saved.dashboard_ids.length) {
        const applied = await applyThemeToDashboards(
          themeId,
          saved.dashboard_ids,
        );
        addSuccessToast(
          t(
            'Theme applied to %s of %s dashboards',
            applied.length,
            saved.dashboard_ids.length,
          ),
        );
      }
      addSuccessToast(
        workspace ? t('Workspace updated') : t('Workspace created'),
      );
      onSaved(saved);
    } catch (error) {
      const { error: message } = await getClientErrorObject(error);
      addDangerToast(message || t('The workspace could not be saved'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      name="workspace"
      title={workspace ? t('Edit workspace') : t('New workspace')}
      width="520px"
      primaryButtonName={workspace ? t('Save') : t('Create')}
      primaryButtonLoading={saving}
      disablePrimaryButton={!name.trim() || saving}
      onHandledPrimaryAction={save}
      destroyOnHidden
    >
      <Body data-test="workspace-modal">
        <div
          className={dragging ? 'picture dragging' : 'picture'}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files?.[0]);
          }}
        >
          <WorkspaceAvatar
            workspace={{
              name: name || t('Workspace'),
              color,
              image_url: imageUrl,
            }}
            size="xl"
          />
          <div className="picture-copy">
            <strong>{t('Workspace picture')}</strong>
            <span>
              {t(
                'Drag an image here, or upload one. PNG, JPEG or WebP up to 2 MB.',
              )}
            </span>
            <div className="picture-actions">
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                icon={<Icons.UploadOutlined />}
                onClick={() => inputRef.current?.click()}
              >
                {imageUrl ? t('Change') : t('Upload')}
              </Button>
              {imageUrl && (
                <Button
                  buttonStyle="link"
                  buttonSize="small"
                  onClick={() => {
                    setFile(null);
                    setRemoveImage(true);
                  }}
                >
                  {t('Remove picture')}
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_TYPES.join(',')}
              hidden
              data-test="workspace-image-input"
              onChange={event => {
                pick(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>
        </div>
        <label className="field" htmlFor="workspace-name">
          {t('Name')}
          <Input
            id="workspace-name"
            value={name}
            maxLength={250}
            placeholder={t('E.g. Sales, Finance, Operations')}
            onChange={event => setName(event.target.value)}
            onPressEnter={() => name.trim() && !saving && save()}
            autoFocus
          />
        </label>
        <label className="field" htmlFor="workspace-description">
          {t('Description')}
          <Input.TextArea
            id="workspace-description"
            value={description}
            maxLength={1000}
            showCount
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder={t('What is this workspace for?')}
            onChange={event => setDescription(event.target.value)}
          />
        </label>
        <div className="field">
          {t('Format theme')}
          <Select
            ariaLabel={t('Format theme')}
            allowClear
            loading={themes === undefined}
            value={themeId ?? undefined}
            placeholder={t('No theme')}
            onChange={value => setThemeId((value as number) ?? null)}
            onClear={() => setThemeId(null)}
            options={(themes ?? []).map(item => ({
              value: item.id,
              label: item.name,
            }))}
            data-test="workspace-theme"
          />
          <span className="theme-hint">
            {t(
              'New dashboards of this workspace start with it. Save themes from the Format pane of a dashboard.',
            )}
          </span>
        </div>
        {!!themeId && !!workspace?.dashboard_ids.length && (
          <Checkbox
            checked={applyToAll}
            onChange={event => setApplyToAll(event.target.checked)}
            data-test="workspace-theme-apply-all"
          >
            {t(
              'Also apply it to the %s dashboards it has',
              workspace.dashboard_ids.length,
            )}
          </Checkbox>
        )}
        <div className="color-field">
          <span className="color-label">{t('Color')}</span>
          <div className="swatches" role="radiogroup" aria-label={t('Color')}>
            {WORKSPACE_COLORS.map((swatch, index) => (
              <button
                key={swatch}
                id={`workspace-color-${index}`}
                type="button"
                role="radio"
                aria-checked={swatch === color}
                aria-label={swatch}
                className="swatch"
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
              />
            ))}
          </div>
        </div>
      </Body>
    </Modal>
  );
}
