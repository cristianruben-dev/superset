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
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { ColorPicker, Slider } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { FieldHelp, type FieldHelpContent } from '../help/FieldHelp';

const SectionBox = styled.section`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    margin: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 3}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadiusLG}px;
    background: ${theme.colorFillQuaternary};

    > .section-head[aria-expanded='true'] {
      padding-bottom: ${theme.sizeUnit * 2}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }

    h4 {
      margin: 0;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: ${theme.colorTextTertiary};
    }

    h5 {
      margin: ${theme.sizeUnit * 4}px 0 ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      color: ${theme.colorTextSecondary};
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.sizeUnit * 2}px;
      cursor: pointer;
      user-select: none;

      h4 {
        flex: 1;
        min-width: 0;
      }

      .section-extra {
        display: inline-flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
      }

      .anticon {
        color: ${theme.colorTextTertiary};
      }
    }
  `}
`;

const DependentBox = styled.div`
  ${({ theme }) => css`
    &[aria-disabled='true'] {
      opacity: 0.45;
      cursor: not-allowed;
    }

    > .dependent-body {
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 2}px;
    }
  `}
`;

/**
 * Settings that depend on a switch. A switch turned off keeps them in place,
 * faded and locked, so the editor still sees what it would turn on.
 */
export function Dependent({
  off,
  children,
}: {
  off: boolean;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // `inert` locks the settings for the pointer, the keyboard and screen
  // readers; the box around them keeps the pointer to show the locked cursor
  useLayoutEffect(() => {
    bodyRef.current?.toggleAttribute('inert', off);
  }, [off]);
  return (
    <DependentBox aria-disabled={off} data-test="mibi-format-dependent">
      <div ref={bodyRef} className="dependent-body">
        {children}
      </div>
    </DependentBox>
  );
}

/** What the search box of the Format pane looks for. */
export const FormatSearchContext = createContext('');

/** A text as the search of the pane compares it, without case or accents. */
export const searchable = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The words of a piece of JSX: texts, and the labels controls are given. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (!isValidElement(node)) return '';
  const { children, label, title, placeholder } = (node as ReactElement)
    .props as Record<string, ReactNode>;
  return [children, label, title, placeholder].map(textOf).join(' ');
}

/** Sections the editor folded: they stay so while going through objects. */
const folded = new Set<string>();
/** Sections closed at first that the editor opened. */
const unfolded = new Set<string>();

/**
 * A group of settings. Its first heading names it and folds it, so a long list
 * stays easy to scan; the search of the pane shows the sections that match.
 */
export function Section({
  children,
  collapsedByDefault,
  headExtra,
  off,
  ...props
}: HTMLAttributes<HTMLElement> & {
  'data-test'?: string;
  /** Starts closed, for the long lists of options of a chart */
  collapsedByDefault?: boolean;
  /** Next to the heading, like the switch of an option */
  headExtra?: ReactNode;
  /** The switch of the section is off: its settings show faded and locked */
  off?: boolean;
}) {
  const query = searchable(useContext(FormatSearchContext).trim());
  const items = Children.toArray(children);
  const head = items.find(
    (child): child is ReactElement =>
      isValidElement(child) && child.type === 'h4',
  );
  const title = head ? textOf(head) : '';
  const [open, setOpen] = useState(() =>
    collapsedByDefault ? unfolded.has(title) : !folded.has(title),
  );
  const boxRef = useRef<HTMLElement>(null);
  const matchesJsx = !!query && searchable(textOf(children)).includes(query);
  // The labels of a nested component are not in the JSX: a search draws the
  // section once, and what it put on the page decides, before it is painted
  const [rejected, setRejected] = useState('');
  useLayoutEffect(() => {
    if (!query || matchesJsx) return;
    const drawn = searchable(boxRef.current?.textContent ?? '');
    if (!drawn.includes(query)) setRejected(query);
  }, [query, matchesJsx]);
  if (query && !matchesJsx && rejected === query) return null;
  const shown = open || !!query;
  const toggle = () => {
    if (open) {
      folded.add(title);
      unfolded.delete(title);
    } else {
      folded.delete(title);
      unfolded.add(title);
    }
    setOpen(!open);
  };
  return (
    <SectionBox ref={boxRef} {...props}>
      {head && (
        <div
          className="section-head"
          role="button"
          tabIndex={0}
          aria-label={title}
          aria-expanded={shown}
          onClick={toggle}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggle();
            }
          }}
        >
          {head}
          {headExtra && (
            <span
              className="section-extra"
              role="presentation"
              onClick={event => event.stopPropagation()}
              onKeyDown={event => event.stopPropagation()}
            >
              {headExtra}
            </span>
          )}
          {shown ? (
            <Icons.UpOutlined iconSize="xs" />
          ) : (
            <Icons.DownOutlined iconSize="xs" />
          )}
        </div>
      )}
      {shown &&
        (off === undefined ? (
          items.filter(child => child !== head)
        ) : (
          <Dependent off={off}>
            {items.filter(child => child !== head)}
          </Dependent>
        ))}
    </SectionBox>
  );
}

const FieldRow = styled.label<{ $stacked?: boolean }>`
  ${({ theme, $stacked }) => css`
    display: flex;
    flex-direction: ${$stacked ? 'column' : 'row'};
    align-items: ${$stacked ? 'stretch' : 'center'};
    justify-content: space-between;
    gap: ${theme.sizeUnit * ($stacked ? 1 : 2)}px;
    margin: 0;
    min-height: ${theme.sizeUnit * 6}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};

    > .label {
      flex: none;
      font-weight: 500;
    }

    > .control {
      display: flex;
      align-items: center;
      justify-content: ${$stacked ? 'stretch' : 'flex-end'};
      gap: ${theme.sizeUnit * 2}px;
      min-width: 0;
    }
  `}
`;

export function Field({
  label,
  children,
  stacked,
  help,
}: {
  label: ReactNode;
  children: ReactNode;
  stacked?: boolean;
  help?: FieldHelpContent;
}) {
  return (
    <FieldRow $stacked={stacked} as={stacked ? 'div' : 'label'}>
      <span className="label">
        {label}
        {help && <FieldHelp label={label} help={help} />}
      </span>
      <span className="control">{children}</span>
    </FieldRow>
  );
}

const SliderBox = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex: 1;
    width: 100%;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;

    .ant-slider {
      flex: 1;
      margin: 0 ${theme.sizeUnit}px;
    }

    .value {
      flex: none;
      min-width: 44px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: ${theme.colorText};
    }
  `}
`;

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  onChange,
  testId,
  help,
}: {
  label: ReactNode;
  help?: FieldHelpContent;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  testId?: string;
}) {
  return (
    <Field label={label} stacked help={help}>
      <SliderBox data-test={testId}>
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(next: number) => onChange(next)}
          tooltip={{ open: false }}
        />
        <span className="value">
          {value}
          {unit}
        </span>
      </SliderBox>
    </Field>
  );
}

/** A color picker with the theme colors as presets. */
export function ColorField({
  label,
  value,
  onChange,
  disabled,
  testId,
  help,
}: {
  label: ReactNode;
  help?: FieldHelpContent;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const theme = useTheme();
  return (
    <Field label={label} help={help}>
      <span data-test={testId}>
        <ColorPicker
          size="small"
          value={value}
          disabled={disabled}
          disabledAlpha
          showText
          onChange={(_, hex) => onChange(hex)}
          presets={[
            {
              label: t('Theme'),
              colors: [
                theme.colorBgContainer,
                theme.colorBgLayout,
                theme.colorText,
                theme.colorTextSecondary,
                theme.colorBorderSecondary,
                theme.colorPrimary,
                theme.colorPrimaryBg,
                theme.colorSuccess,
                theme.colorWarning,
                theme.colorError,
                theme.colorInfo,
              ],
              defaultOpen: true,
            },
          ]}
        />
      </span>
    </Field>
  );
}

const SegmentsBox = styled.div`
  ${({ theme }) => css`
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorFillTertiary};
  `}
`;

const SegmentButton = styled.button<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit}px;
    min-width: 0;
    height: 28px;
    padding: 0 ${theme.sizeUnit * 2}px;
    border: 0;
    border-radius: ${theme.borderRadiusSM}px;
    background: ${$selected ? theme.colorBgContainer : 'transparent'};
    box-shadow: ${$selected ? theme.boxShadowTertiary : 'none'};
    color: ${$selected ? theme.colorText : theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${$selected ? 600 : 500};
    white-space: nowrap;
    cursor: pointer;
  `}
`;

export function Segments<T extends string>({
  value,
  options,
  onChange,
  name,
  testId,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  name: string;
  testId?: string;
}) {
  return (
    <SegmentsBox role="radiogroup" aria-label={name} data-test={testId}>
      {options.map(option => (
        <SegmentButton
          key={option.value}
          type="button"
          role="radio"
          title={option.title}
          aria-label={option.title}
          aria-checked={option.value === value}
          $selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </SegmentButton>
      ))}
    </SegmentsBox>
  );
}

/** A short note under a control. */
export const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;
