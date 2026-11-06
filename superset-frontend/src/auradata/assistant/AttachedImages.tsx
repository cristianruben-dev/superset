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
import { Icons } from '@superset-ui/core/components/Icons';
import { attachmentUrl } from './client';
import type { ComposerImage } from './useComposerImages';

const Waiting = styled.ul`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 2}px;
    margin: 0;
    padding: ${theme.sizeUnit}px;
    list-style: none;

    li {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${theme.sizeUnit * 14}px;
      height: ${theme.sizeUnit * 14}px;
      overflow: hidden;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.sizeUnit * 2}px;
      background: ${theme.colorFillTertiary};
      color: ${theme.colorTextTertiary};
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    button {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${theme.sizeUnit * 6}px;
      height: ${theme.sizeUnit * 6}px;
      padding: 0;
      border: 0;
      border-bottom-left-radius: ${theme.sizeUnit * 2}px;
      background: ${theme.colorBgMask};
      color: ${theme.colorTextLightSolid};
      cursor: pointer;
      transition: background ${theme.motionDurationFast};
    }
    button:hover {
      background: ${theme.colorText};
    }
    button:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
    }
  `}
`;

const Sent = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 2}px;
    margin-bottom: ${theme.sizeUnit}px;

    img {
      display: block;
      max-width: 100%;
      max-height: ${theme.sizeUnit * 40}px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.sizeUnit * 2}px;
    }
  `}
`;

/** The images of the next message, each with its way out. */
export function ComposerImages({
  images,
  onRemove,
}: {
  images: ComposerImage[];
  onRemove: (image: ComposerImage) => void;
}) {
  if (!images.length) return null;
  return (
    <Waiting
      aria-label={t('Images of this message')}
      data-test="auradata-assistant-images"
    >
      {images.map(image => (
        <li key={image.key} data-test="auradata-assistant-image">
          {image.id ? (
            <>
              <img src={attachmentUrl(image.id)} alt={image.name} />
              <button
                type="button"
                aria-label={t('Remove image %s', image.name)}
                onClick={() => onRemove(image)}
                data-test="auradata-assistant-image-remove"
              >
                <Icons.CloseOutlined iconSize="xs" />
              </button>
            </>
          ) : (
            <Icons.LoadingOutlined
              iconSize="m"
              aria-label={t('Uploading %s', image.name)}
            />
          )}
        </li>
      ))}
    </Waiting>
  );
}

/** The images a person sent with a message, from the server that keeps them. */
export function MessageImages({
  ids,
  onLoad,
}: {
  ids: string[];
  onLoad: () => void;
}) {
  return (
    <Sent data-test="auradata-assistant-sent-images">
      {ids.map(id => (
        <img
          key={id}
          src={attachmentUrl(id)}
          alt={t('Attached image')}
          onLoad={onLoad}
        />
      ))}
    </Sent>
  );
}
