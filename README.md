<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

<p align="center">
  <img src="superset-frontend/src/assets/images/mibi/favicon.svg" alt="Mi BI" width="72" />
</p>

<h1 align="center">Mi BI</h1>

<p align="center">
  Paneles de control e informes para explorar tus datos, al estilo Power BI.
</p>

## Qué es

Mi BI es una plataforma de inteligencia de negocio basada en
[Apache Superset](https://github.com/apache/superset) 6.1, con su propio diseño y
algunas reglas de producto distintas:

- **Cada gráfico pertenece a un solo panel de control.** Los gráficos se crean y se
  editan en un panel lateral del propio panel y no se comparten entre paneles (ver
  `superset/mibi/single_dashboard.py`).
- **Áreas de trabajo:** agrupan paneles, con imagen, color, miembros y roles
  (lector, colaborador y administrador).
- **Panel Formato**, como en Power BI:
  - lienzo con fondo de color, degradado o imagen y siempre con medida fija, como las
    páginas de Power BI (16:9, 4:3, Carta o a medida), escalado a cada pantalla;
    márgenes, separación, cuadrícula (líneas, puntos o columnas) con densidad de 12, 24
    o 48 columnas para objetos más pequeños, y vista para móvil;
  - estilo de cada gráfico: fondo, borde, esquinas, sombra, título, subtítulo e iconos;
  - **temas**: guardar el diseño de un panel con nombre y aplicarlo a otros con un
    clic. Hay cuatro de fábrica (Corporativo, Fresco, Vibrante y Minimalista) y cada
    área de trabajo puede tener el suyo, que heredan sus paneles nuevos;
  - copiar formato, copiar y pegar objetos, ocultar y bloquear.
- **Elementos de diseño:** imágenes, formas, botones (con enlaces y estados), texto
  enriquecido y **filtros en el lienzo** (como las segmentaciones de Power BI), que se
  aplican al instante y comparten su valor con la barra de filtros.
- **Barra de filtros por niveles**, como en Power BI: *filtros en todas las páginas*
  (siempre visibles), *filtros en esta página* (cambian con la pestaña) y *filtros en
  gráficos*. La sección sale del alcance del filtro o se elige en la pestaña «Alcance»
  del filtro. Desde el engranaje de la barra se puede activar **Aplicar filtros al
  instante** para no tener que pulsar «Aplicar».
- **Modo presentación** y **exportación a PDF o PNG** con portada, una página por
  pestaña del tamaño del panel y los filtros aplicados.
- **Diseño propio:** logotipo, colores, tipografía Geist, modo claro y oscuro,
  paletas de gráficos (Mi BI, Corporativo, Neón, Fresco) y pantalla de carga.
- **En español por defecto**, con inglés como segundo idioma.
- **Servicio MCP** para que asistentes de IA consulten y creen paneles.
- Conexión a PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, Snowflake, BigQuery,
  Redshift, Athena, Databricks, ClickHouse, DuckDB, Druid, Hive, Spark SQL,
  Google Sheets, SQLite y Azure Synapse.

La personalización vive en pocos sitios para poder seguir trayendo las correcciones
de Superset:

| Qué | Dónde |
| --- | --- |
| Marca, tema, idiomas y paletas | `superset/mibi_config.py` |
| Logotipos e iconos | `superset-frontend/src/assets/images/mibi/` |
| Estilos globales | `superset-frontend/src/assets/mibi/skin.css` |
| Pantallas y funciones de Mi BI | `superset-frontend/src/mibi/` |
| API, modelos y reglas de Mi BI | `superset/mibi/` |
| Migraciones de Mi BI | `superset/migrations/versions/*_mibi_*.py` |
| Traducciones al español | `superset/translations/es/LC_MESSAGES/messages.po` |
| Configuración de producción | `docker/pythonpath_prod/superset_config.py` |

La guía para asistentes de IA que trabajan en el código está en
[AGENTS.md](AGENTS.md) (`CLAUDE.md` apunta al mismo archivo).

## Ramas

**La rama buena es `main`.** Todo el trabajo sale de `main` y vuelve a `main`, y los pull
requests se abren contra `main`.

`master` y las ramas con número (`6.1`, `7.0`...) son copias de Apache Superset que vinieron con
el fork: no tienen nada de Mi BI. Una rama creada desde `master` parece un Superset normal, y su
pull request intentaría deshacer todo Mi BI.

```bash
git fetch origin main
git checkout -b mi-cambio origin/main
```

## Desarrollo

```bash
docker compose up -d --build
```

- Aplicación: http://localhost:8088 (usuario `admin`, contraseña `admin`)
- Frontend con recarga en caliente: http://localhost:9000
- Servicio MCP: http://localhost:5008/mcp (actúa como `admin`, solo en local)

Al arrancar se aplican las migraciones pendientes (`superset db upgrade`), incluidas
las de Mi BI: áreas de trabajo, miembros, imágenes de fondo y de elementos, y temas.

Pruebas:

```bash
cd superset-frontend && npm run test -- src/mibi   # interfaz (Jest)
pytest tests/unit_tests/mibi/                       # API y reglas
```

Si hay datos de antes de la regla de un panel por gráfico, sepáralos con:

```bash
docker compose exec superset superset split-shared-charts --dry-run
docker compose exec superset superset split-shared-charts
```

## Producción

1. Copia la configuración y rellena los valores `change-me`:

   ```bash
   cp docker/.env-prod.example docker/.env-prod
   ```

2. Construye y arranca:

   ```bash
   docker compose -f docker-compose-prod.yml up -d --build
   ```

Levanta PostgreSQL, Redis, la aplicación (gunicorn), los workers de Celery para
alertas e informes programados y, con `--profile mcp`, el servicio MCP protegido
con JWT. Pon delante un proxy inverso con HTTPS (nginx, Traefik, Caddy...) que
apunte al puerto 8088.

## Traer correcciones de Superset

```bash
git remote add upstream https://github.com/apache/superset.git  # una sola vez
git fetch upstream 6.1
git merge upstream/6.1
```

## Licencia

Mi BI se distribuye bajo la [Licencia Apache 2.0](LICENSE.txt), igual que Apache
Superset, en el que se basa. Consulta [NOTICE](NOTICE) para los avisos de terceros.
