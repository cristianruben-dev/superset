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
import { Button } from '@superset-ui/core/components';
import { ColorField, RangeField, Section } from './controls';
import { CELL } from './types';
import { DEFAULT_GRID, useGridSettings } from './gridGuides';

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

/** Style the grid edit mode draws behind the visuals. */
export function GridSection() {
  const theme = useTheme();
  const [grid, update] = useGridSettings();

  return (
    <Section data-test="mibi-format-grid">
      <h4>{t('Grid')}</h4>
      <ColorField
        label={t('Color')}
        value={grid.color || theme.colorPrimary}
        onChange={color => update({ color })}
        testId="mibi-format-grid-color"
      />
      <RangeField
        label={t('Opacity')}
        value={grid.opacity}
        min={5}
        max={100}
        unit="%"
        onChange={opacity => update({ opacity })}
        testId="mibi-format-grid-opacity"
      />
      <Hint>
        {t(
          'Only you see the grid, while editing. Each square is %s px, and objects are placed and sized in whole squares.',
          CELL,
        )}
      </Hint>
      <Button
        buttonStyle="link"
        onClick={() => update({ ...DEFAULT_GRID, color: undefined })}
        data-test="mibi-format-grid-reset"
      >
        {t('Reset grid')}
      </Button>
    </Section>
  );
}
