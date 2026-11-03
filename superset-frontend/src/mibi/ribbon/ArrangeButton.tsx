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

import { useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css } from '@apache-superset/core/theme';
import { Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ArrangeControls } from 'src/mibi/format/ArrangeSection';
import { RibbonButton } from './parts';

/**
 * Opens the arrange commands in a panel that stays open while objects are
 * picked on the canvas, so the commands can be tried one after another.
 */
export function ArrangeButton() {
  const [open, setOpen] = useState(false);
  const onCanvas = useRef(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      onCanvas.current = !!(event.target as Element | null)?.closest?.(
        '.mibi-canvas',
      );
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  return (
    <Popover
      open={open}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      onOpenChange={next => {
        if (next || !onCanvas.current) setOpen(next);
      }}
      content={
        <div
          data-test="mibi-arrange-panel"
          css={css`
            width: 296px;
            max-height: calc(100vh - 264px);
            overflow-y: auto;
          `}
        >
          <ArrangeControls withLayers onClose={() => setOpen(false)} />
        </div>
      }
    >
      <span>
        <RibbonButton
          label={t('Arrange')}
          icon={<Icons.AppstoreOutlined iconSize="m" />}
          caret
          pressed={open}
          data-test="mibi-ribbon-arrange"
        />
      </span>
    </Popover>
  );
}
