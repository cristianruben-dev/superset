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

import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { useFilterConfigModal } from '../FilterConfigurationLink/useFilterConfigModal';

const EditButton = styled.button`
  ${({ theme }) => css`
    display: inline-flex;
    margin-left: ${theme.sizeUnit}px;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${theme.colorTextTertiary};
    cursor: pointer;
    opacity: 0;

    .ant-form-item:hover &,
    &:focus-visible {
      opacity: 1;
    }

    &:hover {
      color: ${theme.colorPrimary};
    }

    @media (hover: none) {
      opacity: 1;
    }
  `}
`;

/** Takes those who can edit the report to the settings of one filter. */
function FilterEditLink({
  filterId,
  name,
}: {
  filterId: string;
  name: string;
}) {
  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );
  const { FilterConfigModalComponent, openFilterConfigModal } =
    useFilterConfigModal({ dashboardId, initialFilterId: filterId });
  return (
    <>
      <Tooltip title={t('Edit filter')} placement="top">
        <EditButton
          type="button"
          aria-label={t('Edit filter %s', name)}
          data-test="filter-control-edit"
          onClick={event => {
            // The button sits inside the label of the filter's field
            event.preventDefault();
            event.stopPropagation();
            openFilterConfigModal();
          }}
        >
          <Icons.EditOutlined iconSize="s" />
        </EditButton>
      </Tooltip>
      {FilterConfigModalComponent}
    </>
  );
}

export default function FilterEditButton(props: {
  filterId: string;
  name: string;
}) {
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  return canEdit ? <FilterEditLink {...props} /> : null;
}
