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

/** One part of the export: the whole dashboard or one of its pages. */
export interface ExportSection {
  title?: string;
  capture: Capture;
  /** The capture is a canvas with a fixed size (one slide) */
  fixed?: boolean;
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

// CSS pixels to PDF points, so a page measures what the screen shows at 96 dpi
const PT_PER_PX = 0.75;
// Viewers handle pages up to 200 inches (14400 pt); taller content is split
const MAX_PAGE_PT = 14000;

const pageSizeOf = (capture: Capture, height = capture.canvas.height) => ({
  width: (capture.canvas.width / capture.scale) * PT_PER_PX,
  height: (height / capture.scale) * PT_PER_PX,
});

/** Cover page: logo, title, workspace, date, filters and the contents. */
function drawCover(
  doc: JsPdf,
  size: { width: number; height: number },
  info: ExportInfo,
  theme: SupersetTheme,
  sections: ExportSection[],
  sectionPages: Map<ExportSection, number>,
) {
  const { width, height } = size;
  const unit = Math.min(height, width * 0.6) / 100;
  const margin = Math.max(width * 0.07, unit * 6);
  const text = rgb(theme.colorText);
  const muted = rgb(theme.colorTextTertiary);
  const border = rgb(theme.colorBorderSecondary);
  const primary = rgb(theme.colorPrimary);

  doc.setFillColor(...rgb(theme.colorBgContainer));
  doc.rect(0, 0, width, height, 'F');
  // A brand band along the left edge
  doc.setFillColor(...primary);
  doc.rect(0, 0, unit * 1.4, height, 'F');

  if (info.logo) {
    const logoHeight = unit * 6;
    const logo = logoSize(info.logo, logoHeight);
    doc.addImage(
      logoDataUrl(info.logo, 160),
      'PNG',
      margin,
      margin,
      Math.min(logo.width, width / 3),
      logoHeight,
    );
  }

  const listed = sections.filter(section => section.title);
  const columnWidth = listed.length > 1 ? width * 0.5 : width - margin * 2;
  let y = height * (listed.length > 1 ? 0.36 : 0.42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(unit * 7);
  doc.setTextColor(...text);
  const titleLines = doc.splitTextToSize(info.title, columnWidth);
  doc.text(titleLines, margin, y);
  y += unit * 7 * 1.15 * (titleLines.length - 1) + unit * 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(unit * 2.6);
  doc.setTextColor(...muted);
  doc.text(subtitleOf(info), margin, y, { maxWidth: columnWidth });
  y += unit * 3.2;

  doc.setDrawColor(...primary);
  doc.setLineWidth(unit * 0.35);
  doc.line(margin, y, margin + unit * 8, y);
  y += unit * 4.5;

  const filters = filtersOf(info);
  if (filters) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(unit * 1.9);
    doc.setTextColor(...text);
    doc.text(t('Filters').toUpperCase(), margin, y);
    y += unit * 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(unit * 2.2);
    doc.setTextColor(...muted);
    const lines = doc.splitTextToSize(filters, columnWidth);
    doc.text(lines.slice(0, 4), margin, y);
  }

  if (listed.length > 1) {
    // Contents on the right half
    const left = width * 0.6;
    const right = width - margin;
    let row = height * 0.36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(unit * 1.9);
    doc.setTextColor(...text);
    doc.text(t('Contents').toUpperCase(), left, row);
    row += unit * 2;
    const step = Math.min(unit * 6, (height * 0.5) / listed.length);
    listed.forEach((section, index) => {
      doc.setDrawColor(...border);
      doc.setLineWidth(0.5);
      doc.line(left, row, right, row);
      const middle = row + step * 0.62;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.min(unit * 2.4, step * 0.4));
      doc.setTextColor(...primary);
      doc.text(String(index + 1).padStart(2, '0'), left, middle);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...text);
      doc.text(String(section.title), left + unit * 5, middle, {
        maxWidth: right - left - unit * 12,
      });
      doc.setTextColor(...muted);
      doc.text(String(sectionPages.get(section) ?? ''), right, middle, {
        align: 'right',
      });
      row += step;
    });
    doc.line(left, row, right, row);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(unit * 1.8);
  doc.setTextColor(...muted);
  doc.text(footerOf(info), margin, height - margin * 0.7);
}

/**
 * Builds a PDF whose pages have the size of the dashboard itself: an optional
 * cover, then each page of the dashboard edge to edge, split only when it is
 * taller than PDF viewers allow.
 */
export function buildPdf(
  sections: ExportSection[],
  info: ExportInfo,
  theme: SupersetTheme,
): JsPdf {
  // Each section becomes one or more pages of its own size
  const pages = sections.flatMap(section => {
    const maxPixels = Math.floor(
      (MAX_PAGE_PT / PT_PER_PX) * section.capture.scale,
    );
    return paginate(section.capture, maxPixels, maxPixels).map(
      ([start, end], index) => ({
        section,
        start,
        end,
        first: index === 0,
        size: pageSizeOf(section.capture, end - start),
      }),
    );
  });
  const firstSize = pages[0]?.size ?? { width: 960, height: 540 };
  // The cover is as wide as the dashboard, and as tall as a fixed canvas or 16:9
  const cover = info.includeHeader
    ? {
        width: firstSize.width,
        height: sections[0]?.fixed
          ? firstSize.height
          : Math.round((firstSize.width * 9) / 16),
      }
    : null;
  const sizeAt = (index: number) =>
    cover ? (index === 0 ? cover : pages[index - 1].size) : pages[index].size;
  const orientationOf = (size: { width: number; height: number }) =>
    size.width >= size.height ? 'landscape' : 'portrait';

  const first = sizeAt(0);
  const doc = new JsPdf({
    orientation: orientationOf(first),
    unit: 'pt',
    format: [first.width, first.height],
    compress: true,
  });

  // Page number of each section, for the contents and the bookmarks
  const sectionPages = new Map<ExportSection, number>();
  pages.forEach((page, index) => {
    if (page.first) sectionPages.set(page.section, index + (cover ? 2 : 1));
  });

  if (cover) drawCover(doc, cover, info, theme, sections, sectionPages);

  pages.forEach((page, index) => {
    if (cover || index > 0) {
      doc.addPage(
        [page.size.width, page.size.height],
        orientationOf(page.size),
      );
    }
    doc.addImage(
      slice(page.section.capture.canvas, page.start, page.end).toDataURL(
        'image/jpeg',
        JPEG_QUALITY,
      ),
      'JPEG',
      0,
      0,
      page.size.width,
      page.size.height,
      undefined,
      'FAST',
    );
  });

  try {
    sections.forEach(section => {
      const pageNumber = sectionPages.get(section);
      if (section.title && pageNumber) {
        doc.outline.add(null, section.title, { pageNumber });
      }
    });
  } catch {
    // Bookmarks are a nicety
  }
  doc.setProperties({ title: info.title, author: info.author ?? '' });
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
