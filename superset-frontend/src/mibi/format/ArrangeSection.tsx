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

import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import {
  alignObjects,
  distributeObjects,
  GROUP_KEY,
  groupObjects,
  matchSize,
  type AlignMode,
} from './arrange';
import { Section } from './controls';
import { useSelectedVisual, useSelectedVisuals } from './selection';

const Row = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 1.5}px;
  `}
`;

const ALIGNS: [AlignMode, string][] = [
  ['left', t('Align left')],
  ['center', t('Align center')],
  ['right', t('Align right')],
  ['top', t('Align top')],
  ['middle', t('Align middle')],
  ['bottom', t('Align bottom')],
];

/** Several objects picked: align, distribute, match size and group them. */
export function MultiSection() {
  const dispatch = useDispatch();
  const ids = useSelectedVisuals();
  const primary = useSelectedVisual();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const grouped = ids.some(id => layout[id]?.meta?.[GROUP_KEY]);
  return (
    <Section data-test="mibi-format-multi">
      <h4>{t('%s objects selected', ids.length)}</h4>
      <Row>
        {ALIGNS.map(([mode, label]) => (
          <Button
            key={mode}
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(alignObjects(ids, mode))}
          >
            {label}
          </Button>
        ))}
      </Row>
      <Row>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          disabled={ids.length < 3}
          onClick={() => dispatch(distributeObjects(ids, 'horizontal'))}
        >
          {t('Distribute horizontally')}
        </Button>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          disabled={ids.length < 3}
          onClick={() => dispatch(distributeObjects(ids, 'vertical'))}
        >
          {t('Distribute vertically')}
        </Button>
      </Row>
      {primary && (
        <Row>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(matchSize(ids, primary, 'width'))}
          >
            {t('Same width')}
          </Button>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(matchSize(ids, primary, 'height'))}
          >
            {t('Same height')}
          </Button>
        </Row>
      )}
      <Row>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          onClick={() => dispatch(groupObjects(ids, true))}
        >
          {t('Group')}
        </Button>
        {grouped && (
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => dispatch(groupObjects(ids, false))}
          >
            {t('Ungroup')}
          </Button>
        )}
      </Row>
    </Section>
  );
}
