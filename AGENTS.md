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

## ⚠️ CRITICAL: Always Run Pre-commit Before Pushing

**ALWAYS run `pre-commit run --all-files` before pushing commits.** CI will fail if pre-commit checks don't pass. This is non-negotiable.

```bash
# Stage your changes first
git add .

# Run pre-commit on all files
pre-commit run --all-files

# If there are auto-fixes, stage them and commit
git add .
git commit --amend  # or new commit
```

Common pre-commit failures:
- **Formatting** - black, prettier, eslint will auto-fix
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
- **Workspaces** group dashboards, with members and roles (viewer, contributor, admin)
  (`MIBI_WORKSPACE_ACCESS`).
- **AuraData brand** (https://auradata.mx/brand-guidelines): the product is "AuraData BI", the
  Continua logo plus a "BI" tag rendered as HTML (`src/mibi/shell/brand.ts`, `ProductTag`), never
  drawn into the logo file. Write the company as "AuraData" (capital A and D). Outfit for text,
  Geist Mono for data and eyebrow labels; Azul Aura `#2563EB`, violet `#7C3AED`, green `#10B981`;
  the 100° blue→violet→green gradient only as a headline accent. Logos and icons live in
  `superset-frontend/src/assets/images/auradata/`.
- Branding, theme tokens, languages and chart palettes live in `superset/mibi_config.py`.
- Internal names keep the `mibi` prefix (`src/mibi`, `superset/mibi`, `MIBI_*`, `mibi_*` tables,
  `meta.mibi*` layout keys, the `mibi` palette id): saved dashboards and migrations depend on
  them. Rename only what users see.

### Where the code lives
| Area | Backend | Frontend (`superset-frontend/src/`) |
| --- | --- | --- |
| App shell, home, lists | `superset/mibi/previews.py`, `superset/mibi/api.py` | `mibi/shell`, `mibi/home`, `mibi/dashboards`, `assets/mibi/skin.css` |
| Workspaces and access | `superset/mibi/workspaces.py`, `workspace_access.py`, `models.py` | `mibi/workspaces` |
| Data page and datasets | `superset/mibi/data_views.py` | `mibi/data` |
| Format pane, themes | `superset/mibi/format_themes.py` | `mibi/format` |
| Chart format controls (labels, legend, axes, series, rules, table) | - | `explore/components/controls/{FontControl,SeriesColorsControl,ChartConditionalFormattingControl}`; sections in `packages/superset-ui-chart-controls/src/sections/visualFormat.tsx`; helpers in `plugins/plugin-chart-echarts/src/utils/formatting.ts` and `plugins/plugin-chart-table/src/utils/tableFormat.ts` |
| Background and element pictures | `superset/mibi/backgrounds.py` | `mibi/format/actions.ts`, `mibi/elements` |
| Design elements (image, shape, button, text, canvas filter) | - | `mibi/elements` |
| Filter bar levels (all pages / this page / visuals), instant apply | `dashboards/schemas.py` (`filter_bar_auto_apply`) | `dashboard/components/nativeFilters/scopeLevel.ts`, `FilterBar/` |
| Presentation mode, PDF/PNG export | - | `mibi/present`, `mibi/export` |
| Report interactivity (edit interactions, drill through, sync slicers, bookmarks, Back/bookmark buttons) | - | `mibi/report` |
| Chart type icons | - | `mibi/vizIcons` |

AuraData BI APIs: `/api/v1/workspace/`, `/api/v1/format_theme/` (plus `<id>/apply/`),
`/api/v1/dashboard_background/<dashboard>/`, `/api/v1/dashboard_image/<dashboard>/<image>/`,
`/api/v1/mibi/dashboard_previews/`. Each new API is registered in `superset/initialization/__init__.py`.

### Dashboard formatting lives in the layout
Formats are stored in `position_json`, so they save, undo and export with the dashboard:
- Canvases always have a fixed page size, as in Power BI (16:9 by default, 4:3, letter or custom;
  see `canvasSize`); there is no screen-width mode. Phones switch to the mobile layout instead.
  While editing, the page is a limit: resizing stops at its bottom (`useMaxHeightMultiple`) and a
  change that overflows it fits the visuals back inside (`CanvasFrame`).
- `ROOT_ID.meta.mibiCanvas`: canvas format (`CanvasFormat` in `src/mibi/format/types.ts`),
  including `visuals`, the style every chart shares (from "Apply to all charts" or a theme).
- `CHART-*.meta.mibiFormat`: a chart's own format. It wins over the shared style setting by
  setting; read it with `useVisualFormat`/`mergeVisualFormat`, never `meta.mibiFormat` alone.
- Design elements are `DYNAMIC` components whose `componentKey` starts with `mibi-`, with their
  settings in `meta.mibiElement` (`src/mibi/elements/types.ts`).
  The canvas filter element (`mibi-filter`) stores `filterId` and `showInFilterBar`; filters
  with `showInFilterBar: false` are left out of the filter bar (`useCanvasOnlyFilterIds`).
- `ROOT_ID.meta.mibiColumns`: grid density, 12 (default, key absent), 24 or 48 columns.
  Every `meta.width` is in the dashboard's own columns. Use `src/mibi/format/columns.ts`
  (`columnCountOf(layout)`, `gridColumnCount()`, `scaledWidth()`, `minObjectColumns()`), never
  `GRID_COLUMN_COUNT`, and change the density only with `setColumnCount`, which rescales widths.
- Flags: `meta.mibiHidden`, `meta.mibiLocked`, `meta.mibiHideMobile`.
- Report interactivity (`src/mibi/report`), Power BI style:
  - `ROOT_ID.meta.mibiBookmarks`: bookmarks (page, filter and cross-filter selections, visibility).
    Applying one sets a browser-only visibility override (`visibility.ts`) on top of `mibiHidden`.
  - `TAB-*.meta.mibiDrillthrough`: `{columns}` a page accepts for "Drill through". The filter is the
    `mibi-drillthrough` data mask, scoped to that page's charts in `getAllActiveFilters`.
  - "Edit interactions" changes `chart_configuration` cross-filter scopes (filter or none; Superset
    charts cannot highlight); it saves with the dashboard.
  - "Sync slicers" sets the native filter scope (saved right away, like any filter setting) and
    places copies of the canvas filter on other pages (saved with the dashboard).
- Write layout changes through `src/mibi/format/actions.ts` (`updateLayout`, `setVisualFormat`,
  `setCanvasFormat`, `setSharedVisualFormat`) so edits group into one undo step.
- Format themes (`mibi_format_themes` table) hold `{canvas, visuals, colorScheme}`; the frontend
  (`src/mibi/format/themes.ts`) and the backend (`apply_theme`) apply them the same way.

### Migrations
Fork migrations form one chain after the upstream head:
`8bc9e5b95335` (workspaces) → `cce7fe34b50d` (members) → `3a90eb47d506` (backgrounds) →
`06c8a16b9fe1` (element images) → `b7d41e0c9a23` (format themes). A new fork migration revises
the last one. When merging a new Superset release, point `8bc9e5b95335` at the new upstream head.

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
pre-commit run prettier          # Code formatting
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
