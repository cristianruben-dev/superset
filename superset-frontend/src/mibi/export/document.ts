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
import { jsPDF as JsPdf } from 'jspdf';
import { kebabCase } from 'lodash';
import tinycolor from 'tinycolor2';
import { t } from '@apache-superset/core/translation';
import type { SupersetTheme } from '@apache-superset/core/theme';
import type { AppliedFilter, Capture } from './capture';

export type ExportFormat = 'pdf' | 'png';
export type PageOrientation = 'landscape' | 'portrait';

/** One part of the export: the whole dashboard or one of its pages. */
export interface ExportSection {
  title?: string;
  capture: Capture;
}

/** What the header and footer of the export tell about the dashboard. */
export interface ExportInfo {
  title: string;
  workspace?: string;
  filters: AppliedFilter[];
  author?: string;
  date: Date;
  locale?: string;
  logo?: HTMLImageElement | null;
  includeHeader: boolean;
}

const MM_MARGIN = 12;
const MM_FOOTER = 8;
const JPEG_QUALITY = 0.92;

/** File name such as "ventas-2026-10-30.pdf". */
export const exportFileName = (
  title: string,
  date: Date,
  format: ExportFormat,
) =>
  `${kebabCase(title) || 'dashboard'}-${date
    .toISOString()
    .slice(0, 10)}.${format}`;

export const formatExportDate = (date: Date, locale?: string) => {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
};

const subtitleOf = (info: ExportInfo) =>
  [info.workspace, formatExportDate(info.date, info.locale)]
    .filter(Boolean)
    .join('  ·  ');

const filtersOf = (info: ExportInfo) =>
  info.filters.map(({ label, value }) => `${label}: ${value}`).join('   ·   ');

const footerOf = (info: ExportInfo) =>
  info.author
    ? t(
        'Exported by %s on %s',
        info.author,
        formatExportDate(info.date, info.locale),
      )
    : t('Exported on %s', formatExportDate(info.date, info.locale));

/** Loads an image, resolving to null when it cannot be shown. */
export function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image.naturalWidth ? image : null);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

const logoSize = (logo: HTMLImageElement, height: number) => ({
  width: (logo.naturalWidth / logo.naturalHeight) * height,
  height,
});

/** The logo as a PNG data URL rasterized at the given pixel height. */
const logoDataUrl = (logo: HTMLImageElement, pixelHeight: number) => {
  const { width, height } = logoSize(logo, pixelHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  canvas.getContext('2d')?.drawImage(logo, 0, 0, width, height);
  return canvas.toDataURL('image/png');
};

const rgb = (color: string) => {
  const { r, g, b } = tinycolor(color).toRgb();
  return [r, g, b] as const;
};

/** Pixel rows [start, end) of each page, breaking between visuals when possible. */
export function paginate(
  capture: Capture,
  firstPageHeight: number,
  pageHeight: number,
): [number, number][] {
  const pages: [number, number][] = [];
  let start = 0;
  let available = firstPageHeight;
  const total = capture.canvas.height;
  while (start < total) {
    const limit = start + available;
    if (limit >= total) {
      pages.push([start, total]);
      break;
    }
    const fits = capture.breaks.filter(y => y > start && y <= limit);
    // Break between visuals unless that leaves most of the page empty
    const end =
      fits.length && fits[fits.length - 1] - start > available * 0.35
        ? fits[fits.length - 1]
        : limit;
    pages.push([start, end]);
    start = end;
    available = pageHeight;
  }
  return pages;
}

const slice = (source: HTMLCanvasElement, start: number, end: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = end - start;
  canvas
    .getContext('2d')
    ?.drawImage(
      source,
      0,
      start,
      source.width,
      end - start,
      0,
      0,
      source.width,
      end - start,
    );
  return canvas;
};

/** Builds a paginated A4 PDF with a header, one or more sections and page numbers. */
export function buildPdf(
  sections: ExportSection[],
  info: ExportInfo,
  theme: SupersetTheme,
  orientation: PageOrientation,
): JsPdf {
  const doc = new JsPdf({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MM_MARGIN * 2;
  const bottom = pageHeight - MM_MARGIN - MM_FOOTER;
  const text = rgb(theme.colorText);
  const muted = rgb(theme.colorTextTertiary);
  const border = rgb(theme.colorBorderSecondary);
  const background = rgb(theme.colorBgLayout);
  const primary = rgb(theme.colorPrimary);

  const paintBackground = () => {
    doc.setFillColor(...background);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const drawHeader = (): number => {
    let y = MM_MARGIN;
    if (info.logo) {
      const height = 7;
      const { width } = logoSize(info.logo, height);
      doc.addImage(
        logoDataUrl(info.logo, 96),
        'PNG',
        MM_MARGIN,
        y,
        Math.min(width, contentWidth / 3),
        height,
      );
      y += height + 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...text);
    const titleLines = doc.splitTextToSize(info.title, contentWidth);
    doc.text(titleLines, MM_MARGIN, y + 6);
    y += 6 + (titleLines.length - 1) * 8 + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(subtitleOf(info), MM_MARGIN, y + 2);
    y += 4;
    const filters = filtersOf(info);
    if (filters) {
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(
        `${t('Filters')}:  ${filters}`,
        contentWidth,
      );
      doc.text(lines, MM_MARGIN, y + 4);
      y += 4 + lines.length * 4;
    }
    y += 4;
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.6);
    doc.line(MM_MARGIN, y, MM_MARGIN + 18, y);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.2);
    doc.line(MM_MARGIN + 18, y, pageWidth - MM_MARGIN, y);
    return y + 6;
  };

  const drawSectionTitle = (title: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...text);
    doc.text(title, MM_MARGIN, y + 4);
    return y + 9;
  };

  let first = true;
  sections.forEach(section => {
    if (!first) doc.addPage();
    paintBackground();
    let y = MM_MARGIN;
    if (first && info.includeHeader) y = drawHeader();
    first = false;
    if (section.title && sections.length > 1) {
      y = drawSectionTitle(section.title, y);
    }
    const { canvas } = section.capture;
    const mmPerPixel = contentWidth / canvas.width;
    const pages = paginate(
      section.capture,
      Math.floor((bottom - y) / mmPerPixel),
      Math.floor((bottom - MM_MARGIN) / mmPerPixel),
    );
    pages.forEach(([start, end], index) => {
      if (index > 0) {
        doc.addPage();
        paintBackground();
        y = MM_MARGIN;
      }
      doc.addImage(
        slice(canvas, start, end).toDataURL('image/jpeg', JPEG_QUALITY),
        'JPEG',
        MM_MARGIN,
        y,
        contentWidth,
        (end - start) * mmPerPixel,
        undefined,
        'FAST',
      );
    });
  });

  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const footerY = pageHeight - MM_MARGIN + 2;
    doc.text(`${info.title}  ·  ${footerOf(info)}`, MM_MARGIN, footerY, {
      maxWidth: contentWidth - 30,
    });
    doc.text(t('Page %s of %s', page, count), pageWidth - MM_MARGIN, footerY, {
      align: 'right',
    });
  }
  return doc;
}

// Browsers refuse canvases much taller than this
const MAX_CANVAS_HEIGHT = 30000;

/** Builds one PNG with a header band and every section stacked. */
export function buildPng(
  sections: ExportSection[],
  info: ExportInfo,
  theme: SupersetTheme,
): HTMLCanvasElement {
  const scale = sections[0]?.capture.scale ?? 2;
  const pad = 32 * scale;
  const width =
    Math.max(...sections.map(s => s.capture.canvas.width)) + pad * 2;
  const font = (size: number, weight = 400) =>
    `${weight} ${size * scale}px ${theme.fontFamily}`;
  const measure = document.createElement('canvas').getContext('2d')!;
  const filters = filtersOf(info);

  const logoHeight = 28 * scale;
  const headerHeight = info.includeHeader
    ? pad +
      (info.logo ? logoHeight + 20 * scale : 0) +
      30 * scale +
      22 * scale +
      (filters ? 20 * scale : 0) +
      24 * scale
    : pad;
  const sectionTitle = 36 * scale;
  const footer = 40 * scale;
  const body = sections.reduce(
    (sum, s) =>
      sum +
      s.capture.canvas.height +
      (s.title && sections.length > 1 ? sectionTitle : 0) +
      24 * scale,
    0,
  );
  const height = Math.min(headerHeight + body + footer, MAX_CANVAS_HEIGHT);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = theme.colorBgLayout;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';

  let y = pad;
  if (info.includeHeader) {
    if (info.logo) {
      const size = logoSize(info.logo, logoHeight);
      ctx.drawImage(info.logo, pad, y, size.width, size.height);
      y += logoHeight + 20 * scale;
    }
    ctx.fillStyle = theme.colorText;
    ctx.font = font(26, 700);
    ctx.fillText(info.title, pad, y + 24 * scale, width - pad * 2);
    y += 30 * scale;
    ctx.fillStyle = theme.colorTextTertiary;
    ctx.font = font(14);
    ctx.fillText(subtitleOf(info), pad, y + 16 * scale, width - pad * 2);
    y += 22 * scale;
    if (filters) {
      ctx.font = font(13);
      measure.font = ctx.font;
      ctx.fillText(
        `${t('Filters')}:  ${filters}`,
        pad,
        y + 16 * scale,
        width - pad * 2,
      );
      y += 20 * scale;
    }
    y += 12 * scale;
    ctx.fillStyle = theme.colorBorderSecondary;
    ctx.fillRect(pad, y, width - pad * 2, Math.max(1, scale));
    ctx.fillStyle = theme.colorPrimary;
    ctx.fillRect(pad, y - scale / 2, 56 * scale, 2 * scale);
    y += 12 * scale;
  }

  sections.forEach(section => {
    if (section.title && sections.length > 1) {
      ctx.fillStyle = theme.colorText;
      ctx.font = font(18, 600);
      ctx.fillText(section.title, pad, y + 24 * scale);
      y += sectionTitle;
    }
    ctx.drawImage(section.capture.canvas, pad, y);
    y += section.capture.canvas.height + 24 * scale;
  });

  ctx.fillStyle = theme.colorTextTertiary;
  ctx.font = font(12);
  ctx.fillText(footerOf(info), pad, height - 16 * scale, width - pad * 2);
  return canvas;
}

/** Hands a file to the browser to save. */
export function saveFile(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
