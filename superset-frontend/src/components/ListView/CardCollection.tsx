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
import { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { TableInstance, Row, UseRowSelectRowProps } from 'react-table';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Checkbox } from '@superset-ui/core/components';
import cx from 'classnames';

interface CardCollectionProps {
  /** Each card shows its checkbox; a click on the card still opens it */
  selectable?: boolean;
  loading: boolean;
  prepareRow: TableInstance['prepareRow'];
  renderCard?: (row: any) => ReactNode;
  rows: TableInstance['rows'];
  showThumbnails?: boolean;
  /** A right click on a card */
  onCardContextMenu?: (
    record: any,
    event: ReactMouseEvent<HTMLElement>,
  ) => void;
}

const CardContainer = styled.div<{ showThumbnails?: boolean }>`
  ${({ theme }) => `
    display: grid;
    gap: ${theme.sizeUnit * 4}px;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    padding: ${theme.sizeUnit}px 0 ${theme.sizeUnit * 6}px;
  `}
`;

const CardWrapper = styled.div`
  position: relative;
  border: 2px solid transparent;
  &.card-selected {
    border: 2px solid ${({ theme }) => theme.colorPrimary};
  }
  .card-checkbox {
    position: absolute;
    top: ${({ theme }) => theme.sizeUnit * 2}px;
    left: ${({ theme }) => theme.sizeUnit * 2}px;
    z-index: 1;
    display: flex;
    padding: ${({ theme }) => theme.sizeUnit}px;
    border-radius: ${({ theme }) => theme.borderRadiusSM}px;
    background: ${({ theme }) => theme.colorBgContainer};
    box-shadow: ${({ theme }) => theme.boxShadowTertiary};
  }
`;

export default function CardCollection({
  selectable,
  loading,
  prepareRow,
  renderCard,
  rows,
  showThumbnails,
  onCardContextMenu,
}: CardCollectionProps) {
  if (!renderCard) return null;
  return (
    <CardContainer showThumbnails={showThumbnails}>
      {loading &&
        rows.length === 0 &&
        Array.from({ length: 25 }, (_, i) => (
          <div key={i}>{renderCard({ loading })}</div>
        ))}
      {rows.length > 0 &&
        rows.map(row => {
          if (!renderCard) return null;
          prepareRow(row);
          const { isSelected, toggleRowSelected } = row as Row &
            UseRowSelectRowProps<any>;
          return (
            <CardWrapper
              className={cx({ 'card-selected': selectable && isSelected })}
              key={row.id}
              onContextMenu={
                onCardContextMenu
                  ? event => onCardContextMenu(row.original, event)
                  : undefined
              }
              role="none"
            >
              {selectable && (
                <span className="card-checkbox">
                  <Checkbox
                    aria-label={t('Select')}
                    checked={!!isSelected}
                    data-test="card-select-checkbox"
                    onChange={event => toggleRowSelected(event.target.checked)}
                  />
                </span>
              )}
              {renderCard({ ...row.original, loading })}
            </CardWrapper>
          );
        })}
    </CardContainer>
  );
}
