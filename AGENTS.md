# LLM Context Guide for AuraData BI (Apache Superset fork)

AuraData BI is a data visualization platform built on Apache Superset 6.1: a Flask/Python backend and a React/TypeScript frontend. See **AuraData BI: What This Fork Changes** below for what differs from upstream.

## ⚠️ CRITICAL: Work From `main`, Never From `master`

**`main` is the AuraData BI branch.** Start every branch from `main`, merge into `main`, and open pull
requests against `main`.

`master` and the numbered branches (`6.1`, `7.0`, ...) are copies of Apache Superset that came with
the fork: they have none of AuraData BI (branding, workspaces, Format pane, Spanish translations...).
A branch made from `master` looks like a plain Superset and its pull request would try to undo the
whole fork. If you find yourself on such a branch, stop and start again from `main`.

```bash
git fetch origin main
git checkout -b my-change origin/main
```

Upstream Superset fixes come into `main` by merging an upstream release branch (see README.md),
never by basing work on `master`.

## Run Pre-commit Before Pushing

Always run pre-commit against the files changed by the current branch before
pushing. This matches CI and keeps unrelated failures already present on
`master` from blocking otherwise independent work.

```bash
# Stage your changes first
git add .

# Run pre-commit on staged files
pre-commit run

# If there are auto-fixes, stage them and commit
git add .
git commit --amend  # or new commit
```

Use `pre-commit run --all-files` when auditing or repairing the repository-wide
baseline. If that check finds failures in files untouched by the current branch,
fix them in a separate branch rather than adding unrelated changes to the
current pull request.

Common pre-commit failures:
- **Formatting** - black, oxfmt, eslint will auto-fix
- **Type errors** - mypy failures need manual fixes
- **Linting** - ruff, pylint issues need manual fixes

## AuraData BI: What This Fork Changes

This repository is **AuraData BI**, a fork of Apache Superset 6.1 shaped like Power BI. `README.md`
(Spanish) is the human overview. Read this section before touching anything below.

### Product rules
- **Spanish first.** The UI defaults to Spanish, English is the second language. Every new
  user-facing string goes through `t()`/`tn()` *and* gets a Spanish entry in
  `superset/translations/es/LC_MESSAGES/messages.po` (informal "tú", «» quotes). Rebuild with
  `npm run build-translation` in `superset-frontend/`; `messages.json`/`messages.mo` are
  generated and git-ignored.
- **One dashboard per chart** (`MIBI_SINGLE_DASHBOARD_CHARTS`, `superset/mibi/single_dashboard.py`).
  Commands, importers and the MCP tools validate it; an ORM listener is the safety net.
  Charts are created and edited from a side panel of their dashboard (`src/mibi/chartEditor.ts`,
  `src/mibi/dashboard/ChartEditorPanel.tsx`); there is no chart list screen.
- **Reports are built from their dashboard.** The sidebar and the "New" menu only hold home,
  workspaces, dashboards and administration (database connections are "Connections" there).
  Datasets, new datasets and SQL Lab open from the "Data" menu of a dashboard in edit mode, in
  its side panel (`src/mibi/dashboard/DataMenu.tsx`, `ChartEditorPanel.tsx`); their pages are
  wrapped in `panelOnly` (`src/mibi/PanelGate.tsx`) and redirect when opened on their own. A
  dashboard shows without the sidebar, with the logo in the top bar (`isReportRoute`).
- **Workspaces** group dashboards, with members and roles (viewer, contributor, admin)
  (`MIBI_WORKSPACE_ACCESS`). A role never grants data access: Superset counts editorship
  (`is_editor`) as data access, so contributors and admins edit through
  `security_manager.can_edit_resource` (used by `raise_for_editorship` and the edit points) and
  never become editors (`keep_subjects` in `compute_subjects`). A new edit point asks
  `can_edit_resource`; a data-access check keeps `is_editor` (`tests/unit_tests/mibi/workspace_security_test.py`).
- **Flags fixed by the product** (`FORCED_OFF_FLAGS`, `superset/utils/feature_flag_manager.py`): Superset's mobile consumption mode
  (`mibiMobile` replaces it) and Table V2 stay off whatever the configuration says.
- **Soft delete and version history** (on by default since 7.0): a deleted dashboard, chart or
  dataset keeps its row (`deleted_at`) and links. The trash lives on the workspace page (contributors and admins,
  `/api/v1/workspace/<id>/trash/`) and in Administration (`/archived/`, "Papelera"); the history opens from the "…" menu of a
  dashboard. A contributor reads the history, copies dashboards (the copy keeps the original's editors and workspace) and lists
  the drafts of the workspace, never becoming an editor. Fork rules count only live rows: 7.0's ORM
  visibility filter hides them from ORM queries, but queries over link tables (`dashboard_slices`,
  `mibi_workspace_*`) must join the live rows themselves (`_live_links` in `single_dashboard.py`).
- **Datasets belong to a workspace** (`MIBI_WORKSPACE_DATASETS`, `superset/mibi/workspace_datasets.py`),
  like Power BI semantic models: a dataset is in one workspace at most, and one without a
  workspace is shared. Only members (and editors, admins) list a workspace's datasets
  (`WorkspaceDatasetFilter` on the dataset API), and a chart only uses datasets of its
  dashboard's workspace or shared ones (`validate_chart_dataset` in the chart commands). A
  dataset created from a dashboard's side panel joins its workspace (`linkNewDataset`); the
  workspace page lists them, and the `dataset_usable_in_dashboard` filter narrows the dataset
  pickers of the panel.
- **AuraData brand** (https://auradata.mx/brand-guidelines): the product is "AuraData BI", the
  Continua logo plus a "BI" tag rendered as HTML (`src/mibi/shell/brand.ts`, `ProductTag`), never
  drawn into the logo file. Write the company as "AuraData" (capital A and D). Outfit for text,
  Geist Mono for data and eyebrow labels; Azul Aura `#2563EB`, violet `#7C3AED`, green `#10B981`;
  the 100° blue→violet→green gradient only as a headline accent. Logos and icons live in
  `superset-frontend/src/assets/images/auradata/`.
- Branding, theme tokens, languages and chart palettes live in `superset/mibi_config.py`.
- **Databases offered:** PostgreSQL, SQL Server (pymssql), MySQL, Databricks, Amazon Redshift and DuckDB, as cards
  with their logo (`PREFERRED_DATABASES` in `mibi_config.py`, logos in `src/mibi/databases/dbImages.ts`). Their drivers
  are installed in the `dev` and `prod` targets of the `Dockerfile`; a new database needs its driver there too.
- **The editor has a ribbon, as in Power BI** (`src/mibi/ribbon`): Home, Insert, Design and View,
  plus Format and Data and drill for the selected object. It lives under the top bar in `Header`, and
  commands of the ribbon call the same actions as the panes. A new command goes there, in a named
  group; settings stay in the panes (`BuilderComponentPane`: charts, elements, format, selection,
  bookmarks), which `openBuilderTab` opens.
- **A report's title and actions sit in the top bar** (`useReportHeaderSlot`, `src/mibi/shell/reportHeader.ts`): `Header`
  portals them there, and keeps them over the page without a top bar (standalone, embedded, phones).
- **Pages share one margin:** `--mb-space-gutter`, `--mb-space-page-top` and `--mb-space-section` (`ThemeVariables`), tighter in
  the side panel (`body.mibi-panel`). A list shows one row of filters and folds the rest under «Más filtros» (`ListView`).
- **The look is fixed by the product.** There are no saved themes and no CSS templates: no
  theme screen, API or per-dashboard theme, and `ThemeController` only switches between the
  `THEME_DEFAULT` and `THEME_DARK` of the configuration (light, dark, match system). Set
  `THEME_DARK = None` to force a single look. A dashboard keeps its own `css` field.
- Internal names keep the `mibi` prefix (`src/mibi`, `superset/mibi`, `MIBI_*`, `mibi_*` tables,
  `meta.mibi*` layout keys, the `mibi` palette id): saved dashboards and migrations depend on
  them. Rename only what users see.

### Where the code lives
| Area | Backend | Frontend (`superset-frontend/src/`) |
| --- | --- | --- |
| App shell, home, lists | `superset/mibi/previews.py`, `superset/mibi/api.py` | `mibi/shell`, `mibi/home`, `mibi/dashboards`, `assets/mibi/skin.css` |
| Workspaces and access | `superset/mibi/workspaces.py`, `workspace_access.py`, `models.py` | `mibi/workspaces` |
| Data page and datasets | `superset/mibi/data_views.py` | `mibi/data` |
| Format pane, cell grid | - | `mibi/format` |
| Chart format controls (labels, legend, axes, series, rules, table) | - | `explore/components/controls/{FontControl,SeriesColorsControl,ChartConditionalFormattingControl}`; sections in `packages/superset-ui-chart-controls/src/sections/visualFormat.tsx`; helpers in `plugins/plugin-chart-echarts/src/utils/formatting.ts` and `plugins/plugin-chart-table/src/utils/tableFormat.ts` |
| Background and element pictures | `superset/mibi/backgrounds.py` | `mibi/format/actions.ts`, `mibi/elements` |
| Design elements (image, shape, button, text, canvas filter) | - | `mibi/elements` |
| Filter bar levels (all pages / this page / visuals), instant apply | `dashboards/schemas.py` (`filter_bar_auto_apply`) | `dashboard/components/nativeFilters/scopeLevel.ts`, `FilterBar/` |
| Presentation mode, PDF/PNG export | - | `mibi/present`, `mibi/export` |
| Ribbon and lineage | - | `mibi/ribbon` |
| Selection pane, locked and hidden objects, page menu | - | `mibi/format/SelectionPane.tsx`, `mibi/format/lock.ts`, `mibi/report/PageMenu.tsx`, `mibi/report/pageActions.ts` |
| Report interactivity (edit interactions, drill through, sync slicers, bookmarks, Back/bookmark buttons, tooltip pages, reset filters) | - | `mibi/report` |
| Chart type icons | - | `mibi/vizIcons` |

AuraData BI APIs: `/api/v1/workspace/` (with `<id>/dashboards/` and `<id>/datasets/`),
`/api/v1/dashboard_background/<dashboard>/`, `/api/v1/dashboard_image/<dashboard>/<image>/`,
`/api/v1/mibi/dashboard_previews/`. Each new API is registered in `superset/initialization/__init__.py`.

### Dashboard formatting lives in the layout
Formats are stored in `position_json`, so they save, undo and export with the dashboard:
- Canvases always have a fixed page size, as in Power BI (16:9 by default, 4:3, letter or custom;
  see `canvasSize`); 16:9 is Full HD, 60 × 34 cells (1920 × 1088 px), and the other presets
  share its height. There is no screen-width mode: a phone shows the same canvas, scaled to its width,
  unless the page has a mobile layout (below).
  While editing, the page is a limit: resizing stops at its bottom (`useMaxHeightMultiple`) and a
  change that overflows it fits the visuals back inside (`CanvasFrame`).
- `ROOT_ID.meta.mibiCanvas`: canvas format (`CanvasFormat` in `src/mibi/format/types.ts`),
  including `visuals`, the style every chart shares (from "Apply to all charts").
- `CHART-*.meta.mibiFormat`: a chart's own format. It wins over the shared style setting by
  setting; read it with `useVisualFormat`/`mergeVisualFormat`, never `meta.mibiFormat` alone.
- `CHART-*.meta.mibiFormat.chart`: settings of the chart itself, by form data key, over its saved
  `form_data` (`withChartFormat` in `src/mibi/format/chartFormat.ts`). A change repaints without a
  query, and a key here wins over the same key saved by Explore. A layout can take 512 KB
  (`SUPERSET_DASHBOARD_POSITION_DATA_LIMIT`).
- The Visual level of the Format pane draws the look controls of each chart's control panel with
  Explore's `Control` (`mibi/format/ChartFormatSections.tsx`), sorted into the sections of
  `mibi/format/formatCards.ts`. A new control of a chart shows by itself; give it a section there.
  A control declared twice, as bars do for each orientation, shows the version whose `visibility` applies. A control
  that reports its value on mount changes nothing: `setValue` ignores a value equal to the current one.
  The editor docked beside a report only has the data tab. Settings tied to one chart
  (`OWN_CHART_SETTINGS`) and what names one chart (subtitle, header help text, action, action button) stay out of "Copy
  format" and "Apply to all charts" (`sharableFormat`, `ownFormat`).
- Bars, lines, areas and combos have more options in `plugins/plugin-chart-echarts/src/utils/chartFormatOptions.ts`:
  `applySeriesFormat` for one series, `applyChartFormat` for what takes the whole chart (color scale, label blocks,
  total labels, series labels, legend title, plot area, category scroll) and the `*AxisFormatOptions` for the axes.
  A value of the shared `gridline_*` keys is the fallback of `x_gridline_*` and `y_gridline_*`. `series_format` holds what
  a series changes by name (`SeriesFormatControl`). Total labels are marks of no height at the end of each stack, and a
  legend title is a series without marks: both have ids starting with `__mibi`. `CardDefinition.headings` starts a group
  inside a section of the pane.
- Cards and special ECharts charts use `sections/chartFamilies.ts` for their extra controls. Card HTML text and KPI
  status are resolved in `BigNumber/cardFormat.ts`; an optional `goal_metric` belongs to Data and uses the indicator's
  aggregation, while `kpi_target_value` only repaints. No goal keeps the older comparison behavior. Zero is a valid goal;
  a percent distance from zero is N/A. `utils/specialChartFormat.ts` preserves original data shapes, helper series and hooks;
  scatter's shared formatting has already run, so do not apply it twice. Ratio/shading require numeric linear axes.
  Card value controls are unified: `legacyCardFormat` reads older `value`/`label` styles as defaults, and card text sets
  local CSS variables so explicit font settings beat the older important rules without rewriting layouts.
  Fixed targets, labels and category mappings belong to `OWN_CHART_SETTINGS`. A donut's center takes an image of this
  site or a data address (`center_image`, `sameOriginImage`: an image of another host would taint the canvas and break
  exports) and a label on its own (`center_label`); a waterfall keeps its `waterfall_max_breakdowns`
  largest breakdowns per period and adds the rest up; a gauge can read its target from a field (`gauge_target_metric`,
  a query control). Treemap tiling alternatives (ECharts only has squarify) and automatic marker containment are still
  open; do not expose controls for them until implemented. Roadmap state is in `docs/plans/estado-formato-powerbi.md`.
- Lines, areas, steps and smooth lines move a series to a secondary Y axis from `series_format` (`axis: 'secondary'`,
  `applySecondaryAxis`); the chart keeps one axis object until a series moves, and bars and charts drawn across never
  get one. Zoom sliders take values instead of percents (`zoom_in_values`) and reach that axis (`zoom_secondary_*`).
  `value_label_density` hides the label of all but every step-th point. The combo's tooltip fields are a third query by
  the X-axis only. A matrix freezes its row headers (`table_freeze_row_headers`, offsets measured per level in
  `TableRenderer`) and its value cells open tooltip pages. Small multiples read their grid format from `matrixify_grid_*`,
  `matrixify_cell_*` and `matrixify_header_*` (`matrixifyGridStyle`). A table can describe the images of a row by another
  column (`table_alt_text_column`) and name its rows by one (`table_row_reference_column`, a `rowheader` cell).
- A control goes in the first section of `CARD_DEFINITIONS` that names it, and `table_cell` only exists for tables.
- Tables and matrices share render-only controls and scoped CSS in
  `packages/superset-ui-chart-controls/src/sections/tableFormat.ts`; the plain table keeps its existing
  `tableFormat` helper, and the pivot renderer receives raw `tableFormat` from `transformProps`.
  Extended column styles are enabled only by `tableFormatting` in the two supported control panels;
  do not expose them through the default column editor of another renderer without implementing them.
  Matrix sparklines use existing column groups, table sparklines require ordered numeric arrays, and
  neither introduces a new query role. Resolve result-dependent choices before control validation,
  and merge pending column edits before sending a debounced update.
- The General level also covers header icons (`mibi/format/HeaderExtras.tsx`), action button and
  chart link (`format.link`, `format.actionButton`), spacing, and the tooltip and sampling of
  ECharts (`chart.mibi_tooltip`, `chart.mibi_sampling`), which reach the chart through
  `data-mibi-echarts` on the holder (`echartsHostFormat`, `applyHostFormat`).
- Design elements are `DYNAMIC` components whose `componentKey` starts with `mibi-`, with their
  settings in `meta.mibiElement` (`src/mibi/elements/types.ts`).
  The canvas filter element (`mibi-filter`) stores `filterId` and `showInFilterBar`; filters
  with `showInFilterBar: false` are left out of the filter bar (`useCanvasOnlyFilterIds`).
- The canvas is a grid of square cells of `CELL` = 32 px (`src/mibi/format/types.ts`). Its size
  is a whole number of cells, so its width in cells is the number of columns of the layout. Every
  `meta.width` and `meta.height` is in cells, there are no margins or gaps between objects, and the
  edit-mode grid always draws lines at every cell. Use `src/mibi/format/columns.ts`
  (`columnCountOf(layout)`, `gridColumnCount()`, `minObjectColumns()`), never `GRID_COLUMN_COUNT`.
  `layoutToCells` (`cells.ts`) converts layouts saved before the cell grid (12/24/48 columns, heights
  in 8 px steps, canvas padding and gap) on load; `ROOT_ID.meta.mibiCells` marks a converted layout.
- Charts, elements and text boxes sit at an absolute cell of the page: `meta.mibiPos` is `{x, y}` in
  cells from its top-left corner, so moving or resizing one never moves another. Rows stay as
  containers. A drop sets
  the cell from where the object lands (`src/mibi/format/positions.ts`, `DropResult.cell`, handled
  in `handleComponentDrop`); `layoutToPositions` gives a cell to every object without one on load.
  A chart added without a drop (saved from the side panel or Explore, or attached outside edit
  mode) takes the first free cell of its page (`freeCell`), never one over another object.
- `TAB-*.meta.mibiMobile` (`GRID_ID` for a report of one page) is the optional mobile layout of a page, as in
  Power BI: `{items: [{id, x, y, width, height}]}` in cells of a phone page `MOBILE_COLUMNS` (12) wide, back
  to front (`src/mibi/format/mobileLayout.ts`). It only places objects the page already has; read it with
  `mobileLayoutOf`, which drops boxes of objects that left the page. A phone (`usePhoneScreen`) shows it when
  the page has one and the canvas otherwise; nothing switches layout on its own. `DashboardComponent` gives
  each object its box (`mobileComponent`) and leaves out the rest. The editor opens it from View → Mobile
  layout (`useMobileEditing`): the page shows inside an iPhone (`DeviceFrame`, presets with points, pixels
  and safe-area insets in `mobileDevices.ts`) and scrolls only between its safe insets, `MobileLayoutPane`
  replaces the panes and the ribbon gets a Mobile layout tab. "Place" draws `MobileLayoutEditor` over the
  page; "Preview" shows it as a phone viewer sees it, or the scaled canvas when the page has no layout.
  Mode, device, fit and safe-area marks are a browser preference (`useMobileViewSettings`), never saved in
  the report. The canvas never fits its visuals while it is open. A phone viewer gives the page the whole
  width of the screen, less the closed filter rail, which a phone shows only when the report has filters
  (`useNativeFilters`). The preview draws what a phone viewer loses around the page (the app bars and that
  rail, `VIEWER_*` in `DeviceFrame.tsx`, measured on a phone 393 pt wide); keep them in step with the shell.
- The report is light or dark from the canvas background color (`useReportAppearance`); there are no
  appearance settings.
- `meta.mibiHidden` hides an object from viewers (faded for editors), `meta.mibiLocked` keeps it from
  being moved, resized or removed; both are set in the Selection pane (`mibi/format/SelectionPane.tsx`)
  and the object tabs of the ribbon. "Lock objects" locks the whole report for one editor, in the
  browser (`mibi/format/lock.ts`). `TAB-*.meta.mibiHiddenPage` hides a page from the tabs and the
  navigators of viewers; links and drill through still open it.
- `meta.mibiAltText` is the description of a chart for screen readers.
- Report interactivity (`src/mibi/report`), Power BI style:
  - `ROOT_ID.meta.mibiBookmarks`: bookmarks (page, filter and cross-filter selections, visibility).
    Applying one sets a browser-only visibility override (`visibility.ts`) on top of `mibiHidden`.
  - `TAB-*.meta.mibiDrillthrough`: `{columns}` a page accepts for "Drill through". The filter is the
    `mibi-drillthrough` data mask, scoped to that page's charts in `getAllActiveFilters`.
  - "Edit interactions" changes `chart_configuration` cross-filter scopes (filter or none; Superset
    charts cannot highlight); it saves with the dashboard.
  - "Sync slicers" sets the native filter scope (saved right away, like any filter setting) and
    places copies of the canvas filter on other pages (saved with the dashboard).
  - Tooltip pages: `TAB-*.meta.mibiTooltipPage` (`{width, height, columns}` in cells) makes a page a
    tooltip, hidden from viewers (`isHiddenPage`, also left out of the tab list) and edited at that size
    (`CanvasFrame`, objects past its edge are clipped). A chart picks one in General › Tooltips
    (`meta.mibiFormat.tooltipPage`: `type: 'page'`, `page` or none for Auto, the tooltip page whose
    `columns` the chart groups by). On hover, `Echart.tsx` and the table's cells call the plugin's own
    `contextmenu` handler with a probe mark (`data-mibi-probe`); `ChartRenderer` turns that call into a
    `mibi:mark-hover` event instead of the menu, and cards (`WHOLE_CHART_TOOLTIP`) send one for the
    whole chart. `TooltipPageHost` draws the page's charts with `SuperChart` and its own queries
    (dashboard filters plus the mark's values, a date of a grain as a `TEMPORAL_RANGE`, outside Redux),
    plus its text boxes, images, shapes, buttons and texts; slicers and navigators are left out. Queries
    wait a moment, are cached by form data and aborted when the pointer leaves (`tooltipPages.ts`); the
    line of a series never replaces the point of it under the pointer (`isLessPrecise`).
  - "Reset filters" (`resetFilters.ts`, reading view and ribbon) sets every native filter and slicer to
    its default, clears cross-filters, leaves a drill through and drops bookmark visibility overrides.
- A fixed page shows a bar at the bottom, as in Power BI (`PageBar` in `mibi/report/TabsDock.tsx`), of a
  fixed size whatever the zoom: previous/next arrows, flat page tabs split by hairlines with the accent
  under the active one, "Page 1 of 3" and the zoom with a fit choice (`ZoomToolbar docked`); narrow bars
  drop the slider, then the fit choice. Presenting and the mobile layout keep the tabs above the page.
- With the page bar, the vertical filter pane is a pane of the report at its right edge, as tall as the
  page area and out of the page (`FilterDockTarget atEdge` in `CanvasFrame`); the page floats alone and its
  zoom does not count the pane. Presenting keeps the pane beside the page.
- The vertical filter pane stays beside the page while editing. Each filter is a card (`mibi/dashboard/FilterCard.tsx`):
  name and what it selects (`filterSummary`: "is (All)", "is North"), folded until opened (remembered in
  the browser), with the accent on its edge while it selects something; the folded rail counts the
  filters that select something.
- Write layout changes through `src/mibi/format/actions.ts` (`updateLayout`, `setVisualFormat`,
  `setCanvasFormat`, `setSharedVisualFormat`) so edits group into one undo step.
- A canvas filter of a list of values can draw itself as a dropdown, list, buttons or text box (`mibi/elements/SlicerView.tsx`,
  `meta.mibiElement.variant`). Only the dropdown is the filter plugin; the others ask for its values with `getFormData` and
  write the same data mask. A range filter can draw itself as "Between" boxes or a slider (`rangeStyle`) and a time filter as
  a relative date or two days (`dateStyle`, `RangeSlicerView.tsx`); the rules of selection, sorting, value format and time
  ranges live in `mibi/elements/slicer.ts`. A slicer's Format pane (`SlicerFormat.tsx`) has a Visual and a General level; the
  General level reuses `TitleSections`, `BoxSections` and alt text, and its title is drawn by `ElementTitle`; the title
  text of an element is its own and stays out of "Copy format". A filter that takes one value keeps one whatever the slicer
  says. `hiddenValues` leaves values out of one slicer only (keys from `slicerValueKey`); they still count in the charts.
  `SlicerIcons` draws the eraser, the header help text and the action of `meta.mibiFormat`. Not built: a hierarchy slicer
  (it needs an OR across columns that native filters cannot express).
- The Analytics level of the pane holds the cards with `level: 'analytics'`. `utils/analyticsFormat.ts` draws
  `reference_lines` and the trend line as series with `__mibi` ids, and the zoom sliders. `tooltip_metrics` are a second query
  of the timeseries charts, so they never change the series. Small multiples are Matrixify, opened to the pane without its flag.
- `DASHBOARD_VIRTUALIZATION` stays off: rows have no height and the page scrolls inside its own container, so row observers
  would unmount every chart on scroll. Playwright hides this kind of bug: `navigator.webdriver` turns virtualization off too.
- The Fields level of the pane (`mibi/format/ChartFieldsSections.tsx`) draws the query controls of a chart with Explore's
  `Control`; `chartFields.ts` names them by role. Fields are chart settings, never layout ones: a change previews through the
  chart's form data and `saveChartFields` writes it to the chart, with a new `query_context`, when the report saves. A key the
  layout holds moves out of it. Tooltip fields and small multiples stay in the layout. `mibi/format/DataPane.tsx` is the Data pane.
- There are no saved format themes: each dashboard is formatted on its own.

### Migrations
Fork migrations form one chain after the Superset 6.1 head (`4b2a8c9d3e1f`):
`8bc9e5b95335` (workspaces) → `cce7fe34b50d` (members) → `3a90eb47d506` (backgrounds) →
`06c8a16b9fe1` (element images) → `b7d41e0c9a23` (format themes) → `e4ec3b61cadb` (drops the
format themes) → `a91c5d27f3e8` (drops the annotation layers) → `c5f08a1d7e42` (drops the
themes and CSS templates) → `d3f9a2b17c64` (workspace datasets). The chain ends in the merge revision
`f1c7a9e2b305`, whose `down_revision` is the Superset 7.0 head (`88a01c781622`) and the fork head, so there is
one head and a database at `d3f9a2b17c64` still runs the 41 migrations of 7.0 on `db upgrade`.
- A new fork migration revises the current head (`f1c7a9e2b305` until the next one).
- Each new Superset release follows the same rule: add another merge revision of its head and the fork head.
  Never repoint `8bc9e5b95335` (or any fork revision) to the new upstream head: a database that already ran the
  fork migrations would skip the new upstream ones.
- Check both paths on a throwaway database, never the dev one: a new database and a copy at the previous head
  must both reach the new head.

### Tests for AuraData BI code
- Jest tests sit next to the code (`src/mibi/**/*.test.ts(x)`).
- Backend: `pytest tests/unit_tests/mibi/`.
- Browser: `superset-frontend/playwright/tests/experimental/` (dashboard format, export,
  theme, stress), run with `INCLUDE_EXPERIMENTAL=1`.

## ⚠️ CRITICAL: Ongoing Refactors (What NOT to Do)

**These migrations are actively happening - avoid deprecated patterns:**

### Frontend Modernization
- **NO `any` types** - Use proper TypeScript types
- **NO JavaScript files** - Convert to TypeScript (.ts/.tsx)
- **Use @superset-ui/core** - Don't import Ant Design directly, prefer Ant Design component wrappers from @superset-ui/core/components
- **Use antd theming tokens** - Prefer antd tokens over legacy theming tokens
- **Avoid custom css and styles** - Follow antd best practices and avoid styling and custom CSS whenever possible

### Testing Strategy Migration
- **Prefer unit tests** over integration tests
- **Prefer integration tests** over end-to-end tests
- **Use Playwright for E2E tests** - Cypress has been removed from this fork
- **Use Jest + React Testing Library** for component testing
- **Use `test()` instead of `describe()`** - Follow [avoid nesting when testing](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing) principles

### Backend Type Safety
- **Add type hints** - All new Python code needs proper typing
- **MyPy compliance** - Run `pre-commit run mypy` to validate
- **SQLAlchemy typing** - Use proper model annotations

### UUID Migration
- **Prefer UUIDs over auto-incrementing IDs** - New models should use UUID primary keys
- **External API exposure** - Use UUIDs in public APIs instead of internal integer IDs
- **Existing models** - Add UUID fields alongside integer IDs for gradual migration

## Security and Threat Model

Before evaluating any code path for security issues, read [`SECURITY.md`](SECURITY.md). It is the canonical, authoritative source for Apache Superset's security model and is referenced by both human reporters and automated scanners.

In short, the test for whether a finding is in scope is one question:

> *Does it let a principal perform an action the role and capability matrix in `SECURITY.md` does not entitle them to?*

If yes, it is in scope. If no, it is not.

The three trust boundaries are:

1. **The Admin role** is a fully trusted operational principal. Anything an Admin can do through documented configuration, API, or UI is an intended capability, not a vulnerability.
2. **The operator** owns deployment-time decisions (secrets, network exposure, feature-flag selection, connector and codec choices, notification destinations, third-party plugins). Misconfiguration at this layer is a deployment defect, not a Superset vulnerability.
3. **The codebase** is responsible for enforcing the role and capability matrix wherever it exposes functionality to a principal: API routes, command and DAO layers, UI handlers, background jobs, and any other entry point. A missing or incorrect enforcement check is in scope no matter where it lives.

The security model assumes that operator-controlled infrastructure, including the metadata database, cache backends, message brokers, secret stores, and deployment environment, remains within the operator's trust boundary. Vulnerabilities must demonstrate a security boundary violation by an attacker who does not already control those systems.

Route-level authorization in this codebase uses one of three Flask-AppBuilder decorators depending on the route type:

- `@protect()` for REST API routes (`ModelRestApi` / `BaseApi`)
- `@has_access_api` for legacy view routes
- `@has_access` for legacy HTML view routes

Object-level authorization via `security_manager.raise_for_access(...)` applies to data-bearing resources: dashboards, charts, datasets and datasources, queries, database and table access, and query contexts. Other resources (annotations, tags, CSS templates, reports, RLS rules, and similar) rely on the route-level decorator plus DAO `base_filters` for ownership scoping; the absence of `raise_for_access` on these resources is by design, not a finding. Code that omits the per-object gate on a route that returns or mutates a specific data-bearing object is in scope; code that follows the correct pattern for its resource class can still contain injection, SSRF, XSS, or other classes of finding unrelated to authorization, which are evaluated separately.

The full role and capability matrix, in-scope and out-of-scope class lists, and CVE aggregation rules are in [`SECURITY.md`](SECURITY.md). Defer to that document for any specifics.

**Requirements for findings filed by automated tooling**

Automated scanners (LLM-based code scanners, static analyzers, dependency tools) that file findings against this codebase must, in each finding, name:

1. The specific role and capability matrix row in [`SECURITY.md`](SECURITY.md) the finding believes is violated.
2. The principal the finding assumes the attacker holds (Public, Gamma, sql_lab, Alpha, Admin, Embedded guest token, or a custom role with explicit capability grants).

Findings that cannot identify both should be filed as questions, not vulnerabilities. This requirement exists to ensure every reported issue is testable against the published security model and to keep speculative or pattern-match-only reports out of the triage queue.

## Key Directories

```
superset/
├── superset/                    # Python backend (Flask, SQLAlchemy)
│   ├── views/api/              # REST API endpoints
│   ├── models/                 # Database models
│   └── connectors/             # Database connections
├── superset-frontend/src/       # React TypeScript frontend
│   ├── components/             # Reusable components
│   ├── explore/                # Chart builder
│   ├── dashboard/              # Dashboard interface
│   └── SqlLab/                 # SQL editor
├── superset-frontend/packages/
│   └── superset-ui-core/       # UI component library (USE THIS)
└── tests/                      # Python/integration tests
```

## Code Standards

### TypeScript Frontend
- **Avoid `any` types** - Use proper TypeScript, reuse existing types
- **Functional components** with hooks
- **@superset-ui/core** for UI components (not direct antd)
- **Jest** for testing (NO Enzyme)
- **Redux** for global state where it exists, hooks for local

### Python Backend  
- **Type hints required** for all new code
- **MyPy compliant** - run `pre-commit run mypy`
- **SQLAlchemy models** with proper typing
- **pytest** for testing

### Apache License Headers
- **New files require ASF license headers** - When creating new code files, include the standard Apache Software Foundation license header
- **LLM instruction files are excluded** - Files like AGENTS.md, CLAUDE.md, etc. don't need the header, to avoid token overhead

### Code Comments
- **Avoid time-specific language** - Don't use words like "now", "currently", "today" in code comments as they become outdated
- **Write timeless comments** - Comments should remain accurate regardless of when they're read

## Documentation Requirements

- **Docstrings**: Required for new functions/classes

## Architecture Patterns

### Security & Features
- **Security model**: see the top-level [Security and Threat Model](#security-and-threat-model) section and [`SECURITY.md`](SECURITY.md)
- **RBAC**: Role-based access via Flask-AppBuilder
- **Feature flags**: Control feature rollouts
- **Row-level security**: SQL-based data access control

## Test Utilities

### Python Test Helpers
- **`SupersetTestCase`** - Base class in `tests/integration_tests/base_tests.py`
- **`@with_config`** - Config mocking decorator
- **`@with_feature_flags`** - Feature flag testing
- **`login_as()`, `login_as_admin()`** - Authentication helpers
- **`create_dashboard()`, `create_slice()`** - Data setup utilities

### TypeScript Test Helpers
- **`superset-frontend/spec/helpers/testing-library.tsx`** - Custom render() with providers
- **`createWrapper()`** - Redux/Router/Theme wrapper
- **`selectOption()`** - Select component helper
- **React Testing Library** - NO Enzyme (removed)

### Test Database Patterns
- **Mock patterns**: Use `MagicMock()` for config objects, avoid `AsyncMock` for synchronous code
- **API tests**: Update expected columns when adding new model fields

### Running Tests
```bash
# Frontend
npm run test                           # All tests
npm run test -- filename.test.tsx     # Single file

# E2E Tests (Playwright, from superset-frontend/)
npm run playwright:test                # All Playwright tests
npm run playwright:ui                  # Interactive UI mode
npm run playwright:headed              # See browser during tests
npx playwright test tests/auth/login.spec.ts  # Single file
npm run playwright:debug tests/auth/login.spec.ts  # Debug specific file

# E2E tests of AuraData BI screens (opt-in)
INCLUDE_EXPERIMENTAL=1 npx playwright test tests/experimental/dashboard/format.spec.ts

# Backend  
pytest                                 # All tests
pytest tests/unit_tests/specific_test.py  # Single file
pytest tests/unit_tests/               # Directory

# If pytest fails with database/setup issues, ask the user to run test environment setup
```

## Environment Validation

**Quick Setup Check (run this first):**

```bash
# Verify the app is running (docker compose up -d --build, see README.md)
curl -f http://localhost:8088/health || echo "❌ Setup required - see README.md"
```

**If health checks fail:**
"It appears you aren't set up properly. Start the stack with `docker compose up -d --build` (see README.md), or refer to the [Working with LLMs](https://superset.apache.org/docs/contributing/development#working-with-llms) section of the Superset development docs."

**Key Project Files:**
- `superset-frontend/package.json` - Frontend build scripts (`npm run dev` on port 9000, `npm run test`, `npm run lint`)
- `pyproject.toml` - Python tooling (ruff, mypy configs)
- `requirements/` folder - Python dependencies (base.txt, development.txt)

## SQLAlchemy Query Best Practices  
- **Use negation operator**: `~Model.field` instead of `== False` to avoid ruff E712 errors
- **Example**: `~Model.is_active` instead of `Model.is_active == False`

## Pull Request Guidelines

**When creating pull requests:**

1. **Describe the change**: Include a summary, before/after notes for UI changes, and testing instructions
2. **Follow PR title conventions**: Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
   - Format: `type(scope): description`
   - Example: `fix(dashboard): load charts correctly`
   - Types: `fix`, `feat`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## Pre-commit Validation

**Use pre-commit hooks for quality validation:**

```bash
# Install hooks
pre-commit install

# IMPORTANT: Stage your changes first!
git add .                        # Pre-commit only checks staged files

# Quick validation (faster than --all-files)
pre-commit run                   # Staged files only
pre-commit run mypy              # Python type checking
pre-commit run format            # Code formatting
pre-commit run eslint            # Frontend linting
```

**Important pre-commit usage notes:**
- **Stage files first**: Run `git add .` before `pre-commit run` to check only changed files (much faster)
- **Virtual environment**: Activate your Python virtual environment before running pre-commit
  ```bash
  # Common virtual environment locations (yours may differ):
  source .venv/bin/activate      # if using .venv
  source venv/bin/activate       # if using venv
  source ~/venvs/superset/bin/activate  # if using a central location
  ```
  If you get a "command not found" error, ask the user which virtual environment to activate
- **Auto-fixes**: Some hooks auto-fix issues (e.g., trailing whitespace). Re-run after fixes are applied

## Common File Patterns

### API Structure
- **`/api.py`** - REST endpoints with decorators and OpenAPI docstrings
- **`/schemas.py`** - Marshmallow validation schemas for OpenAPI spec
- **`/commands/`** - Business logic classes with @transaction() decorators
- **`/models/`** - SQLAlchemy database models
- **OpenAPI docs**: Auto-generated at `/swagger/v1` from docstrings and schemas

### Migration Files
- **Location**: `superset/migrations/versions/`
- **Naming**: `YYYY-MM-DD_HH-MM_hash_description.py`
- **Utilities**: Use helpers from `superset.migrations.shared.utils` for database compatibility
- **Pattern**: Import utilities instead of raw SQLAlchemy operations

## Platform-Specific Instructions

- **[CLAUDE.md](CLAUDE.md)** - For Claude/Anthropic tools (symlink to this file)

---

**LLM Note**: This codebase is actively modernizing toward full TypeScript and type safety. Always run `pre-commit run` to validate changes. Follow the ongoing refactors section to avoid deprecated patterns.
