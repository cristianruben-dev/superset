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
import { css, styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components';
import DraggableNewComponent from 'src/dashboard/components/gridComponents/new/DraggableNewComponent';
import { DYNAMIC_TYPE } from 'src/dashboard/util/componentTypes';
import { useSelector } from 'react-redux';
import type { RootState } from 'src/dashboard/types';
import { VISUAL_FORMAT_KEY } from 'src/mibi/format/types';
import { columnCountOf, scaledWidth } from 'src/mibi/format/columns';
import { elementName } from './ElementFormat';
import {
  ELEMENT_DEFAULTS,
  ELEMENT_KEY,
  elementKey,
  type ElementKind,
} from './types';

const Heading = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeSM}px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: ${theme.colorTextTertiary};
  `}
`;

const ICONS: Record<ElementKind, unknown> = {
  text: Icons.FontSizeOutlined,
  image: Icons.FileImageOutlined,
  shape: Icons.BorderOutlined,
  button: Icons.BlockOutlined,
  filter: Icons.FilterOutlined,
};

/** Draggers for the AuraData BI design elements in the Layout elements tab. */
export function NewElements() {
  const columns = useSelector((state: RootState) =>
    columnCountOf(state.dashboardLayout?.present),
  );
  return (
    <div data-test="mibi-new-elements">
      <Heading>{t('Design elements')}</Heading>
      {(['text', 'image', 'shape', 'button', 'filter'] as ElementKind[]).map(
        kind => {
          const defaults = ELEMENT_DEFAULTS[kind];
          const element =
            kind === 'button'
              ? { ...defaults.element, label: t('Button') }
              : defaults.element;
          return (
            <DraggableNewComponent
              key={kind}
              id={`NEW_MIBI_${kind.toUpperCase()}`}
              type={DYNAMIC_TYPE}
              label={elementName(kind)}
              IconComponent={ICONS[kind]}
              meta={{
                componentKey: elementKey(kind),
                width: scaledWidth(defaults.width, columns),
                height: defaults.height,
                [VISUAL_FORMAT_KEY]: defaults.format,
                [ELEMENT_KEY]: element,
              }}
            />
          );
        },
      )}
      <Heading>{t('Layout')}</Heading>
    </div>
  );
}
