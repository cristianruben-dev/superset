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
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { Button, Dropdown, Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { refreshChart } from 'src/components/Chart/chartAction';
import type { CanvasSizeMode, CanvasFormat } from 'src/mibi/format/types';
import { CANVAS_PRESETS } from 'src/mibi/format/types';
import type { RootState } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { openChartEditor } from 'src/mibi/chartEditor';
import { DataMenu } from 'src/mibi/dashboard/DataMenu';
import { setCanvasFormat, setComponentMeta } from 'src/mibi/format/actions';
import { arrangeLayer } from 'src/mibi/format/arrange';
import { setCanvasView, useCanvasView } from 'src/mibi/format/canvasView';
import {
  selectMobileBox,
  setMobileEditing,
  useMobileEditing,
} from 'src/mibi/format/mobile';
import {
  MOBILE_DEVICES,
  deviceById,
  setMobileViewSettings,
  useMobileViewSettings,
} from 'src/mibi/format/mobileDevices';
import { mobileLayoutOf } from 'src/mibi/format/mobileLayout';
import { isCopyable, useClipboard } from 'src/mibi/format/clipboard';
import {
  cancelFormatPainter,
  copyFormat,
  useFormatPainter,
} from 'src/mibi/format/formatPainter';
import { useGridSettings } from 'src/mibi/format/gridGuides';
import { setAllLocked, useAllLocked } from 'src/mibi/format/lock';
import {
  openBuilderTab,
  setPaneCollapsed,
  useBuilderTab,
  usePaneCollapsed,
  type BuilderTab,
} from 'src/mibi/format/panes';
import {
  openFormat,
  selectVisual,
  useSelectedVisual,
  useSelectedVisuals,
} from 'src/mibi/format/selection';
import { useObjectCommands } from 'src/mibi/format/useObjectCommands';
import { activePageId } from 'src/mibi/present/dashboardTabs';
import {
  setEditingInteractions,
  useEditingInteractions,
} from 'src/mibi/report/interactions';
import { clearVisibilityOverride } from 'src/mibi/report/visibility';
import { fetchDashboardWorkspace, workspaceUrl } from 'src/mibi/workspaces/api';
import { insertElement } from './insert';
import { ArrangeButton } from './ArrangeButton';
import { LineageModal } from './LineageModal';
import { insertPage } from 'src/mibi/report/pageActions';
import { resetFilters } from 'src/mibi/report/resetFilters';
import { useFiltersChanged } from 'src/mibi/report/ResetFiltersButton';
import {
  RibbonBar,
  RibbonBody,
  RibbonButton,
  RibbonGroup,
  RibbonTab,
  RibbonTabs,
} from './parts';

type RibbonTabKey =
  | 'home'
  | 'insert'
  | 'design'
  | 'view'
  | 'format'
  | 'data'
  | 'mobile';

const FOLDED_KEY = 'mibi.ribbonFolded';

const readFolded = () => {
  try {
    return window.localStorage.getItem(FOLDED_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Leaves the editor, asking first when there is something to lose. The holder
 * draws the question inside the app, so it takes the theme of the app.
 */
function useConfirmDiscard(dirty: boolean, onDiscard: () => void) {
  const [modal, holder] = Modal.useModal();
  const confirm = () => {
    if (!dirty) {
      onDiscard();
      return;
    }
    modal.confirm({
      title: t('Discard the changes?'),
      content: t("If you don't save, changes will be lost."),
      okText: t('Discard'),
      cancelText: t('Keep editing'),
      okButtonProps: { danger: true },
      onOk: onDiscard,
    });
  };
  return [confirm, holder] as const;
}

export interface RibbonProps {
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  emphasizeUndo?: boolean;
  emphasizeRedo?: boolean;
  canExport?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onProperties: () => void;
}

/**
 * The command ribbon of a report being edited, as in Power BI: tabs for each
 * kind of work, commands in named groups, and two more tabs for the selected
 * object. It holds the same actions as the panes, which keep their settings.
 */
export function Ribbon({
  hasUnsavedChanges,
  canUndo,
  canRedo,
  emphasizeUndo,
  emphasizeRedo,
  canExport,
  onSave,
  onDiscard,
  onUndo,
  onRedo,
  onRefresh,
  onExport,
  onProperties,
}: RibbonProps) {
  const dispatch = useDispatch();
  const filtersChanged = useFiltersChanged();
  const [chosenTab, setTab] = useState<RibbonTabKey>('home');
  const [folded, setFolded] = useState(readFolded);
  const [lineage, setLineage] = useState(false);
  const [confirmLeaving, discardHolder] = useConfirmDiscard(
    hasUnsavedChanges,
    onDiscard,
  );

  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);
  const dashboardPageId = useContext(DashboardPageIdContext);

  const primary = useSelectedVisual();
  const ids = useSelectedVisuals();
  const item = primary ? layout[primary] : undefined;
  const isChart = item?.type === CHART_TYPE;
  const pageId = activePageId(layout, activeTabs);
  const canvas = layout[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas as
    | CanvasFormat
    | undefined;

  const clipboard = useClipboard();
  const { copy, cut, paste, duplicate } = useObjectCommands();
  const { armed } = useFormatPainter();
  const view = useCanvasView();
  const [grid, updateGrid] = useGridSettings();
  const allLocked = useAllLocked();
  const paneTab = useBuilderTab();
  const dataPaneFolded = usePaneCollapsed('data');
  const paneFolded = usePaneCollapsed('builder');
  const editingInteractions = useEditingInteractions();
  const mobileEditing = useMobileEditing();
  const mobileSettings = useMobileViewSettings();
  const mobileDevice = deviceById(mobileSettings.device);
  const hasMobileLayout = !!mobileLayoutOf(layout, pageId);
  const openMobileLayout = () => {
    selectVisual(null);
    setMobileEditing(true);
  };

  // The tabs of the selected object go away with it
  // and the mobile layout has a tab of its own while it is open
  const tab = mobileEditing
    ? 'mobile'
    : (chosenTab === 'format' && !item) || (chosenTab === 'data' && !isChart)
      ? 'home'
      : chosenTab === 'mobile'
        ? 'view'
        : chosenTab;

  // Ctrl or Cmd + S saves the report instead of the web page
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const dirtyRef = useRef(hasUnsavedChanges);
  dirtyRef.current = hasUnsavedChanges;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        if (dirtyRef.current) saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // The page takes the room the ribbon leaves
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [folded]);

  const fold = (value: boolean) => {
    setFolded(value);
    try {
      window.localStorage.setItem(FOLDED_KEY, value ? '1' : '0');
    } catch {
      // The preference lasts until the page reloads
    }
  };

  const openTab = (key: RibbonTabKey) => {
    setTab(key);
    if (folded) fold(false);
  };

  const togglePane = (key: BuilderTab) => {
    if (paneTab === key && !paneFolded) setPaneCollapsed('builder', true);
    else openBuilderTab(key);
  };

  const openPermissions = async () => {
    const workspace = await fetchDashboardWorkspace(dashboardId).catch(
      () => null,
    );
    if (workspace) window.open(workspaceUrl(workspace.id), '_blank');
    else onProperties();
  };

  const layer = (move: 'front' | 'back' | 'forward' | 'backward') =>
    ids.forEach(id => dispatch(arrangeLayer(pageId, id, move) as never));

  const newVisual = () =>
    openChartEditor({ url: `/chart/add?dashboard_id=${dashboardId}` });

  const editVisual = () => {
    const chartId = item?.meta?.chartId as number | undefined;
    if (chartId) {
      openChartEditor({
        url: `/explore/?dashboard_page_id=${dashboardPageId}&slice_id=${chartId}`,
        chartId,
      });
    }
  };

  const painterButton = (
    <RibbonButton
      small
      label={t('Format painter')}
      hint={t('Copies the format of the selected object to the next one')}
      icon={<Icons.FormatPainterOutlined iconSize="m" />}
      disabled={!item && !armed}
      pressed={armed}
      data-test="mibi-ribbon-painter"
      onClick={() => {
        if (armed) cancelFormatPainter();
        else if (item) {
          copyFormat(item);
          openBuilderTab('FORMAT');
        }
      }}
    />
  );

  const arrangeButton = <ArrangeButton />;

  const insertGroup = (
    <RibbonGroup label={t('Insert')}>
      <RibbonButton
        label={t('New page')}
        icon={<Icons.PlusSquareOutlined iconSize="m" />}
        data-test="mibi-ribbon-new-page"
        onClick={() => dispatch(insertPage() as never)}
      />
      <RibbonButton
        label={t('New visual')}
        icon={<Icons.BarChartOutlined iconSize="m" />}
        data-test="mibi-ribbon-new-visual"
        onClick={newVisual}
      />
      <RibbonButton
        label={t('Text box')}
        icon={<Icons.FontSizeOutlined iconSize="m" />}
        data-test="mibi-ribbon-text"
        onClick={() => dispatch(insertElement('text') as never)}
      />
    </RibbonGroup>
  );

  const saveGroup = (
    <RibbonGroup label={t('Save')} data-test="dashboard-edit-actions">
      <RibbonButton
        label={t('Save')}
        hint={t('Save (Ctrl+S)')}
        icon={<Icons.SaveOutlined iconSize="m" />}
        disabled={!hasUnsavedChanges}
        onClick={onSave}
        data-test="header-save-button"
      />
      <div className="stack">
        <RibbonButton
          small
          label={t('Undo')}
          hint={t('Undo (Ctrl+Z)')}
          icon={<Icons.Undo data-test="undo-action" iconSize="m" />}
          disabled={!canUndo}
          pressed={emphasizeUndo}
          onClick={onUndo}
        />
        <RibbonButton
          small
          label={t('Redo')}
          hint={t('Redo (Ctrl+Y)')}
          icon={<Icons.Redo data-test="redo-action" iconSize="m" />}
          disabled={!canRedo}
          pressed={emphasizeRedo}
          onClick={onRedo}
        />
        <RibbonButton
          small
          label={t('Discard')}
          hint={t('Leaves the editor without saving')}
          icon={<Icons.CloseOutlined iconSize="m" />}
          onClick={confirmLeaving}
          data-test="discard-changes-button"
        />
      </div>
    </RibbonGroup>
  );

  const body: Record<RibbonTabKey, ReactNode> = {
    home: (
      <>
        {saveGroup}
        <RibbonGroup label={t('Clipboard')}>
          <RibbonButton
            label={t('Paste')}
            hint={t('Paste (Ctrl+V)')}
            icon={<Icons.SnippetsOutlined iconSize="m" />}
            disabled={!clipboard}
            onClick={() => paste(primary)}
            data-test="mibi-paste"
          />
          <div className="stack">
            <RibbonButton
              small
              label={t('Cut')}
              hint={t('Cut (Ctrl+X)')}
              icon={<Icons.ScissorOutlined iconSize="m" />}
              disabled={!isCopyable(item)}
              onClick={() => primary && cut(primary)}
              data-test="mibi-cut"
            />
            <RibbonButton
              small
              label={t('Copy')}
              hint={t('Copy (Ctrl+C)')}
              icon={<Icons.CopyOutlined iconSize="m" />}
              disabled={!isCopyable(item)}
              onClick={() => primary && copy(primary)}
              data-test="mibi-copy"
            />
            {painterButton}
          </div>
        </RibbonGroup>
        {insertGroup}
        <RibbonGroup label={t('Arrange')}>{arrangeButton}</RibbonGroup>
        <RibbonGroup label={t('Data')}>
          <RibbonButton
            label={t('Refresh')}
            hint={t('Runs the queries of all the charts again')}
            icon={<Icons.ReloadOutlined iconSize="m" />}
            onClick={onRefresh}
            data-test="mibi-ribbon-refresh"
          />
          <DataMenu />
          <RibbonButton
            label={t('Reset filters')}
            hint={t('Back to the saved filters, slicers and cross-filters')}
            icon={<Icons.Undo iconSize="m" />}
            disabled={!filtersChanged}
            onClick={() => dispatch(resetFilters() as never)}
            data-test="mibi-ribbon-reset-filters"
          />
          <RibbonButton
            label={t('Lineage')}
            hint={t('Where the data of the report comes from')}
            icon={<Icons.PartitionOutlined iconSize="m" />}
            onClick={() => setLineage(true)}
            data-test="mibi-ribbon-lineage"
          />
        </RibbonGroup>
        {canExport && (
          <RibbonGroup label={t('Export')}>
            <RibbonButton
              label={t('Export')}
              icon={<Icons.DownloadOutlined iconSize="m" />}
              onClick={onExport}
              data-test="mibi-ribbon-export"
            />
          </RibbonGroup>
        )}
        <RibbonGroup label={t('Manage')}>
          <RibbonButton
            label={t('Manage permissions')}
            hint={t('Opens the workspace of the report, with its members')}
            icon={<Icons.TeamOutlined iconSize="m" />}
            onClick={openPermissions}
            data-test="mibi-ribbon-permissions"
          />
          <RibbonButton
            label={t('Properties')}
            icon={<Icons.SettingOutlined iconSize="m" />}
            onClick={onProperties}
            data-test="mibi-ribbon-properties"
          />
        </RibbonGroup>
      </>
    ),
    insert: (
      <>
        <RibbonGroup label={t('Pages')}>
          <RibbonButton
            label={t('New page')}
            icon={<Icons.PlusSquareOutlined iconSize="m" />}
            onClick={() => dispatch(insertPage() as never)}
          />
        </RibbonGroup>
        <RibbonGroup label={t('Visuals')}>
          <RibbonButton
            label={t('New visual')}
            icon={<Icons.BarChartOutlined iconSize="m" />}
            onClick={newVisual}
          />
          <RibbonButton
            label={t('Existing visual')}
            hint={t('Charts of this report that are not on a page')}
            icon={<Icons.AreaChartOutlined iconSize="m" />}
            onClick={() => openBuilderTab('CHARTS')}
          />
        </RibbonGroup>
        <RibbonGroup label={t('Elements')}>
          {(
            [
              ['text', t('Text box'), <Icons.FontSizeOutlined iconSize="m" />],
              ['image', t('Image'), <Icons.FileImageOutlined iconSize="m" />],
              ['shape', t('Shape'), <Icons.BorderOutlined iconSize="m" />],
              ['button', t('Button'), <Icons.BlockOutlined iconSize="m" />],
              ['filter', t('Filter'), <Icons.FilterOutlined iconSize="m" />],
              [
                'navigator',
                t('Page navigator'),
                <Icons.MenuOutlined iconSize="m" />,
              ],
            ] as const
          ).map(([kind, label, node]) => (
            <RibbonButton
              key={kind}
              label={label}
              icon={node}
              data-test={`mibi-ribbon-insert-${kind}`}
              onClick={() => dispatch(insertElement(kind) as never)}
            />
          ))}
        </RibbonGroup>
        <RibbonGroup label={t('More')}>
          <RibbonButton
            label={t('Layout elements')}
            hint={t('Dividers, nested tabs and more, to drag onto the page')}
            icon={<Icons.AppstoreOutlined iconSize="m" />}
            onClick={() => openBuilderTab('LAYOUT_ELEMENTS')}
          />
        </RibbonGroup>
      </>
    ),
    design: (
      <>
        <RibbonGroup label={t('Page')}>
          <RibbonButton
            label={t('Page size')}
            icon={<Icons.ExpandOutlined iconSize="m" />}
            data-test="mibi-ribbon-page-size"
            menu={{
              selectedKeys: [canvas?.size?.mode ?? '16:9'],
              items: [
                {
                  key: '16:9',
                  label: t('16:9 (%s × %s)', ...CANVAS_PRESETS['16:9']),
                },
                {
                  key: '4:3',
                  label: t('4:3 (%s × %s)', ...CANVAS_PRESETS['4:3']),
                },
                {
                  key: 'letter',
                  label: t('Letter (%s × %s)', ...CANVAS_PRESETS.letter),
                },
                { type: 'divider' as const },
                { key: 'custom', label: t('Custom') },
              ],
              onClick: ({ key }) => {
                if (key === 'custom') {
                  openFormat(null);
                  return;
                }
                dispatch(
                  setCanvasFormat(
                    { ...canvas, size: { mode: key as CanvasSizeMode } },
                    `canvas:size:${Date.now()}`,
                  ) as never,
                );
              },
            }}
          />
          <RibbonButton
            label={t('Background')}
            hint={t('Color, gradient or picture of the canvas and its pages')}
            icon={<Icons.BgColorsOutlined iconSize="m" />}
            onClick={() => openFormat(null)}
            data-test="mibi-ribbon-background"
          />
        </RibbonGroup>
        <RibbonGroup label={t('Filter panel')}>
          <RibbonButton
            label={t('Filter panel')}
            hint={t('Colors of the filter panel')}
            icon={<Icons.FilterOutlined iconSize="m" />}
            onClick={() => openFormat(null)}
          />
          <RibbonButton
            label={t('Tabs')}
            hint={t('Colors of the page tabs')}
            icon={<Icons.ProfileOutlined iconSize="m" />}
            onClick={() => openFormat(null)}
          />
        </RibbonGroup>
        <RibbonGroup label={t('Style')}>
          <RibbonButton
            label={t('Reset canvas')}
            hint={t('Clears the format of the canvas')}
            icon={<Icons.ClearOutlined iconSize="m" />}
            onClick={() =>
              dispatch(
                setCanvasFormat(undefined, `canvas:${Date.now()}`) as never,
              )
            }
            data-test="mibi-ribbon-reset-canvas"
          />
        </RibbonGroup>
      </>
    ),
    mobile: (
      <>
        {saveGroup}
        <RibbonGroup label={t('Mode')}>
          <RibbonButton
            label={t('Place visuals')}
            hint={t('Place, move and resize the visuals on the phone')}
            icon={<Icons.EditOutlined iconSize="m" />}
            pressed={mobileSettings.mode === 'work'}
            onClick={() => setMobileViewSettings({ mode: 'work' })}
            data-test="mibi-ribbon-mobile-work"
          />
          <RibbonButton
            label={t('Preview')}
            hint={t('Shows the page as a phone shows it to viewers')}
            icon={<Icons.EyeOutlined iconSize="m" />}
            pressed={mobileSettings.mode === 'preview'}
            onClick={() => {
              selectMobileBox(null);
              setMobileViewSettings({ mode: 'preview' });
            }}
            data-test="mibi-ribbon-mobile-preview"
          />
        </RibbonGroup>
        <RibbonGroup label={t('Device')}>
          <RibbonButton
            label={mobileDevice.name}
            icon={<Icons.MobileOutlined iconSize="m" />}
            data-test="mibi-ribbon-mobile-device"
            menu={{
              selectedKeys: [mobileDevice.id],
              onClick: ({ key }) => setMobileViewSettings({ device: key }),
              items: MOBILE_DEVICES.map(device => ({
                key: device.id,
                label: (
                  <span
                    data-test={`mibi-device-option-${device.id}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      minWidth: 220,
                    }}
                  >
                    <span>{device.name}</span>
                    <span style={{ opacity: 0.6, fontSize: 12 }}>
                      {t('%s × %s pt', device.width, device.height)}
                    </span>
                  </span>
                ),
              })),
            }}
          />
        </RibbonGroup>
        <RibbonGroup label={t('Show')}>
          <div className="stack">
            <RibbonButton
              small
              label={t('Fit to screen')}
              icon={<Icons.CompressOutlined iconSize="m" />}
              pressed={mobileSettings.fit}
              onClick={() => setMobileViewSettings({ fit: true })}
              data-test="mibi-ribbon-mobile-fit"
            />
            <RibbonButton
              small
              label={t('Actual size')}
              icon={<Icons.ExpandOutlined iconSize="m" />}
              pressed={!mobileSettings.fit}
              onClick={() => setMobileViewSettings({ fit: false })}
              data-test="mibi-ribbon-mobile-actual"
            />
            <RibbonButton
              small
              label={t('Safe area')}
              hint={t(
                'Marks the status bar and the home indicator, which the page does not use',
              )}
              icon={<Icons.BorderOutlined iconSize="m" />}
              pressed={mobileSettings.safeArea}
              onClick={() =>
                setMobileViewSettings({ safeArea: !mobileSettings.safeArea })
              }
              data-test="mibi-ribbon-mobile-safe-area"
            />
          </div>
        </RibbonGroup>
        <RibbonGroup label={t('Mobile layout')}>
          <RibbonButton
            label={t('Back to the canvas')}
            hint={t('Edits the canvas of the report again')}
            icon={<Icons.DesktopOutlined iconSize="m" />}
            onClick={() => setMobileEditing(false)}
            data-test="mibi-ribbon-mobile-close"
          />
        </RibbonGroup>
      </>
    ),
    view: (
      <>
        <RibbonGroup label={t('Mobile')}>
          <RibbonButton
            label={t('Mobile layout')}
            hint={
              hasMobileLayout
                ? t('Edits the phone layout of this page')
                : t('Creates a phone layout for this page')
            }
            icon={<Icons.MobileOutlined iconSize="m" />}
            pressed={hasMobileLayout}
            onClick={openMobileLayout}
            data-test="mibi-ribbon-mobile-layout"
          />
        </RibbonGroup>
        <RibbonGroup label={t('Scale to fit')}>
          <RibbonButton
            label={t('Fit page')}
            icon={<Icons.CompressOutlined iconSize="m" />}
            pressed={view.mode === 'fit-page'}
            onClick={() => setCanvasView({ mode: 'fit-page' })}
            data-test="mibi-ribbon-fit-page"
          />
          <RibbonButton
            label={t('Fit width')}
            icon={<Icons.ColumnWidthOutlined iconSize="m" />}
            pressed={view.mode === 'fit-width'}
            onClick={() => setCanvasView({ mode: 'fit-width' })}
            data-test="mibi-ribbon-fit-width"
          />
          <RibbonButton
            label={t('Actual size')}
            icon={<Icons.ExpandOutlined iconSize="m" />}
            pressed={view.mode === 'custom' && view.zoom === 1}
            onClick={() => setCanvasView({ mode: 'custom', zoom: 1 })}
          />
        </RibbonGroup>
        <RibbonGroup label={t('Page options')}>
          <RibbonButton
            label={t('Gridlines')}
            icon={<Icons.TableOutlined iconSize="m" />}
            pressed={grid.visible !== false}
            onClick={() => updateGrid({ visible: grid.visible === false })}
            data-test="mibi-ribbon-gridlines"
          />
          <RibbonButton
            label={t('Lock objects')}
            hint={t('No object of the report can be moved, resized or removed')}
            icon={<Icons.LockOutlined iconSize="m" />}
            pressed={allLocked}
            onClick={() => setAllLocked(!allLocked)}
            data-test="mibi-ribbon-lock"
          />
        </RibbonGroup>
        <RibbonGroup label={t('Show panes')}>
          <RibbonButton
            label={t('Data')}
            icon={<Icons.DatabaseOutlined iconSize="m" />}
            pressed={!dataPaneFolded}
            data-test="mibi-ribbon-pane-data"
            onClick={() => {
              setPaneCollapsed('data', !dataPaneFolded);
              if (dataPaneFolded) setPaneCollapsed('builder', false);
            }}
          />
          {(
            [
              ['CHARTS', t('Charts'), <Icons.BarChartOutlined iconSize="m" />],
              [
                'LAYOUT_ELEMENTS',
                t('Elements'),
                <Icons.AppstoreOutlined iconSize="m" />,
              ],
              ['FORMAT', t('Format'), <Icons.BgColorsOutlined iconSize="m" />],
              [
                'SELECTION',
                t('Selection'),
                <Icons.OrderedListOutlined iconSize="m" />,
              ],
              [
                'BOOKMARKS',
                t('Bookmarks'),
                <Icons.BookOutlined iconSize="m" />,
              ],
            ] as const
          ).map(([key, label, node]) => (
            <RibbonButton
              key={key}
              label={label}
              icon={node}
              pressed={paneTab === key && !paneFolded}
              data-test={`mibi-ribbon-pane-${key.toLowerCase()}`}
              onClick={() => togglePane(key)}
            />
          ))}
        </RibbonGroup>
      </>
    ),
    format: (
      <>
        <RibbonGroup label={t('Interactions')}>
          <RibbonButton
            label={t('Edit interactions')}
            hint={t(
              'Choose how the selected chart filters the others of the page',
            )}
            icon={<Icons.ThunderboltOutlined iconSize="m" />}
            disabled={!isChart}
            pressed={editingInteractions}
            onClick={() => setEditingInteractions(!editingInteractions)}
            data-test="mibi-ribbon-interactions"
          />
        </RibbonGroup>
        <RibbonGroup label={t('Arrange')}>
          {arrangeButton}
          <div className="stack">
            <RibbonButton
              small
              label={t('Bring to front')}
              icon={<Icons.VerticalAlignTopOutlined iconSize="m" />}
              onClick={() => layer('front')}
            />
            <RibbonButton
              small
              label={t('Send to back')}
              icon={<Icons.VerticalAlignBottomOutlined iconSize="m" />}
              onClick={() => layer('back')}
            />
            <RibbonButton
              small
              label={t('Duplicate')}
              hint={t('Duplicate (Ctrl+D)')}
              icon={<Icons.CopyOutlined iconSize="m" />}
              disabled={!isCopyable(item)}
              onClick={() => primary && duplicate(primary)}
              data-test="mibi-duplicate"
            />
          </div>
        </RibbonGroup>
        <RibbonGroup label={t('Object')}>
          <RibbonButton
            label={item?.meta?.mibiLocked ? t('Unlock') : t('Lock')}
            icon={
              item?.meta?.mibiLocked ? (
                <Icons.UnlockOutlined iconSize="m" />
              ) : (
                <Icons.LockOutlined iconSize="m" />
              )
            }
            pressed={!!item?.meta?.mibiLocked}
            data-test="mibi-ribbon-lock-object"
            onClick={() =>
              ids.forEach(id =>
                dispatch(
                  setComponentMeta(
                    id,
                    'mibiLocked',
                    item?.meta?.mibiLocked ? undefined : true,
                    `lock:${id}:${Date.now()}`,
                  ) as never,
                ),
              )
            }
          />
          <RibbonButton
            label={item?.meta?.mibiHidden ? t('Show') : t('Hide')}
            hint={t('A hidden object stays on the page, only for editors')}
            icon={
              item?.meta?.mibiHidden ? (
                <Icons.EyeOutlined iconSize="m" />
              ) : (
                <Icons.EyeInvisibleOutlined iconSize="m" />
              )
            }
            pressed={!!item?.meta?.mibiHidden}
            data-test="mibi-ribbon-hide-object"
            onClick={() =>
              ids.forEach(id => {
                clearVisibilityOverride(id);
                dispatch(
                  setComponentMeta(
                    id,
                    'mibiHidden',
                    item?.meta?.mibiHidden ? undefined : true,
                    `hide:${id}:${Date.now()}`,
                  ) as never,
                );
              })
            }
          />
          <RibbonButton
            label={t('Format')}
            icon={<Icons.BgColorsOutlined iconSize="m" />}
            onClick={() => openBuilderTab('FORMAT')}
          />
        </RibbonGroup>
      </>
    ),
    data: (
      <>
        <RibbonGroup label={t('Visual')}>
          <RibbonButton
            label={t('Edit visual')}
            hint={t('Fields and type of the chart, in the side panel')}
            icon={<Icons.EditOutlined iconSize="m" />}
            onClick={editVisual}
            data-test="mibi-ribbon-edit-visual"
          />
          <RibbonButton
            label={t('Refresh visual')}
            icon={<Icons.ReloadOutlined iconSize="m" />}
            data-test="mibi-ribbon-refresh-visual"
            onClick={() => {
              const chartId = item?.meta?.chartId as number | undefined;
              if (chartId) {
                dispatch(refreshChart(chartId, true, dashboardId) as never);
              }
            }}
          />
        </RibbonGroup>
        <RibbonGroup label={t('Drill through')}>
          <RibbonButton
            label={t('Drill through')}
            hint={t(
              'Set on the destination page, in the Format pane of the canvas',
            )}
            icon={<Icons.ArrowRightOutlined iconSize="m" />}
            onClick={() => openFormat(null)}
          />
        </RibbonGroup>
      </>
    ),
  };

  const tabs: { key: RibbonTabKey; label: string; contextual?: boolean }[] =
    mobileEditing
      ? [{ key: 'mobile', label: t('Mobile layout') }]
      : [
          { key: 'home', label: t('Home') },
          { key: 'insert', label: t('Insert') },
          { key: 'design', label: t('Design') },
          { key: 'view', label: t('View') },
          ...(item
            ? [{ key: 'format' as const, label: t('Format'), contextual: true }]
            : []),
          ...(isChart
            ? [
                {
                  key: 'data' as const,
                  label: t('Data and drill'),
                  contextual: true,
                },
              ]
            : []),
        ];

  return (
    <RibbonBar data-test="mibi-ribbon">
      <RibbonTabs role="tablist" aria-label={t('Ribbon')}>
        {tabs.map(({ key, label, contextual }) => (
          <RibbonTab
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key && !folded}
            $active={tab === key && !folded}
            $contextual={contextual}
            data-test={`mibi-ribbon-tab-${key}`}
            onClick={() => openTab(key)}
          >
            {label}
          </RibbonTab>
        ))}
        <span className="spacer" />
        {allLocked && (
          <Button
            buttonStyle="link"
            buttonSize="xsmall"
            data-test="mibi-ribbon-unlock-all"
            onClick={() => setAllLocked(false)}
          >
            <Icons.LockOutlined iconSize="s" />
            {t('Objects locked: unlock')}
          </Button>
        )}
        <Button
          buttonStyle="link"
          buttonSize="xsmall"
          aria-label={folded ? t('Show the ribbon') : t('Hide the ribbon')}
          title={folded ? t('Show the ribbon') : t('Hide the ribbon')}
          data-test="mibi-ribbon-fold"
          onClick={() => fold(!folded)}
        >
          {folded ? (
            <Icons.DownOutlined iconSize="s" />
          ) : (
            <Icons.UpOutlined iconSize="s" />
          )}
        </Button>
      </RibbonTabs>
      {!folded && <RibbonBody role="tabpanel">{body[tab]}</RibbonBody>}
      {lineage && <LineageModal show onHide={() => setLineage(false)} />}
      {discardHolder}
    </RibbonBar>
  );
}

/** The mode of the report: leaving Editing for Reading discards the changes. */
export function ModeMenu({
  dirty,
  onReading,
}: {
  dirty: boolean;
  onReading: () => void;
}) {
  const [confirmLeaving, holder] = useConfirmDiscard(dirty, onReading);
  return (
    <>
      {holder}
      <Dropdown
        trigger={['click']}
        menu={{
          selectedKeys: ['editing'],
          items: [
            {
              key: 'reading',
              label: t('Reading'),
              icon: <Icons.EyeOutlined iconSize="m" />,
            },
            {
              key: 'editing',
              label: t('Editing'),
              icon: <Icons.EditOutlined iconSize="m" />,
            },
          ],
          onClick: ({ key }) => {
            if (key === 'reading') confirmLeaving();
          },
        }}
      >
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          data-test="mibi-mode-menu"
          aria-label={t('Report mode')}
        >
          <Icons.EditOutlined iconSize="m" />
          {t('Editing')}
          <Icons.DownOutlined iconSize="xs" />
        </Button>
      </Dropdown>
    </>
  );
}
