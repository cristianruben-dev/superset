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

import { useEffect, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t, tn } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { RootState } from 'src/dashboard/types';
import { activePageId } from 'src/mibi/present/dashboardTabs';
import {
  alignObjects,
  arrangeLayer,
  distributeObjects,
  GROUP_KEY,
  groupObjects,
  matchSize,
  pageObjects,
  type AlignMode,
  type ArrangeResult,
} from './arrange';
import { Section } from './controls';
import {
  selectAllVisuals,
  useSelectedVisual,
  useSelectedVisuals,
} from './selection';

const Panel = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    font-size: ${theme.fontSizeSM}px;
    line-height: 1.4;

    .head {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 2}px;
      padding-bottom: ${theme.sizeUnit * 3}px;
    }

    .head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.sizeUnit * 2}px;
    }

    .close {
      display: flex;
      padding: ${theme.sizeUnit}px;
      border: 0;
      border-radius: ${theme.borderRadiusSM}px;
      background: transparent;
      color: ${theme.colorTextSecondary};
      cursor: pointer;

      &:hover {
        background: ${theme.colorFillSecondary};
        color: ${theme.colorText};
      }
    }

    .group {
      padding: ${theme.sizeUnit * 3}px 0;
      border-top: 1px solid ${theme.colorBorderSecondary};
    }

    .group:last-of-type {
      padding-bottom: 0;
    }

    .status {
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    .hint {
      color: ${theme.colorTextSecondary};
    }

    .tiles + .hint {
      margin-top: ${theme.sizeUnit * 2}px;
    }

    /* At the end, so the commands do not move under the pointer */
    .result {
      position: sticky;
      bottom: 0;
      margin-top: ${theme.sizeUnit * 3}px;
      padding: ${theme.sizeUnit * 2}px;
      border-radius: ${theme.borderRadiusSM}px;
      background: ${theme.colorBgElevated};
      border: 1px solid ${theme.colorBorderSecondary};
      color: ${theme.colorText};
    }

    .group-title {
      margin-bottom: ${theme.sizeUnit * 2}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    .tiles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: ${theme.sizeUnit * 1.5}px;
    }

    .tiles.two {
      grid-template-columns: repeat(2, 1fr);

      button {
        flex-direction: row;
        justify-content: flex-start;
        gap: ${theme.sizeUnit * 2}px;
        min-height: ${theme.sizeUnit * 8}px;
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        text-align: left;
      }
    }
  `}
`;

const Tile = styled.button`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    min-width: 0;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit}px;
    border: 1px solid transparent;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorFillTertiary};
    color: ${theme.colorText};
    font-size: 11px;
    line-height: 1.2;
    cursor: pointer;

    svg,
    .anticon {
      color: ${theme.colorPrimary};
    }

    &:hover:not(:disabled) {
      background: ${theme.colorPrimaryBg};
      border-color: ${theme.colorPrimaryBorder};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 1px;
    }

    &:disabled {
      background: ${theme.colorFillQuaternary};
      color: ${theme.colorTextDisabled};
      cursor: default;

      svg,
      .anticon {
        color: ${theme.colorTextDisabled};
      }
    }
  `}
`;

/** Bars of a drawing of 16 by 16: x, y, width and height. */
type Bars = [number, number, number, number][];

const Glyph = ({ bars }: { bars: Bars }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {bars.map(([x, y, width, height]) => (
      <rect
        key={`${x}-${y}-${width}-${height}`}
        x={x}
        y={y}
        width={width}
        height={height}
        rx={0.5}
        fill="currentColor"
      />
    ))}
  </svg>
);

/** Each drawing has the line the objects meet at and two objects against it. */
const ALIGN_GLYPHS: Record<AlignMode, Bars> = {
  left: [
    [1, 1, 1, 14],
    [3, 3, 10, 4],
    [3, 9, 6, 4],
  ],
  center: [
    [7.5, 1, 1, 14],
    [2, 3, 12, 4],
    [5, 9, 6, 4],
  ],
  right: [
    [14, 1, 1, 14],
    [3, 3, 10, 4],
    [7, 9, 6, 4],
  ],
  top: [
    [1, 1, 14, 1],
    [3, 3, 4, 10],
    [9, 3, 4, 6],
  ],
  middle: [
    [1, 7.5, 14, 1],
    [3, 2, 4, 12],
    [9, 5, 4, 6],
  ],
  bottom: [
    [1, 14, 14, 1],
    [3, 3, 4, 10],
    [9, 7, 4, 6],
  ],
};

const DISTRIBUTE_GLYPHS: Record<'horizontal' | 'vertical', Bars> = {
  horizontal: [
    [1, 3, 3, 10],
    [6.5, 3, 3, 10],
    [12, 3, 3, 10],
  ],
  vertical: [
    [3, 1, 10, 3],
    [3, 6.5, 10, 3],
    [3, 12, 10, 3],
  ],
};

const SIZE_GLYPHS: Record<'width' | 'height', Bars> = {
  width: [
    [2, 3, 12, 4],
    [2, 9, 12, 4],
  ],
  height: [
    [3, 2, 4, 12],
    [9, 2, 4, 12],
  ],
};

const UNGROUP_GLYPH: Bars = [
  [1, 1, 6, 6],
  [9, 9, 6, 6],
];

function Group({
  title,
  note,
  two,
  children,
}: {
  title: string;
  note?: ReactNode;
  two?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="group" role="group" aria-label={title}>
      <div className="group-title">{title}</div>
      <div className={two ? 'tiles two' : 'tiles'}>{children}</div>
      {note && <div className="hint">{note}</div>}
    </div>
  );
}

/**
 * Says what each command needs and what the last one did, because a command
 * that moves nothing would otherwise look broken.
 */
export function ArrangeControls({
  withLayers,
  onClose,
}: {
  withLayers?: boolean;
  onClose?: () => void;
}) {
  const dispatch = useDispatch();
  const ids = useSelectedVisuals();
  const primary = useSelectedVisual();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const [result, setResult] = useState<string | null>(null);
  const pageId = activePageId(layout, activeTabs);
  const grouped = ids.some(id => layout[id]?.meta?.[GROUP_KEY]);
  const count = ids.length;
  const selection = ids.join();

  // A result talks about the objects it was run on
  useEffect(() => setResult(null), [selection]);

  const report = ({ changed, locked }: ArrangeResult) => {
    const parts: string[] = [];
    if (changed) {
      parts.push(
        tn(
          '%s object changed. Ctrl+Z undoes it.',
          '%s objects changed. Ctrl+Z undoes it.',
          changed,
          changed,
        ),
      );
    } else if (!locked) {
      parts.push(t('Nothing to change: they are already like that.'));
    }
    if (locked) {
      parts.push(
        tn(
          '%s locked object stayed in place.',
          '%s locked objects stayed in place.',
          locked,
          locked,
        ),
      );
    }
    setResult(parts.join(' '));
  };
  const run = (action: unknown) =>
    report(dispatch(action as never) as unknown as ArrangeResult);

  const aligns: [AlignMode, string, string][] = [
    ['left', t('Left'), t('Align left')],
    ['center', t('Center'), t('Align center')],
    ['right', t('Right'), t('Align right')],
    ['top', t('Top'), t('Align top')],
    ['middle', t('Middle'), t('Align middle')],
    ['bottom', t('Bottom'), t('Align bottom')],
  ];
  const primaryName =
    (primary && layout[primary]?.meta?.sliceNameOverride) ||
    (primary && layout[primary]?.meta?.sliceName);

  return (
    <Panel>
      <div className="head">
        <div className="head-row">
          <div className="status" role="status">
            {count
              ? tn('%s object selected', '%s objects selected', count, count)
              : t('No objects selected')}
          </div>
          {onClose && (
            <button
              type="button"
              className="close"
              aria-label={t('Close')}
              data-test="mibi-arrange-close"
              onClick={onClose}
            >
              <Icons.CloseOutlined iconSize="s" />
            </button>
          )}
        </div>
        {count < 2 && (
          <>
            <div className="hint">
              {t(
                'Click an object, then hold Ctrl (⌘ on Mac) or Shift and click the others.',
              )}{' '}
              {t(
                'Align, match size and group need 2 or more objects; distribute needs 3.',
              )}
            </div>
            <Button
              buttonStyle="secondary"
              buttonSize="small"
              data-test="mibi-arrange-select-all"
              onClick={() => selectAllVisuals(pageObjects(layout, pageId))}
            >
              {t('Select all on this page')}
            </Button>
          </>
        )}
      </div>
      <Group title={t('Align')}>
        {aligns.map(([mode, label, title]) => (
          <Tile
            key={mode}
            type="button"
            title={title}
            aria-label={title}
            disabled={count < 2}
            data-test={`mibi-arrange-align-${mode}`}
            onClick={() => run(alignObjects(ids, mode))}
          >
            <Glyph bars={ALIGN_GLYPHS[mode]} />
            {label}
          </Tile>
        ))}
      </Group>
      <Group
        two
        title={t('Distribute')}
        note={
          count === 2
            ? t('Needs at least 3 objects')
            : count > 2 &&
              t(
                'Leaves the same space between them; the outer two stay in place.',
              )
        }
      >
        <Tile
          type="button"
          aria-label={t('Distribute horizontally')}
          disabled={count < 3}
          data-test="mibi-arrange-distribute-horizontal"
          onClick={() => run(distributeObjects(ids, 'horizontal'))}
        >
          <Glyph bars={DISTRIBUTE_GLYPHS.horizontal} />
          {t('Horizontally')}
        </Tile>
        <Tile
          type="button"
          aria-label={t('Distribute vertically')}
          disabled={count < 3}
          data-test="mibi-arrange-distribute-vertical"
          onClick={() => run(distributeObjects(ids, 'vertical'))}
        >
          <Glyph bars={DISTRIBUTE_GLYPHS.vertical} />
          {t('Vertically')}
        </Tile>
      </Group>
      <Group
        two
        title={t('Match size')}
        note={
          count >= 2 &&
          (primaryName
            ? t(
                'They take the size of «%s», the last one you picked.',
                primaryName,
              )
            : t('They take the size of the last one you picked.'))
        }
      >
        <Tile
          type="button"
          disabled={count < 2 || !primary}
          data-test="mibi-arrange-same-width"
          onClick={() => primary && run(matchSize(ids, primary, 'width'))}
        >
          <Glyph bars={SIZE_GLYPHS.width} />
          {t('Same width')}
        </Tile>
        <Tile
          type="button"
          disabled={count < 2 || !primary}
          data-test="mibi-arrange-same-height"
          onClick={() => primary && run(matchSize(ids, primary, 'height'))}
        >
          <Glyph bars={SIZE_GLYPHS.height} />
          {t('Same height')}
        </Tile>
      </Group>
      <Group two title={t('Group')}>
        <Tile
          type="button"
          disabled={count < 2}
          data-test="mibi-arrange-group"
          onClick={() => dispatch(groupObjects(ids, true) as never)}
        >
          <Icons.GroupOutlined iconSize="m" />
          {t('Group objects')}
        </Tile>
        <Tile
          type="button"
          disabled={!grouped}
          data-test="mibi-arrange-ungroup"
          onClick={() => dispatch(groupObjects(ids, false) as never)}
        >
          <Glyph bars={UNGROUP_GLYPH} />
          {t('Ungroup')}
        </Tile>
      </Group>
      {withLayers && (
        <Group two title={t('Layer')}>
          {(
            [
              ['front', t('Bring to front'), Icons.VerticalAlignTopOutlined],
              ['forward', t('Bring forward'), Icons.ArrowUpOutlined],
              ['backward', t('Send backward'), Icons.ArrowDownOutlined],
              ['back', t('Send to back'), Icons.VerticalAlignBottomOutlined],
            ] as const
          ).map(([move, label, Icon]) => (
            <Tile
              key={move}
              type="button"
              disabled={!count}
              data-test={`mibi-arrange-${move}`}
              onClick={() =>
                ids.forEach(id =>
                  dispatch(arrangeLayer(pageId, id, move) as never),
                )
              }
            >
              <Icon iconSize="m" />
              {label}
            </Tile>
          ))}
        </Group>
      )}
      {result && (
        <div className="result" role="status" data-test="mibi-arrange-result">
          {result}
        </div>
      )}
    </Panel>
  );
}

/** Several objects picked: align, distribute, match size and group them. */
export function MultiSection() {
  return (
    <Section data-test="mibi-format-multi">
      <ArrangeControls />
    </Section>
  );
}
