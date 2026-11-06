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
import type { AssistantCommand, CommandId } from './commands';

const List = styled.ul`
  ${({ theme }) => css`
    position: absolute;
    right: 0;
    bottom: calc(100% + ${theme.sizeUnit}px);
    left: 0;
    z-index: 1;
    max-height: 240px;
    margin: 0;
    padding: ${theme.sizeUnit}px;
    overflow-y: auto;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.sizeUnit * 2}px;
    background: ${theme.colorBgElevated};
    box-shadow: ${theme.boxShadowSecondary};
    list-style: none;
  `}
`;

const Option = styled.li<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-radius: ${theme.sizeUnit}px;
    background: ${$active ? theme.colorFillSecondary : 'transparent'};
    color: ${theme.colorText};
    cursor: pointer;

    .name {
      font-family: ${theme.fontFamilyCode};
      font-size: ${theme.fontSizeSM}px;
    }
    .description {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

/** The commands that fit what is typed. Choosing with the mouse keeps the focus. */
export function CommandMenu({
  id,
  optionId,
  options,
  activeIndex,
  onHover,
  onChoose,
}: {
  id: string;
  optionId: (index: number) => string;
  options: AssistantCommand[];
  activeIndex: number;
  onHover: (index: number) => void;
  onChoose: (id: CommandId) => void;
}) {
  return (
    <List
      id={id}
      role="listbox"
      aria-label={t('Commands')}
      data-test="auradata-assistant-commands"
    >
      {options.map((command, index) => (
        <Option
          key={command.id}
          id={optionId(index)}
          role="option"
          aria-selected={index === activeIndex}
          $active={index === activeIndex}
          onMouseEnter={() => onHover(index)}
          onMouseDown={event => event.preventDefault()}
          onClick={() => onChoose(command.id)}
        >
          <span className="name">{command.label()}</span>
          <span className="description">{command.description()}</span>
        </Option>
      ))}
    </List>
  );
}
