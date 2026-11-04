# Ledger de resolución del merge 7.0 (sesión upgrade-superset-7)

Fuente de verdad de lo pendiente: `git diff --name-only --diff-filter=U`.

## Hecho
- DU atribuidos a commits de borrado del fork → borrados (docs, helm, websocket node, storybook, cypress, workflows Apache, ASF, RELEASING, cursor/devcontainer, generator, traducciones, motores, temas/CSS, anotaciones, ChartList, import v0, hover card de filtros, TimeTable, world_health chart).
- Plugins: 7.0 renombra legacy-* → plugin-*, migra a chart data API (sin viz.py), map-box → point-cluster-map, NVD3 fuera (Bullet → ECharts). Tomado 7.0 entero en calendar/chord/country-map/world-map/preset-chart-deckgl/point-cluster-map; stories fuera; PRIMARY_COLOR AuraData portado a preset-chart-deckgl/src/utilities/controls.ts. Borrados legacy-*, horizon, partition, paired-t-test, parallel-coordinates. ECharts Rose y TimePivot fuera (+ export en echarts/src/index.ts).
- Deriva (UU/AA no tocados por el fork desde 6.1): 216 → 7.0 (+ helm values test borrado).
- Añadidos limpios en áreas quitadas: docs/helm (2101), workflows nuevos salvo enforce-single-migration-head, websocket node, traducciones nuevas (cs fi lv ro sr sr_Latn ta th) + tests sk, mcp theme/annotation_layer (+tests), tests theme cmd, FE themes/cssTemplates/annotation tests, playwright theme, stories, motores datafusion/odps + tests de motores quitados (unit y testcontainers).
- Pendiente fase 2: tests/unit_tests/db_engine_specs/test_cancel_query_validation.py importa impala/ocient/singlestore (quitados).
