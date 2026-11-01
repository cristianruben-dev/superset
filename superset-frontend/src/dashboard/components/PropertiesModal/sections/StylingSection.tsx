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
import { styled } from '@apache-superset/core/theme';
import { Switch } from '@superset-ui/core/components';
import { EditorHost } from 'src/core/editors';
import ColorSchemeSelect from 'src/dashboard/components/ColorSchemeSelect';
import { ModalFormField } from 'src/components/Modal';

const StyledEditorHost = styled(EditorHost)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colorBorder};
`;

const StyledSwitchContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    margin-bottom: ${theme.sizeUnit * 4}px;

    .switch-row {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
    }

    .switch-label {
      color: ${theme.colorText};
      font-size: ${theme.fontSize}px;
    }

    .switch-helper {
      display: block;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
      margin-top: ${theme.sizeUnit}px;
    }
  `}
`;

interface StylingSectionProps {
  colorScheme?: string;
  customCss: string;
  hasCustomLabelsColor: boolean;
  showChartTimestamps: boolean;
  onColorSchemeChange: (
    colorScheme: string,
    options?: { updateMetadata?: boolean },
  ) => void;
  onCustomCssChange: (css: string) => void;
  onShowChartTimestampsChange: (value: boolean) => void;
}

const StylingSection = ({
  colorScheme,
  customCss,
  hasCustomLabelsColor,
  showChartTimestamps,
  onColorSchemeChange,
  onCustomCssChange,
  onShowChartTimestampsChange,
}: StylingSectionProps) => (
  <>
    <ModalFormField
      label={t('Color scheme')}
      testId="dashboard-colorscheme-field"
      helperText={t(
        "Any color palette selected here will override the colors applied to this dashboard's individual charts",
      )}
    >
      <ColorSchemeSelect
        data-test="dashboard-colorscheme-select"
        value={colorScheme}
        onChange={onColorSchemeChange}
        hasCustomLabelsColor={hasCustomLabelsColor}
        showWarning={hasCustomLabelsColor}
      />
    </ModalFormField>
    <StyledSwitchContainer data-test="dashboard-show-timestamps-field">
      <div className="switch-row">
        <Switch
          data-test="dashboard-show-timestamps-switch"
          checked={showChartTimestamps}
          onChange={onShowChartTimestampsChange}
        />
        <span className="switch-label">{t('Show chart query timestamps')}</span>
      </div>
      <span className="switch-helper">
        {t(
          'Display the last queried timestamp on charts in the dashboard view',
        )}
      </span>
    </StyledSwitchContainer>
    <ModalFormField
      label={t('CSS')}
      testId="dashboard-css-field"
      helperText={t(
        'Apply custom CSS to the dashboard. Use class names or element selectors to target specific components.',
      )}
      bottomSpacing={false}
    >
      <StyledEditorHost
        id="dashboard-css-editor"
        data-test="dashboard-css-editor"
        onChange={onCustomCssChange}
        value={customCss}
        language="css"
        width="100%"
        height="160px"
      />
    </ModalFormField>
  </>
);

export default StylingSection;
