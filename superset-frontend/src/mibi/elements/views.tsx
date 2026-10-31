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
  cloneElement,
  CSSProperties,
  KeyboardEvent,
  ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Tooltip } from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { useElementAction } from './actions';
import {
  boxShadow,
  colorWithOpacity,
  fillBackground,
  horizontalJustify,
  sanitizeRichText,
  shadowFilter,
  starPoints,
  textCss,
} from './render';
import type {
  ButtonElement,
  HoverEffect,
  ImageElement,
  ShapeElement,
  TextElement,
} from './types';

const Fill = styled.div<{ $clickable?: boolean }>`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
`;

/** Tooltip and hover effect of an element, in view mode only. */
function Interactive({
  config,
  editMode,
  children,
}: {
  config: { hoverEffect?: HoverEffect; tooltip?: string };
  editMode: boolean;
  children: ReactElement;
}) {
  const effect = editMode ? undefined : config.hoverEffect;
  const content =
    effect && effect !== 'none'
      ? cloneElement(children, { 'data-hover': effect })
      : children;
  return config.tooltip && !editMode ? (
    <Tooltip title={config.tooltip} placement="top">
      {content}
    </Tooltip>
  ) : (
    content
  );
}

const Placeholder = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit * 2}px;
    width: 100%;
    height: 100%;
    border: 1px dashed ${theme.colorBorder};
    border-radius: inherit;
    background: ${theme.colorFillQuaternary};
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    text-align: center;
  `}
`;

const activate = (run?: () => void) =>
  run
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: run,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            run();
          }
        },
      }
    : {};

export function ImageView({
  config,
  editMode,
}: {
  config: ImageElement;
  editMode: boolean;
}) {
  const run = useElementAction(config.action, !editMode);
  // A picture that does not load shows the placeholder, never its alt text
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [config.src]);
  if (broken && config.src) {
    return editMode ? (
      <Placeholder data-test="mibi-image-broken">
        <Icons.WarningOutlined iconSize="xl" />
        {t('The picture could not be loaded')}
      </Placeholder>
    ) : null;
  }
  if (!config.src) {
    return editMode ? (
      <Placeholder data-test="mibi-image-placeholder">
        <Icons.FileImageOutlined iconSize="xl" />
        {t('Add a picture in the Format pane')}
      </Placeholder>
    ) : null;
  }
  const transforms = [
    config.rotation ? `rotate(${config.rotation}deg)` : '',
    config.flip ? 'scaleX(-1)' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const filters = [
    config.grayscale ? 'grayscale(1)' : '',
    config.blur ? `blur(${config.blur}px)` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Interactive config={config} editMode={editMode}>
      <Fill $clickable={!!run} className="mibi-hoverable" {...activate(run)}>
        <img
          src={config.src}
          alt={config.alt ?? ''}
          data-test="mibi-image"
          draggable={false}
          onError={() => setBroken(true)}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: config.fit ?? 'cover',
            objectPosition: config.position ?? 'center',
            opacity: (config.opacity ?? 100) / 100,
            transform: transforms || undefined,
            filter: filters || undefined,
          }}
        />
      </Fill>
    </Interactive>
  );
}

const POLYGONS: Partial<Record<ShapeElement['shape'], string>> = {
  triangle: '50,0 100,100 0,100',
  diamond: '50,0 100,50 50,100 0,50',
  hexagon: '25,0 75,0 100,50 75,100 25,100 0,50',
  arrow: '0,30 62,30 62,0 100,50 62,100 62,70 0,70',
  chevron: '0,0 72,0 100,50 72,100 0,100 28,50',
};

const dashArray = (dash: string | undefined, width: number) => {
  if (dash === 'dashed') return `${width * 3} ${width * 2}`;
  if (dash === 'dotted') return `${width * 0.1} ${width * 2}`;
  return undefined;
};

export function ShapeView({
  config,
  id,
  editMode,
}: {
  config: ShapeElement;
  id: string;
  editMode: boolean;
}) {
  const theme = useTheme();
  const run = useElementAction(config.action, !editMode);
  const fill = config.fill ?? { type: 'solid' };
  const strokeWidth = config.stroke?.width ?? 0;
  const strokeColor = config.stroke?.color || theme.colorPrimary;
  const gradientId = `mibi-shape-${id}`;
  const fillColor = colorWithOpacity(
    fill.color || theme.colorPrimary,
    fill.opacity ?? 100,
  );
  const svgFill =
    fill.type === 'none'
      ? 'none'
      : fill.type === 'gradient'
        ? `url(#${gradientId})`
        : fillColor;
  // Fill under the mouse (view mode), through CSS variables
  const fillVars = {
    '--mb-shape-fill': svgFill,
    '--mb-shape-bg': fillBackground(fill, theme),
    ...(config.hoverFill && !editMode
      ? {
          '--mb-shape-fill-hover': config.hoverFill,
          '--mb-shape-bg-hover': config.hoverFill,
        }
      : {}),
  } as CSSProperties;
  const wrapper: CSSProperties = {
    width: '100%',
    height: '100%',
    transform: config.rotation ? `rotate(${config.rotation}deg)` : undefined,
    filter: shadowFilter(config.shadow),
  };

  let drawing;
  if (config.shape === 'rectangle') {
    drawing = (
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--mb-shape-bg-hover-on, var(--mb-shape-bg))',
          borderRadius: config.radius ?? 0,
          border:
            strokeWidth > 0
              ? `${strokeWidth}px ${config.stroke?.dash ?? 'solid'} ${strokeColor}`
              : undefined,
        }}
      />
    );
  } else {
    const stroke = {
      stroke: strokeWidth > 0 || config.shape === 'line' ? strokeColor : 'none',
      strokeWidth:
        config.shape === 'line' ? Math.max(1, strokeWidth) : strokeWidth,
      strokeDasharray: dashArray(config.stroke?.dash, Math.max(1, strokeWidth)),
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      vectorEffect: 'non-scaling-stroke' as const,
    };
    let body;
    if (config.shape === 'ellipse') {
      body = (
        <ellipse cx="50" cy="50" rx="50" ry="50" fill={svgFill} {...stroke} />
      );
    } else if (config.shape === 'line') {
      body = <line x1="0" y1="50" x2="100" y2="50" {...stroke} />;
    } else {
      const points =
        config.shape === 'star' ? starPoints() : POLYGONS[config.shape];
      body = (
        <polygon className="mibi-shape-fill" points={points} {...stroke} />
      );
    }
    drawing = (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ overflow: 'visible', display: 'block' }}
        aria-hidden
      >
        {fill.type === 'gradient' && (
          <defs>
            <linearGradient
              id={gradientId}
              gradientTransform={`rotate(${(fill.angle ?? 135) - 90} 0.5 0.5)`}
            >
              <stop offset="0%" stopColor={fillColor} />
              <stop
                offset="100%"
                stopColor={colorWithOpacity(
                  fill.color2 || theme.colorPrimaryBg,
                  fill.opacity ?? 100,
                )}
              />
            </linearGradient>
          </defs>
        )}
        {body}
      </svg>
    );
  }

  return (
    <Interactive config={config} editMode={editMode}>
      <Fill
        $clickable={!!run}
        className="mibi-hoverable mibi-shape"
        style={{ overflow: 'visible', ...fillVars }}
        data-test={`mibi-shape-${config.shape}`}
        {...activate(run)}
      >
        <div style={wrapper}>{drawing}</div>
        {config.text && (
          <div
            style={{
              ...textCss(
                {
                  verticalAlign: 'middle',
                  align: 'center',
                  ...config.textStyle,
                },
                theme,
              ),
              position: 'absolute',
              inset: 0,
              padding: theme.sizeUnit * 3,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              overflow: 'hidden',
            }}
          >
            {config.text}
          </div>
        )}
      </Fill>
    </Interactive>
  );
}

const StyledButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 0 16px;
  border-style: solid;
  background: var(--mb-btn-fill);
  color: var(--mb-btn-color);
  border-color: var(--mb-btn-border);
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;
  cursor: pointer;

  &:hover:not([aria-disabled]),
  &:focus-visible {
    background: var(--mb-btn-fill-hover);
    color: var(--mb-btn-color-hover);
    border-color: var(--mb-btn-border-hover);
  }

  &:active:not([aria-disabled]) {
    background: var(--mb-btn-fill-pressed);
    color: var(--mb-btn-color-pressed);
    border-color: var(--mb-btn-border-pressed);
    transform: translateY(1px);
  }

  .label {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`;

export function ButtonView({
  config,
  editMode,
}: {
  config: ButtonElement;
  editMode: boolean;
}) {
  const theme = useTheme();
  const run = useElementAction(config.action, !editMode);
  const normal = {
    fill: config.normal?.fill || theme.colorPrimary,
    color: config.normal?.color || theme.colorTextLightSolid,
    borderColor: config.normal?.borderColor || 'transparent',
  };
  const hover = {
    fill: config.hover?.fill || theme.colorPrimaryHover,
    color: config.hover?.color || normal.color,
    borderColor: config.hover?.borderColor || normal.borderColor,
  };
  const pressed = {
    fill: config.pressed?.fill || hover.fill,
    color: config.pressed?.color || hover.color,
    borderColor: config.pressed?.borderColor || hover.borderColor,
  };
  const IconComponent = config.icon
    ? (Icons as Record<string, typeof Icons.ArrowRightOutlined>)[config.icon]
    : undefined;
  // An icon only button whose icon is unknown shows its label instead
  const iconPosition =
    config.iconPosition === 'only' && !IconComponent
      ? 'left'
      : (config.iconPosition ?? 'left');
  const text = textCss(config.textStyle, theme);
  const icon = IconComponent ? (
    <IconComponent
      iconSize="m"
      style={{ fontSize: Math.round(Number(text.fontSize) * 1.1) }}
    />
  ) : null;
  const label = config.label ?? t('Button');

  return (
    <Interactive config={config} editMode={editMode}>
      <StyledButton
        type="button"
        className="mibi-hoverable"
        data-test="mibi-button"
        // Edit mode selects the button instead of running it: let clicks reach
        // the element (a disabled button would swallow them)
        aria-disabled={editMode || undefined}
        tabIndex={editMode ? -1 : undefined}
        onClick={run}
        aria-label={iconPosition === 'only' ? label : undefined}
        style={
          {
            '--mb-btn-fill': normal.fill,
            '--mb-btn-color': normal.color,
            '--mb-btn-border': normal.borderColor,
            '--mb-btn-fill-hover': hover.fill,
            '--mb-btn-color-hover': hover.color,
            '--mb-btn-border-hover': hover.borderColor,
            '--mb-btn-fill-pressed': pressed.fill,
            '--mb-btn-color-pressed': pressed.color,
            '--mb-btn-border-pressed': pressed.borderColor,
            pointerEvents: editMode ? 'none' : undefined,
            borderWidth: config.borderWidth ?? 0,
            borderRadius: config.radius ?? 10,
            boxShadow: boxShadow(config.shadow, theme),
            fontSize: text.fontSize,
            fontWeight: text.fontWeight,
            fontStyle: text.fontStyle,
            letterSpacing: text.letterSpacing,
            textTransform: text.textTransform,
            justifyContent: horizontalJustify(config.textStyle?.align),
          } as CSSProperties
        }
      >
        {iconPosition !== 'right' && icon}
        {iconPosition !== 'only' && <span className="label">{label}</span>}
        {iconPosition === 'right' && icon}
      </StyledButton>
    </Interactive>
  );
}

const RichText = styled.div`
  ${({ theme }) => css`
    width: 100%;
    height: 100%;
    overflow: auto;
    outline: none;
    word-break: break-word;

    &[contenteditable='true'] {
      cursor: text;
    }

    &:empty::before {
      content: attr(data-placeholder);
      color: ${theme.colorTextQuaternary};
    }

    p,
    h1,
    h2,
    h3,
    ul,
    ol,
    blockquote {
      margin: 0 0 0.4em;
    }

    h1 {
      font-size: 2em;
      font-weight: 700;
    }

    h2 {
      font-size: 1.5em;
      font-weight: 700;
    }

    h3 {
      font-size: 1.2em;
      font-weight: 600;
    }

    blockquote {
      padding-left: 0.8em;
      border-left: 3px solid ${theme.colorPrimary};
      color: ${theme.colorTextSecondary};
    }

    a {
      color: ${theme.colorPrimary};
      text-decoration: underline;
    }
  `}
`;

/** Rich text, edited in place while the element is selected in edit mode. */
export function TextView({
  config,
  editing,
  editMode,
  onChange,
}: {
  config: TextElement;
  editing: boolean;
  editMode: boolean;
  onChange: (html: string) => void;
}) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const html = sanitizeRichText(config.html ?? '');

  // Keep the caret: only write the HTML when it changed from outside
  useLayoutEffect(() => {
    if (
      ref.current &&
      document.activeElement !== ref.current &&
      ref.current.innerHTML !== html
    ) {
      ref.current.innerHTML = html;
    }
  }, [html]);

  useEffect(() => {
    if (editing) document.execCommand('styleWithCSS', false, 'true');
  }, [editing]);

  const save = () => {
    if (!ref.current) return;
    const next = sanitizeRichText(ref.current.innerHTML);
    if (next !== html) onChange(next);
  };

  return (
    <div style={{ ...textCss(config.textStyle, theme), height: '100%' }}>
      <RichText
        ref={ref}
        data-test="mibi-text"
        className="mibi-rich-text"
        contentEditable={editing}
        suppressContentEditableWarning
        data-placeholder={editMode ? t('Write here…') : ''}
        onInput={save}
        onBlur={save}
        style={{ height: 'auto', maxHeight: '100%' }}
      />
    </div>
  );
}
