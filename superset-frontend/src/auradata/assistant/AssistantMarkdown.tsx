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
import { type AnchorHTMLAttributes, memo } from 'react';
import { SafeMarkdown } from '@superset-ui/core/components';

/** A picture would load by itself, carrying in its address whatever it was told to. */
const NO_PICTURES = ['img'];

const isThisSite = (href: string) => {
  try {
    return (
      new URL(href, window.location.href).origin === window.location.origin
    );
  } catch {
    return false;
  }
};

/** Only links of this site: anywhere else shows as text, for a person to judge. */
function SiteLink({ href, children }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href || !isThisSite(href)) {
    return (
      <span>
        {children}
        {href && href !== children ? ` (${href})` : ''}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const COMPONENTS = { a: SiteLink };

/**
 * What the model writes. It is untrusted, as it can repeat what a dataset says: raw
 * HTML stays text, and neither pictures nor links can reach other sites on their own.
 */
export const AssistantMarkdown = memo(function AssistantMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <SafeMarkdown
      source={text}
      escapeRawHtml
      disallowedElements={NO_PICTURES}
      components={COMPONENTS}
    />
  );
});
