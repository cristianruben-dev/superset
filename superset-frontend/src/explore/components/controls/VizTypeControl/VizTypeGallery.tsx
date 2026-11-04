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
  ChangeEventHandler,
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import Fuse from 'fuse.js';
import cx from 'classnames';
import { t } from '@apache-superset/core/translation';
import {
  ChartMetadata,
  chartLabelWeight,
  chartLabelExplanations,
} from '@superset-ui/core';
import { keyframes } from '@emotion/react';
import {
  styled,
  css,
  useTheme,
  isThemeDark,
} from '@apache-superset/core/theme';
import { Input, Collapse, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import { usePluginContext } from 'src/components';
import scrollIntoView from 'scroll-into-view-if-needed';
import { VizTypeIcon } from 'src/mibi/vizIcons/VizTypeIcon';

interface VizTypeGalleryProps {
  onChange: (vizType: string | null) => void;
  onDoubleClick: () => void;
  selectedViz: string | null;
  className?: string;
  denyList: string[];
}

type VizEntry = {
  key: string;
  value: ChartMetadata;
};

enum Sections {
  AllCharts = 'ALL_CHARTS',
  Featured = 'FEATURED',
  Category = 'CATEGORY',
  Tags = 'TAGS',
}

// A preview card: wide enough to read the chart it shows
const THUMBNAIL_WIDTH_UNITS = 46;
const THUMBNAIL_HEIGHT_UNITS = 32;

export const MAX_ADVISABLE_VIZ_GALLERY_WIDTH = 1090;

const OTHER_CATEGORY = t('Other');

const ALL_CHARTS = t('All charts');

const FEATURED = t('Featured');

const RECOMMENDED_TAGS = [FEATURED, t('ECharts'), t('Advanced-Analytics')];

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

const VizPickerLayout = styled.div`
  display: grid;
  grid-template-rows: auto minmax(100px, 1fr);
  // em is used here because the sidebar should be sized to fit the longest standard tag
  grid-template-columns: minmax(14em, auto) 5fr;
  grid-template-areas:
    'sidebar search'
    'sidebar main';
  height: 70vh;
  overflow: auto;
`;

const LeftPane = styled.div`
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border-right: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  background: ${({ theme }) => theme.colorBgLayout};
  overflow: auto;

  .ant-collapse .ant-collapse-item {
    border: 0;
    .ant-collapse-header {
      font-size: ${({ theme }) => theme.fontSizeSM}px;
      font-weight: ${({ theme }) => theme.fontWeightStrong};
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${({ theme }) => theme.colorTextTertiary};
      padding: ${({ theme }) => theme.sizeUnit * 3}px
        ${({ theme }) => theme.sizeUnit * 2}px
        ${({ theme }) => theme.sizeUnit}px;
    }

    .ant-collapse-panel .ant-collapse-body {
      display: flex;
      flex-direction: column;
      padding: 0;
    }
  }
`;

const RightPane = styled.div`
  grid-area: main;
  overflow-y: auto;
  scrollbar-width: thin;
`;

const SearchWrapper = styled.div`
  ${({ theme }) => `
    grid-area: search;
    margin: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 5}px ${theme.sizeUnit * 2}px;
    .ant-input-affix-wrapper {
      height: ${theme.sizeUnit * 10}px;
      padding-left: ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadiusLG * 1.5}px;
      background: ${theme.colorBgContainer};
      transition: box-shadow ${theme.motionDurationMid}, border-color ${theme.motionDurationMid};
    }
    .ant-input-affix-wrapper:focus-within {
      box-shadow: 0 0 0 3px ${theme.colorPrimaryBg};
    }
  `}
`;

/** Styles to line up prefix/suffix icons in the search input */
const InputIconAlignment = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${({ theme }) => theme.colorIcon};
`;

const SelectorLabel = styled.button`
  ${({ theme }) => `
    all: unset; // remove default button styles
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    margin: 1px 0;
    padding: 0 ${theme.sizeUnit * 2.5}px;
    border-radius: ${theme.borderRadiusLG}px;
    line-height: 2.4em;
    text-overflow: ellipsis;
    white-space: nowrap;
    position: relative;
    color: ${theme.colorTextSecondary};
    transition:
      background-color ${theme.motionDurationMid},
      color ${theme.motionDurationMid};

    &:hover:not(.selected) {
      background-color: ${theme.colorFillTertiary};
      color: ${theme.colorText};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
    }

    &.selected {
      background-color: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimaryText};
      font-weight: ${theme.fontWeightStrong};

      svg {
        color: ${theme.colorPrimary};
      }
    }

    & > span[role="img"] {
      margin-right: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const IconsPane = styled.div`
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    ${({ theme }) => theme.sizeUnit * THUMBNAIL_WIDTH_UNITS}px
  );
  grid-auto-rows: max-content;
  justify-content: space-evenly;
  grid-gap: ${({ theme }) => theme.sizeUnit * 6}px
    ${({ theme }) => theme.sizeUnit * 5}px;
  justify-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 4}px
    ${({ theme }) => theme.sizeUnit * 5}px
    ${({ theme }) => theme.sizeUnit * 8}px;
`;

const fadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

const thumbnailContainerCss = (theme: SupersetTheme) => css`
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  width: ${theme.sizeUnit * THUMBNAIL_WIDTH_UNITS}px;
  position: relative;
  outline: none;
  animation: ${fadeUp} 0.28s ease both;

  .viztype-selector {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    overflow: hidden;
    width: ${theme.sizeUnit * THUMBNAIL_WIDTH_UNITS}px;
    height: ${theme.sizeUnit * THUMBNAIL_HEIGHT_UNITS}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadiusLG * 1.5}px;
    background: linear-gradient(
      160deg,
      ${theme.colorBgElevated},
      ${theme.colorBgLayout}
    );
    color: ${theme.colorPrimary};
    box-shadow: ${theme.boxShadowTertiary};
    transition:
      border-color ${theme.motionDurationMid},
      box-shadow ${theme.motionDurationMid} ease,
      transform ${theme.motionDurationMid} ease;
  }

  /* A soft sheen over the picture */
  .viztype-selector::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      ${theme.colorFillQuaternary},
      transparent 40%
    );
  }

  .viztype-selector img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: ${theme.sizeUnit * 2}px;
    box-sizing: border-box;
    transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  &:hover:not(.selected) .viztype-selector {
    border-color: ${theme.colorPrimaryBorder};
    transform: translateY(-3px);
    box-shadow: ${theme.boxShadowSecondary};
  }

  &:hover .viztype-selector img {
    transform: scale(1.05);
  }

  &:focus-visible .viztype-selector {
    border-color: ${theme.colorPrimaryBorder};
  }

  &.selected .viztype-selector {
    border-color: ${theme.colorPrimary};
    transform: translateY(-3px);
    box-shadow:
      0 0 0 3px ${theme.colorPrimaryBg},
      0 18px 32px -14px ${theme.colorPrimary};
  }

  .viztype-check {
    position: absolute;
    top: ${theme.sizeUnit * 2}px;
    left: ${theme.sizeUnit * 2}px;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 5}px;
    height: ${theme.sizeUnit * 5}px;
    border-radius: 50%;
    background: ${theme.colorPrimary};
    color: ${theme.colorTextLightSolid};
    box-shadow: ${theme.boxShadowTertiary};
    animation: ${fadeUp} 0.2s ease both;
  }

  .viztype-label {
    margin-top: ${theme.sizeUnit * 2.5}px;
    padding: 0 ${theme.sizeUnit}px;
    text-align: center;
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: 1.3;
    color: ${theme.colorText};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color ${theme.motionDurationMid};
  }

  &.selected .viztype-label {
    color: ${theme.colorPrimaryText};
  }
`;

const HighlightLabel = styled.div`
  ${({ theme }) => `
    box-sizing: border-box;
    border-radius: 999px;
    background: ${theme.colorPrimary};
    line-height: ${theme.sizeUnit * 4}px;
    color: ${theme.colorTextLightSolid};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-align: center;
    padding: 0 ${theme.sizeUnit * 2}px;
    box-shadow: ${theme.boxShadowTertiary};

    div {
      transform: scale(0.85);
    }
  `}
`;

const ThumbnailLabelWrapper = styled.div`
  position: absolute;
  right: ${({ theme }) => theme.sizeUnit * 2}px;
  top: ${({ theme }) => theme.sizeUnit * 2}px;
  z-index: 1;
`;

const TooltipBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
  max-width: ${({ theme }) => theme.sizeUnit * 70}px;

  strong {
    font-weight: ${({ theme }) => theme.fontWeightStrong};
  }
`;

/**
 * The most representative picture of a chart type: its first example, or its
 * thumbnail. Charts with no picture, or whose picture fails to load, show
 * their icon.
 */
const VizPreview: FC<{ vizKey: string; type: ChartMetadata }> = ({
  vizKey,
  type,
}) => {
  const isDark = isThemeDark(useTheme());
  const [failed, setFailed] = useState(false);
  const example = type.exampleGallery?.[0];
  const src =
    (isDark ? example?.urlDark || type.thumbnailDark : undefined) ||
    example?.url ||
    type.thumbnail;
  if (!src || failed) return <VizTypeIcon vizType={vizKey} size={52} />;
  return (
    <img
      src={src}
      alt={type.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

interface ThumbnailProps {
  entry: VizEntry;
  selectedViz: string | null;
  setSelectedViz: (viz: string) => void;
  onDoubleClick: () => void;
}

const Thumbnail: FC<ThumbnailProps> = ({
  entry,
  selectedViz,
  setSelectedViz,
  onDoubleClick,
}) => {
  const theme = useTheme();
  const { key, value: type } = entry;
  const isSelected = selectedViz === entry.key;

  const handleFocus = () => {
    // Auto-select chart when tabbed to
    setSelectedViz(key);
  };

  return (
    <button
      type="button"
      // using css instead of a styled component to preserve
      // the data-test attribute
      css={thumbnailContainerCss(theme)}
      className={isSelected ? 'selected' : ''}
      aria-pressed={isSelected}
      onClick={() => setSelectedViz(key)}
      onDoubleClick={onDoubleClick}
      onFocus={handleFocus}
      data-test="viztype-selector-container"
    >
      <Tooltip
        placement="top"
        mouseEnterDelay={0.3}
        title={
          <TooltipBody>
            <strong>{type.name}</strong>
            <span>{t(type.description || 'No description available.')}</span>
            {type.label && (
              <em>
                {type.labelExplanation ?? chartLabelExplanations[type.label]}
              </em>
            )}
          </TooltipBody>
        }
      >
        <div className={`viztype-selector ${isSelected ? 'selected' : ''}`}>
          {isSelected && (
            <span className="viztype-check">
              <Icons.CheckOutlined iconSize="s" />
            </span>
          )}
          <VizPreview vizKey={key} type={type} />
        </div>
      </Tooltip>
      <div
        className="viztype-label"
        data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viztype-label`}
        title={type.name}
      >
        {type.name}
      </div>
      {type.label && (
        <ThumbnailLabelWrapper>
          <HighlightLabel>
            <div>{t(type.label)}</div>
          </HighlightLabel>
        </ThumbnailLabelWrapper>
      )}
    </button>
  );
};

interface ThumbnailGalleryProps {
  vizEntries: VizEntry[];
  selectedViz: string | null;
  setSelectedViz: (viz: string) => void;
  onDoubleClick: () => void;
}

/** A list of viz thumbnails, used within the viz picker modal */
const ThumbnailGallery: FC<ThumbnailGalleryProps> = ({
  vizEntries,
  ...props
}) => (
  <IconsPane data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viz-row`}>
    {vizEntries.map(entry => (
      <Thumbnail key={entry.key} {...props} entry={entry} />
    ))}
  </IconsPane>
);

const Selector: FC<{
  selector: string;
  sectionId: string;
  icon: ReactElement;
  isSelected: boolean;
  onClick: (selector: string, sectionId: string) => void;
  className?: string;
}> = ({ selector, sectionId, icon, isSelected, onClick, className }) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  // see Element.scrollIntoViewIfNeeded()
  // see: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoViewIfNeeded
  useEffect(() => {
    if (isSelected) {
      // We need to wait for the modal to open and then scroll, so we put it in the microtask queue
      queueMicrotask(() =>
        scrollIntoView(btnRef.current as HTMLButtonElement, {
          behavior: 'smooth',
          scrollMode: 'if-needed',
        }),
      );
    }
  }, []);

  return (
    <SelectorLabel
      aria-label={selector}
      aria-selected={isSelected}
      ref={btnRef}
      key={selector}
      name={selector}
      className={cx(className, isSelected && 'selected')}
      onClick={() => onClick(selector, sectionId)}
      tabIndex={0}
      role="tab"
    >
      {icon}
      {t(selector)}
    </SelectorLabel>
  );
};

const doesVizMatchSelector = (viz: ChartMetadata, selector: string) =>
  selector === viz.category ||
  (selector === OTHER_CATEGORY && viz.category == null) ||
  (viz.tags || []).indexOf(selector) > -1;

export default function VizTypeGallery(props: VizTypeGalleryProps) {
  const { selectedViz, onChange, onDoubleClick, className, denyList } = props;
  const { mountedPluginMetadata } = usePluginContext();
  const searchInputRef = useRef<HTMLInputElement>();
  const [searchInputValue, setSearchInputValue] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(true);
  const isActivelySearching = isSearchFocused && !!searchInputValue;

  const selectedVizMetadata: ChartMetadata | null = selectedViz
    ? mountedPluginMetadata[selectedViz]
    : null;

  const chartMetadata: VizEntry[] = useMemo(() => {
    const result = Object.entries(mountedPluginMetadata)
      .map(([key, value]) => ({ key, value }))
      .filter(({ key }) => !denyList.includes(key))
      .filter(
        ({ value }) =>
          nativeFilterGate(value.behaviors || []) && !value.deprecated,
      )
      .sort((a, b) => a.value.name.localeCompare(b.value.name));
    return result;
  }, [mountedPluginMetadata, denyList]);

  const chartsByCategory = useMemo(() => {
    const result: Record<string, VizEntry[]> = {};
    chartMetadata.forEach(entry => {
      const category = entry.value.category || OTHER_CATEGORY;
      if (!result[category]) {
        result[category] = [];
      }
      result[category].push(entry);
    });
    return result;
  }, [chartMetadata]);

  const categories = useMemo(
    () =>
      Object.keys(chartsByCategory).sort((a, b) => {
        // make sure Other goes at the end
        if (a === OTHER_CATEGORY) return 1;
        if (b === OTHER_CATEGORY) return -1;
        // sort alphabetically
        return a.localeCompare(b);
      }),
    [chartsByCategory],
  );

  const chartsByTags = useMemo(() => {
    const result: Record<string, VizEntry[]> = {};
    chartMetadata.forEach(entry => {
      const tags = entry.value.tags || [];
      tags.forEach(tag => {
        if (!result[tag]) {
          result[tag] = [];
        }
        result[tag].push(entry);
      });
    });
    return result;
  }, [chartMetadata]);

  const tags = useMemo(
    () =>
      Object.keys(chartsByTags)
        .sort((a, b) =>
          // sort alphabetically
          a.localeCompare(b),
        )
        .filter(tag => RECOMMENDED_TAGS.indexOf(tag) === -1),
    [chartsByTags],
  );

  const sortedMetadata = useMemo(
    () =>
      chartMetadata.sort((a, b) => a.value.name.localeCompare(b.value.name)),
    [chartMetadata],
  );

  const [activeSelector, setActiveSelector] = useState<string>(
    () => selectedVizMetadata?.category || FEATURED,
  );

  const [activeSection, setActiveSection] = useState<string>(() =>
    selectedVizMetadata?.category ? Sections.Category : Sections.Featured,
  );

  // get a fuse instance for fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(chartMetadata, {
        ignoreLocation: true,
        threshold: 0.3,
        keys: [
          {
            name: 'value.name',
            weight: 4,
          },
          {
            name: 'value.tags',
            weight: 2,
          },
          'value.description',
        ],
      }),
    [chartMetadata],
  );

  const searchResults = useMemo(() => {
    if (searchInputValue.trim() === '') {
      return [];
    }
    return fuse
      .search(searchInputValue)
      .map(result => result.item)
      .sort((a, b) => {
        const aLabel = a.value?.label;
        const bLabel = b.value?.label;
        const aOrder =
          aLabel && chartLabelWeight[aLabel]
            ? chartLabelWeight[aLabel].weight
            : 0;
        const bOrder =
          bLabel && chartLabelWeight[bLabel]
            ? chartLabelWeight[bLabel].weight
            : 0;
        return bOrder - aOrder;
      });
  }, [searchInputValue, fuse]);

  const focusSearch = useCallback(() => {
    // "start searching" is actually a two-stage process.
    // When you first click on the search bar, the input is focused and nothing else happens.
    // Once you begin typing, the selected category is cleared and the displayed viz entries change.
    setIsSearchFocused(true);
  }, []);

  // Auto-focus the search input when the modal opens
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const changeSearch: ChangeEventHandler<HTMLInputElement> = useCallback(
    event => setSearchInputValue(event.target.value),
    [],
  );

  const stopSearching = useCallback(() => {
    // stopping a search takes you back to the category you were looking at before.
    // Unlike focusSearch, this is a simple one-step process.
    setIsSearchFocused(false);
    setSearchInputValue('');
    searchInputRef.current!.blur();
  }, []);

  const clickSelector = useCallback(
    (selector: string, sectionId: string) => {
      if (isSearchFocused) {
        stopSearching();
      }
      setActiveSelector(selector);
      setActiveSection(sectionId);
      // clear the selected viz if it is not present in the new category or tags
      const isSelectedVizCompatible =
        selectedVizMetadata &&
        doesVizMatchSelector(selectedVizMetadata, selector);
      if (selector !== activeSelector && !isSelectedVizCompatible) {
        onChange(null);
      }
    },
    [
      stopSearching,
      isSearchFocused,
      activeSelector,
      selectedVizMetadata,
      onChange,
    ],
  );

  const sectionMap = useMemo(
    () => ({
      [Sections.Category]: {
        title: t('Category'),
        icon: <Icons.Category iconSize="m" />,
        selectors: categories,
      },
      [Sections.Tags]: {
        title: t('Tags'),
        icon: <Icons.NumberOutlined iconSize="m" />,
        selectors: tags,
      },
    }),
    [categories, tags],
  );

  const getVizEntriesToDisplay = () => {
    if (isActivelySearching) {
      return searchResults;
    }
    if (activeSelector === ALL_CHARTS && activeSection === Sections.AllCharts) {
      return sortedMetadata;
    }
    if (
      activeSelector === FEATURED &&
      activeSection === Sections.Featured &&
      chartsByTags[FEATURED]
    ) {
      return chartsByTags[FEATURED];
    }
    if (
      activeSection === Sections.Category &&
      chartsByCategory[activeSelector]
    ) {
      return chartsByCategory[activeSelector];
    }
    if (activeSection === Sections.Tags && chartsByTags[activeSelector]) {
      return chartsByTags[activeSelector];
    }
    return [];
  };

  return (
    <VizPickerLayout className={className}>
      <LeftPane aria-label={t('Choose chart type')} role="tablist">
        <Selector
          css={({ sizeUnit }) =>
            // adjust style for not being inside a collapse
            css`
              margin: ${sizeUnit * 2}px;
              margin-bottom: 0;
            `
          }
          sectionId={Sections.AllCharts}
          selector={ALL_CHARTS}
          icon={<Icons.Ballot iconSize="m" />}
          isSelected={
            !isActivelySearching &&
            ALL_CHARTS === activeSelector &&
            Sections.AllCharts === activeSection
          }
          onClick={clickSelector}
        />
        <Selector
          css={({ sizeUnit }) =>
            // adjust style for not being inside a collapse
            css`
              margin: ${sizeUnit * 2}px;
              margin-bottom: 0;
            `
          }
          sectionId={Sections.Featured}
          selector={FEATURED}
          icon={<Icons.FireOutlined iconSize="m" />}
          isSelected={
            !isActivelySearching &&
            FEATURED === activeSelector &&
            Sections.Featured === activeSection
          }
          onClick={clickSelector}
        />
        <Collapse
          expandIconPosition="end"
          ghost
          defaultActiveKey={Sections.Category}
          items={Object.keys(sectionMap).map(sectionId => {
            const section = sectionMap[sectionId as keyof typeof sectionMap];

            return {
              key: sectionId,
              label: <span className="header">{section.title}</span>,
              children: (
                <>
                  {section.selectors.map((selector: string) => (
                    <Selector
                      key={selector}
                      selector={selector}
                      sectionId={sectionId}
                      icon={section.icon}
                      isSelected={
                        !isActivelySearching &&
                        selector === activeSelector &&
                        sectionId === activeSection
                      }
                      onClick={clickSelector}
                    />
                  ))}
                </>
              ),
            };
          })}
        />
      </LeftPane>

      <SearchWrapper>
        <Input
          type="text"
          ref={searchInputRef as any /* cast required because emotion */}
          value={searchInputValue}
          placeholder={t('Search all charts')}
          onChange={changeSearch}
          onFocus={focusSearch}
          data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__search-input`}
          prefix={
            <InputIconAlignment>
              <Icons.SearchOutlined iconSize="m" />
            </InputIconAlignment>
          }
          suffix={
            <InputIconAlignment>
              {searchInputValue && (
                <Icons.CloseOutlined
                  iconSize="m"
                  onClick={stopSearching}
                  aria-label={t('Clear search')}
                />
              )}
            </InputIconAlignment>
          }
        />
      </SearchWrapper>

      <RightPane>
        <ThumbnailGallery
          vizEntries={getVizEntriesToDisplay()}
          selectedViz={selectedViz}
          setSelectedViz={onChange}
          onDoubleClick={onDoubleClick}
        />
      </RightPane>
    </VizPickerLayout>
  );
}
