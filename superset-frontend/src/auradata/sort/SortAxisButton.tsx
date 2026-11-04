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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  Button,
  NoAnimationDropdown,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Menu } from '@superset-ui/core/components/Menu';
import { useVisualSortMenuItems } from './useVisualSortMenuItems';

/**
 * "Sort axis" on a visual's header while the dashboard is edited: the editor
 * picks the order every viewer sees. Absent for visuals that cannot be sorted.
 */
export function SortAxisButton({ chartId }: { chartId: number }) {
  const { items, onClick, saving } = useVisualSortMenuItems(chartId);
  const [open, setOpen] = useState(false);

  if (!items) return null;

  return (
    <NoAnimationDropdown
      popupRender={() => (
        <Menu
          data-test={`mibi-sort-menu-${chartId}`}
          selectable={false}
          items={items}
          onClick={({ key }) => {
            setOpen(false);
            onClick(String(key));
          }}
        />
      )}
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
    >
      <Tooltip title={t('Sort axis')} placement="top">
        <Button
          buttonStyle="link"
          aria-label={t('Sort axis')}
          aria-haspopup="true"
          disabled={saving}
          data-test={`mibi-sort-button-${chartId}`}
        >
          {saving ? (
            <Icons.LoadingOutlined iconSize="m" />
          ) : (
            <Icons.SortAscendingOutlined iconSize="m" />
          )}
        </Button>
      </Tooltip>
    </NoAnimationDropdown>
  );
}
