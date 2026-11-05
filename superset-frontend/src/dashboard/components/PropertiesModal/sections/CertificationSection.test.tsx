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
import { Form } from '@superset-ui/core/components';
import { render, screen } from 'spec/helpers/testing-library';
import CertificationSection from './CertificationSection';

const renderSection = (canCertify?: boolean) =>
  render(
    <Form>
      <CertificationSection isLoading={false} canCertify={canCertify} />
    </Form>,
  );

test('lets editors and workspace admins certify', () => {
  renderSection();

  screen.getAllByRole('textbox').forEach(input => expect(input).toBeEnabled());
});

test('keeps the stamp read-only for a workspace contributor', () => {
  renderSection(false);

  screen.getAllByRole('textbox').forEach(input => expect(input).toBeDisabled());
  expect(
    screen.getByText('Only editors and workspace admins can certify.'),
  ).toBeInTheDocument();
});
