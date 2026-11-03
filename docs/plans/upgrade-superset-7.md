# Plan: actualizar AuraData BI a Apache Superset 7.0

Fecha: 2026-11-03 · Rama: `claude/upgrade-superset-7-502890`, cortada de `main` local (`7d0f17dfd6`, 153 commits
sin subir) · Upstream: `upstream/7.0` en `ceef26f901` (7.0.0rc2).

El fork es `upstream/6.1` (`c37118edd0`, entero) más 319 commits propios. La base del merge con 7.0 es
`bc99b710bd` (master), así que 7.0 trae 4182 commits y el fork aporta 577 desde esa base. Muchos conflictos no son
del fork: son la deriva entre la rama 6.1 y master.

## Fases

Una sesión por fase, una tras otra. Las suites de tests nunca corren en paralelo.

| Fase | Qué | Listo cuando |
| ---: | --- | --- |
| 0 | Preparación y línea base | Este documento con la línea base, commiteado antes del merge |
| 1 | Merge de `upstream/7.0` | Merge commiteado, sin marcadores de conflicto, bitácora de cada área |
| 2 | Backend: SQLAlchemy 2.0 y Flask 3, migraciones, `superset/mibi` | `superset` importa, `db upgrade` en una base nueva y en una existente, `pytest tests/unit_tests/mibi/` en verde |
| 3 | Frontend base: TypeScript 7, oxlint, lockfile regenerado con npm, build | `tsc` y `oxlint` sin errores nuevos, `npm run build` funciona, Jest de `src/mibi` como en la base |
| 4 | Funciones de 7.0 que pisan las nuestras | Cada choque de la lista «Abiertos para la fase 4» decidido y probado |
| 5 | Infraestructura | `Dockerfile` (imagen -lean), drivers, informes de Playwright, SSL de MySQL |
| 6 | Traducciones al español y marca | Cadenas nuevas de 7.0 en `es/messages.po`, ninguna marca de Superset a la vista |
| 7 | QA completo y PR | QA en el navegador, Playwright experimental, PR contra `main` |

## Línea base (fase 0)

Tomada en la rama antes del merge (`7d0f17dfd6`), una suite tras otra.

- **Montaje:** el worktree no tiene `node_modules`. Se enlazaron los del checkout principal (mismo commit) y se
  copiaron sus carpetas `lib/` de paquetes y plugins para que `tsc` resuelva las referencias de proyecto. Las
  dependencias de JavaScript son, por tanto, las de 6.1. Tras el merge se usa el mismo montaje, salvo `lib/`, que se
  reconstruye.
- **Ojo con Jest y los enlaces:** el `jest.config.js` del repo resuelve `@superset-ui/*` a través de `node_modules`,
  que apunta al checkout principal. Así una prueba carga dos copias de `@superset-ui/core` (dos `SupersetClient`) y
  fallan 23 pruebas que no tienen nada roto. Hay que correr Jest con un config que mapee `@superset-ui/*` a
  `packages/*/src` y `plugins/*/src` del worktree (guardado en la carpeta de notas de la sesión como
  `jest.worktree.config.js`).
- **Jest `src/mibi`** (`jest -c jest.worktree.config.js --max-workers=3 src/mibi`): 53 suites, 404 tests.
  **402 pasan, 2 fallan**, ambos previos al merge:
  - `format/editing.test.tsx`: «places a pasted object in its row when it fits, else in a row below», `GRID_ID`
    indefinido.
  - `format/columns.test.tsx`: «a legacy layout in 24 columns keeps its shares», espera 7 y recibe 6.
- **pytest `tests/unit_tests/mibi/`** (en el contenedor, sobre un `git archive` de la rama): **82 pasan, 0 fallan.**
- **`tsc --noEmit -p .`:** **39 errores**, ninguno en `src/mibi`: 21 en `plugin-chart-ag-grid-table` (`totals`,
  `UseColDefsProps`), 13 en `DatabaseModal/index.test.tsx` y uno en `Header.test.tsx`, `PropertiesModal`,
  `dashboardInfo.test.ts`, `VizTypeGallery.tsx` y `ThemeController.ts`. Parte puede venir de las `lib/` copiadas.
- **oxlint** (`--quiet`): **5 errores**: 3 `no-use-before-define` en `src/mibi/format/useCellMove.ts`, 1 en
  `playwright/tests/experimental/dashboard/layout-ux.spec.ts` y 1 `escape-case` en `src/mibi/export/export.test.ts`.

## Forma del merge

Simulado con `git merge-tree`: 1199 archivos en conflicto.

| Tipo | Cuántos | Qué son |
| --- | ---: | --- |
| modify/delete | 597 | 577 borrados por el fork (o por 6.1) y cambiados en 7.0; 20 borrados por 7.0 y cambiados por el fork |
| rename/delete | 160 | 7.0 movió archivos que el fork había borrado (docs, plugins legacy renombrados, workflows) |
| content | 445 | 263 en archivos que el fork tocó; 182 solo deriva 6.1↔master |
| add/add | 55 | 16 tocados por el fork; 39 solo deriva |
| rename/rename | 1 | Emparejamiento falso (`dataset_list.test.ts` de Cypress) |

**Criterio general:**
- «Tocado por el fork» = cambia entre `upstream/6.1` y `main`. Si un archivo en conflicto no cambia ahí, el
  conflicto es solo deriva entre 6.1 y master: se toma la versión de 7.0.
- Los borrados del fork se atribuyen al commit que los hizo; si el motivo sigue vigente, siguen borrados.
- Lo que 7.0 añade dentro de áreas que el fork quitó (archivos nuevos que entran sin conflicto) también se quita,
  salvo que el código que queda lo importe.

## Bitácora de decisiones

Formato: área · decisión · por qué.

### Fase 0

- **Migraciones: repuntar o fusionar.** La tarea pide apuntar `8bc9e5b95335` a la cabeza de 7.0. Eso deja una
  cadena, pero una base ya en `d3f9a2b17c64` daría por aplicadas las 41 migraciones nuevas de 7.0. Se consultó a la
  sesión principal; la decisión queda en la sección de migraciones de la fase 1.

### Fase 1

_(se completa durante el merge)_

## Abiertos para la fase 2 (backend)

_(se completa durante el merge)_

## Abiertos para la fase 3 (frontend)

_(se completa durante el merge)_

## Abiertos para la fase 4 (funciones que chocan)

_(se completa durante el merge)_
