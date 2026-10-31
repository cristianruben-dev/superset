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
import type { SerializedStyles } from '@emotion/react';
import type { SupersetTheme } from '@apache-superset/core/theme';
import { Button, Dropdown, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { applyBookmark, bookmarksOf } from './bookmarks';

/** The bookmarks of the report for viewers, next to Present and Export. */
export function BookmarksMenu({
  buttonCss,
}: {
  buttonCss?: (theme: SupersetTheme) => SerializedStyles;
}) {
  const dispatch = useDispatch();
  const bookmarks = useSelector((state: RootState) =>
    bookmarksOf(state.dashboardLayout?.present),
  );
  if (!bookmarks.length) return null;
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: bookmarks.map(bookmark => ({
          key: bookmark.id,
          label: bookmark.name,
          icon: <Icons.BookOutlined iconSize="m" />,
        })),
        onClick: ({ key }) => dispatch(applyBookmark(String(key)) as never),
      }}
    >
      <span>
        <Tooltip title={t('Bookmarks')} placement="bottom">
          <Button
            buttonStyle="secondary"
            className="action-button"
            css={buttonCss}
            aria-label={t('Bookmarks')}
            data-test="mibi-bookmarks-button"
          >
            <Icons.BookOutlined iconSize="l" />
          </Button>
        </Tooltip>
      </span>
    </Dropdown>
  );
}
