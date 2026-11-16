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
import { render, screen } from 'spec/helpers/testing-library';
import { MovableDraggable } from './MovableDraggable';

const renderObject = (meta: Record<string, unknown>) =>
  render(
    <MovableDraggable
      component={{ id: 'CHART-1', type: 'CHART', children: [], meta }}
      parentComponent={{ id: 'ROW-1', type: 'ROW', children: [], meta: {} }}
      orientation="column"
      index={0}
      depth={2}
      onDrop={() => {}}
      editMode={false}
    >
      {() => <div>object</div>}
    </MovableDraggable>,
    { useRedux: true, useDnd: true },
  );

const wrapperOf = () => screen.getByTestId('dragdroppable-object');

// The stylesheet lifts .auradata-positioned objects whose slicer list is
// open, over the layers (meta.auradataZ) of the other objects of the page.
test('an object on a cell is marked as positioned, with its layer', () => {
  renderObject({ auradataPos: { x: 2, y: 3 }, auradataZ: 4 });
  expect(wrapperOf()).toHaveClass('auradata-positioned');
  expect(wrapperOf()).toHaveStyle({ zIndex: '4' });
});

test('an object that follows its row is not marked as positioned', () => {
  renderObject({});
  expect(wrapperOf()).not.toHaveClass('auradata-positioned');
});
