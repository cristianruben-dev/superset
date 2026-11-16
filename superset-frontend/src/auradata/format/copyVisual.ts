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
import type { SupersetTheme } from '@apache-superset/core/theme';
import { captureDashboard } from 'src/auradata/export/capture';

const SCALE = 2;
/** Room around the caption, and the height of each of its lines, in CSS px. */
const PADDING = 12;
const LINE = 18;

/**
 * The caption under a copied chart, as Power BI writes it: the report it
 * comes from, when it was copied and where.
 */
export function captionLines({
  report,
  copiedAt,
  link,
}: {
  report?: string;
  copiedAt: Date;
  link: string;
}): string[] {
  return [
    report ? t('Report: %s', report) : '',
    t('Copied on %s', copiedAt.toLocaleString()),
    link,
  ].filter(Boolean);
}

/** Draws the caption under the picture of the chart. */
function withCaption(
  image: HTMLCanvasElement,
  lines: string[],
  theme: SupersetTheme,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height + (PADDING * 2 + LINE * lines.length) * SCALE;
  const context = canvas.getContext('2d');
  if (!context) return image;
  context.fillStyle = theme.colorBgContainer;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  context.fillStyle = theme.colorTextSecondary;
  context.font = `${theme.fontSizeSM * SCALE}px ${theme.fontFamily}`;
  context.textBaseline = 'top';
  lines.forEach((line, index) => {
    context.fillText(
      line,
      PADDING * SCALE,
      image.height + (PADDING + LINE * index) * SCALE,
      canvas.width - PADDING * 2 * SCALE,
    );
  });
  return canvas;
}

/**
 * Copies the picture of a chart to the clipboard, with its caption when
 * ``caption`` has lines.
 */
export async function copyVisualImage(
  theme: SupersetTheme,
  chartId: number,
  caption: string[] = [],
): Promise<void> {
  const { canvas } = await captureDashboard(
    theme,
    SCALE,
    `[data-test-chart-id="${chartId}"]`,
  );
  const picture = caption.length ? withCaption(canvas, caption, theme) : canvas;
  const blob = await new Promise<Blob | null>(resolve =>
    picture.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('No image');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
