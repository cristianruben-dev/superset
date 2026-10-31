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
import { useDispatch, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject } from '@superset-ui/core';
import {
  Button,
  Input,
  Popconfirm,
  Select,
  Switch,
} from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { RootState } from 'src/dashboard/types';
import { setSharedVisualFormat } from './actions';
import { Field, Section } from './controls';
import {
  applyTheme,
  currentTheme,
  deleteTheme,
  listThemes,
  saveTheme,
  updateTheme,
  type FormatTheme,
} from './themes';
import { useSharedVisualFormat } from './useVisualFormat';

const Box = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;

    .row {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
    }

    .grow {
      flex: 1;
      min-width: 0;
    }

    .shared {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const errorText = async (error: unknown, fallback: string) => {
  logging.error(error);
  const { message, error: text } = await getClientErrorObject(
    error as Parameters<typeof getClientErrorObject>[0],
  );
  return (typeof message === 'string' && message) || text || fallback;
};

/** Pick, apply, save and manage format themes, on top of the canvas tab. */
export function ThemeSection() {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const { addDangerToast, addSuccessToast } = useToasts();
  const shared = useSharedVisualFormat();
  const [themes, setThemes] = useState<FormatTheme[]>();
  const [selectedId, setSelectedId] = useState<number>();
  const [resetCharts, setResetCharts] = useState(true);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = themes?.find(theme => theme.id === selectedId);

  const load = useCallback(async () => {
    try {
      setThemes(await listThemes());
    } catch (error) {
      logging.error(error);
      setThemes([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const apply = () => {
    if (!selected) return;
    dispatch(applyTheme(selected.theme, { resetCharts }));
    addSuccessToast(t('Theme "%s" applied', selected.name));
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const theme = await saveTheme(trimmed, currentTheme(store.getState()));
      setThemes(current =>
        [...(current ?? []), theme].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setSelectedId(theme.id);
      setNaming(false);
      setName('');
      addSuccessToast(t('Theme "%s" saved', theme.name));
    } catch (error) {
      addDangerToast(await errorText(error, t('The theme could not be saved')));
    } finally {
      setBusy(false);
    }
  };

  const overwrite = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const theme = await updateTheme(selected.id, {
        theme: currentTheme(store.getState()),
      });
      setThemes(current =>
        current?.map(item => (item.id === theme.id ? theme : item)),
      );
      addSuccessToast(t('Theme "%s" updated', theme.name));
    } catch (error) {
      addDangerToast(
        await errorText(error, t('The theme could not be updated')),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteTheme(selected.id);
      setThemes(current => current?.filter(item => item.id !== selected.id));
      setSelectedId(undefined);
    } catch (error) {
      addDangerToast(
        await errorText(error, t('The theme could not be deleted')),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section data-test="mibi-format-theme">
      <h4>{t('Theme')}</h4>
      <Box>
        <div className="row">
          <Select
            className="grow"
            ariaLabel={t('Theme')}
            placeholder={
              themes?.length === 0 ? t('No saved themes') : t('Choose a theme')
            }
            loading={themes === undefined}
            value={selectedId}
            onChange={value => setSelectedId(value as number)}
            options={(themes ?? []).map(theme => ({
              value: theme.id,
              label: theme.name,
            }))}
            data-test="mibi-theme-select"
          />
          <Button
            buttonStyle="primary"
            disabled={!selected}
            onClick={apply}
            data-test="mibi-theme-apply"
          >
            {t('Apply')}
          </Button>
        </div>
        <Field label={t("Replace each chart's own style")}>
          <Switch
            size="small"
            checked={resetCharts}
            aria-label={t("Replace each chart's own style")}
            onChange={setResetCharts}
          />
        </Field>
        {selected?.can_edit && (
          <div className="row">
            <Button
              className="grow"
              buttonStyle="secondary"
              loading={busy}
              onClick={overwrite}
              data-test="mibi-theme-update"
            >
              {t('Update with this design')}
            </Button>
            <Popconfirm
              title={t('Delete the theme "%s"?', selected.name)}
              description={t('Dashboards keep the style it gave them.')}
              okText={t('Delete')}
              cancelText={t('Cancel')}
              onConfirm={remove}
            >
              <Button buttonStyle="link" data-test="mibi-theme-delete">
                {t('Delete')}
              </Button>
            </Popconfirm>
          </div>
        )}
        {naming ? (
          <div className="row">
            <Input
              className="grow"
              autoFocus
              maxLength={250}
              value={name}
              placeholder={t('Theme name')}
              aria-label={t('Theme name')}
              onChange={event => setName(event.target.value)}
              onPressEnter={save}
              onKeyDown={event => {
                if (event.key === 'Escape') setNaming(false);
              }}
              data-test="mibi-theme-name"
            />
            <Button
              buttonStyle="primary"
              loading={busy}
              disabled={!name.trim()}
              onClick={save}
              data-test="mibi-theme-save"
            >
              {t('Save')}
            </Button>
          </div>
        ) : (
          <Button
            buttonStyle="secondary"
            onClick={() => setNaming(true)}
            data-test="mibi-theme-save-as"
          >
            {t('Save this design as a theme')}
          </Button>
        )}
        {shared && (
          <div className="shared" data-test="mibi-shared-style">
            <span>{t('Every chart shares one style.')}</span>
            <Button
              buttonStyle="link"
              onClick={() =>
                dispatch(
                  setSharedVisualFormat(undefined, { resetCharts: false }),
                )
              }
            >
              {t('Remove')}
            </Button>
          </div>
        )}
      </Box>
    </Section>
  );
}
