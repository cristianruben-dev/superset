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
import { type KeyboardEvent, useEffect, useId, useState } from 'react';
import { commandsFor, type CommandId } from './commands';

/**
 * The menu of commands of the composer, kept by the keyboard: the focus stays in the
 * text and the option in use is its `aria-activedescendant`. Escape leaves what is
 * typed as a plain message, so the menu stays away until the slash goes.
 */
export function useCommandMenu(
  draft: string,
  available: readonly CommandId[],
  run: (id: CommandId) => void,
) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(false);
  const options = commandsFor(draft, available);
  const open = focused && !dismissed && options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);
  const listId = `${id}-commands`;
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    setActive(0);
    if (!draft.startsWith('/')) setDismissed(false);
  }, [draft]);

  /** Whether the key was for the menu. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = event.key === 'ArrowDown' ? 1 : options.length - 1;
      setActive((activeIndex + step) % options.length);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      run(options[activeIndex].id);
    } else if (event.key === 'Escape') {
      // The panel closes on Escape too
      event.stopPropagation();
      setDismissed(true);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  };

  return {
    open,
    options,
    activeIndex,
    listId,
    optionId,
    setActive,
    onKeyDown,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
