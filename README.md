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

- **Cada gráfico pertenece a un solo panel de control.** Los gráficos se crean desde
  el panel y no se comparten entre paneles (ver `superset/mibi/single_dashboard.py`).
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
| Regla de un panel por gráfico | `superset/mibi/` |
| Configuración de producción | `docker/pythonpath_prod/superset_config.py` |

## Desarrollo

```bash
docker compose up -d --build
```

- Aplicación: http://localhost:8088 (usuario `admin`, contraseña `admin`)
- Frontend con recarga en caliente: http://localhost:9000
- Servicio MCP: http://localhost:5008/mcp (actúa como `admin`, solo en local)

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
