# Mobile UI fixes (AuraData shell, lists, editor, legacy pages)
Objective: fix the phone (390 px) problems found in the audits of the AuraData interface. Branch: main working tree (uncommitted, shared with the user's in-progress work). Delivery: no commits; the parent reviews the diff. Test runner: jest (superset-frontend), oxlint, oxfmt, pytest for Python.

## Specs
S1. Edit button stays visible on phones. User: "pues debe de estar el boton, no es lo mas comodo pero no vamos a restringirlo". Remove the mobile rule that hides `edit-dashboard-button` (skin.css, `@media (max-width: 767px)`). Do not change desktop.
S2. Fix everything else found in the mobile audit. User: "todo lo demas que has visto tenemos que arreglarlo". Findings are listed in the Log (L3 and L4).
S3. Out of scope for this feature: the tooltip change in `plugin-chart-echarts/src/utils/tooltip.ts` (the user has not decided it; do not touch it), and the tablet canvas scaling (product design: the canvas has no screen-width mode).
S4. New user-facing strings use `t()` and get a Spanish entry in `superset/translations/es/LC_MESSAGES/messages.po`.
S5. Do not revert the user's uncommitted edits in FormatPane.tsx, ChartFieldsSections.tsx, BuilderComponentPane/index.tsx, tooltip.ts, BigNumberViz.tsx, appMenus.tsx, RightMenu.test.tsx and skin.css (formatting-only and CSS edits already present). Build on top of them.

## Tasks
| ID | Specs | Route | Owner surface | Status |
|---|---|---|---|---|
| T1 | S1 | delegated (gemini) | superset-frontend/src/assets/auradata/skin.css (the mobile block only) | pending |
| T2 | S2 | delegated (gemini) | superset-frontend/src/auradata/shell/**, superset/auradata/assistant/ floating button (frontend side only) | pending |
| T3 | S2 | delegated (gemini) | dashboard list, workspace page, archived/trash, dataset detail columns, tasks, row-level security pages; shared table component | pending |
| T4 | S2 | delegated (gemini) | Connect AI, action log, alerts and reports pages, database connections list | pending |
| T5 | S2 | delegated (gemini) | superset/templates/appbuilder/** (legacy Flask-AppBuilder pages: users, roles) | pending |
| T6 | S2 | delegated (gemini) | superset-frontend/src/auradata/format/{FormatPane.tsx,mobileLayout.ts}, src/auradata/ribbon/** (editor on phone) | pending |

## Log
L1 (2026-11-09, first request): "necesito que chequen que se va bien en mobile que no se desperdicie espacio porfavor".
L2 (page audit request): "quiero que le des una repasada a cada pagina para ver como se ve en mobile... no tanto el iframe sino la interfaz de auradata".
L3 (edit button decision): "pues debe de estar el boton, no es lo mas comodo pero no vamos a restringirlo y todo lo demas que has visto tenemos que arreglarlo porfavor delegaselo todos a agentes de gemini".
L4 (findings to fix, from the audits):
- Editor on phone: the document is 605-657 px wide in Campos/General with the Format pane open; the ribbon tab "Datos y detalles" is clipped; the floating "Formato / Eliminar" bar covers section headers; inputs 29 px vs 28 px target.
- Mobile layout (dashboard 147): chart `CHART-qa2` (id 213) has no item in `auradataMobile`, leaving an empty 227 px band; the mobile layout editor's "Diseño movil" intro and progress bar take ~225 px.
- Shell: top chrome 122-299 px (Alertas reaches 299 px); floating "Preguntar" button covers content; nav toggle 32x32, search 40x32, breadcrumb "Inicio" 14 px tall; text 11 px in top bar, breadcrumbs, status bar; "Contraer" in the nav drawer is partly covered by the status bar.
- Dataset detail (/data/dataset/40/), Columns tab: column names break letter by letter; "Nueva metrica" button misaligned with "Editar conjunto de datos"; "Uso" tab clipped at the right edge.
- Dashboard list: search, 5 filters and "Ordenar" stacked full width; first card at 70% of the screen.
- Workspace pages (5, 6): header ~410 px before the first dashboard; the "..." button alone on its row; 126 dashboards in one column without pagination.
- Connections (/databaseview/list/), archived (/archived/), action log, reports: tables wider than their 340 px container; action icons 16x16; Restore button outside visible area in archived.
- Connect AI "Tus claves": 7 columns of 49 px each, names cut.
- Alerts: "+ Alerta" covers the refresh icon.
- Reports: name column out of view; schedule descriptions cut.
- Tasks: "Funcion no activada" message has no margin (x 0-390).
- Row-level security: "+ Regla" at x=8, outside the 48 px margin.
- Legacy Flask-AppBuilder pages (/users/list/, /roles/list/): Bootstrap pages outside the AuraData shell; Roles "Permisos" column 42,821 px wide in a 340 px container; checkboxes 13 px.
- Touch targets under 44 px on most lists (favorites 24x16, checkboxes 17x17).

L5 (parent, 2026-11-09): the edit button hide rule was already in HEAD (skin.css line ~2060), so this is a product decision, decided in L3: keep it visible.
