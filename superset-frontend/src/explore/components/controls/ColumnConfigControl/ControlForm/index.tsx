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
  cloneElement,
  FunctionComponentElement,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { JsonObject, JsonValue } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';
import { Constants } from '@superset-ui/core/components';
import { debounce } from 'lodash';
import { ControlFormItemNode } from './ControlFormItem';

export * from './ControlFormItem';

export type ControlFormRowProps = {
  children: ControlFormItemNode | ControlFormItemNode[];
};

export function ControlFormRow({ children }: ControlFormRowProps) {
  const { sizeUnit } = useTheme();
  return (
    <div
      css={{
        display: 'flex',
        flexWrap: 'nowrap',
        marginBottom: sizeUnit,
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  );
}

type ControlFormRowNode = FunctionComponentElement<ControlFormRowProps>;

export type ControlFormProps = {
  /**
   * Form field values dict.
   */
  value?: JsonObject;
  onChange: (value: JsonObject) => void;
  children: ControlFormRowNode | ControlFormRowNode[];
};

/**
 * Light weight form for control panel.
 */
export default function ControlForm({
  onChange,
  value,
  children,
}: ControlFormProps) {
  const theme = useTheme();
  const currentValue = useRef(value);
  const currentOnChange = useRef(onChange);
  const pending = useRef<JsonObject>({});
  currentValue.current = value;
  currentOnChange.current = onChange;
  const debouncedOnChange = useMemo(() => {
    const emit = () => {
      if (!Object.keys(pending.current).length) return;
      const next = { ...currentValue.current, ...pending.current };
      currentValue.current = next;
      pending.current = {};
      currentOnChange.current(next);
    };
    return {
      0: emit,
      [Constants.FAST_DEBOUNCE]: debounce(emit, Constants.FAST_DEBOUNCE),
    } as Record<number, typeof emit | ReturnType<typeof debounce>>;
  }, []);
  useEffect(
    () => () => {
      Object.values(debouncedOnChange).forEach(notify => {
        if ('flush' in notify) notify.flush();
      });
    },
    [debouncedOnChange],
  );

  const updatedChildren = Children.map(children, row => {
    if ('children' in row.props) {
      const defaultWidth = Array.isArray(row.props.children)
        ? `${100 / row.props.children.length}%`
        : undefined;
      return cloneElement(row, {
        children: Children.map(row.props.children, item => {
          const {
            name,
            width,
            debounceDelay = Constants.FAST_DEBOUNCE,
            onChange: onItemValueChange,
          } = item.props;
          return cloneElement(item, {
            width: width || defaultWidth,
            value: value?.[name],
            // remove `debounceDelay` from rendered control item props
            // so React DevTools don't throw a `invalid prop` warning.
            debounceDelay: undefined,
            onChange(fieldValue: JsonValue) {
              // call `onChange` on each FormItem
              if (onItemValueChange) {
                onItemValueChange(fieldValue);
              }
              // propagate to the form
              if (!(debounceDelay in debouncedOnChange)) {
                debouncedOnChange[debounceDelay] = debounce(
                  debouncedOnChange[0],
                  debounceDelay,
                );
              }
              pending.current[name] = fieldValue;
              debouncedOnChange[debounceDelay]();
            },
          });
        }),
      });
    }
    return row;
  });
  return (
    <div
      css={{
        label: {
          color: theme.colorTextLabel,
          fontSize: theme.fontSizeSM,
        },
      }}
    >
      {updatedChildren}
    </div>
  );
}
