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
import { useCallback, useState, type MouseEvent } from 'react';
import { Dropdown } from '@superset-ui/core/components';
import type { MenuItem } from '@superset-ui/core/components/Menu';

interface OpenMenu {
  x: number;
  y: number;
  items: MenuItem[];
}

/**
 * A menu at the pointer, for a right click: `open` takes the event and the
 * items, and `menu` is the element to render once.
 */
export function useContextMenu() {
  const [state, setState] = useState<OpenMenu | null>(null);

  const open = useCallback((event: MouseEvent, items: MenuItem[]) => {
    if (!items.length) return;
    // A right click on a link or a selection keeps the menu of the browser
    // with Shift, as in desktop applications
    if (event.shiftKey) return;
    event.preventDefault();
    setState({ x: event.clientX, y: event.clientY, items });
  }, []);

  const close = useCallback(() => setState(null), []);

  const menu = state ? (
    <Dropdown
      open
      trigger={['contextMenu']}
      onOpenChange={value => {
        if (!value) close();
      }}
      menu={{ items: state.items, onClick: close }}
    >
      <span
        aria-hidden
        data-test="mibi-context-menu-anchor"
        style={{
          position: 'fixed',
          left: state.x,
          top: state.y,
          width: 1,
          height: 1,
        }}
      />
    </Dropdown>
  ) : null;

  return { open, close, menu };
}
