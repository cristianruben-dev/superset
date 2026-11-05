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
  <img src="superset-frontend/src/assets/images/auradata/logo.svg" alt="AuraData" width="280" />
</p>

<h1 align="center">AuraData BI</h1>

<p align="center">
  Paneles de control e informes para explorar tus datos, al estilo Power BI.<br />
  Un producto de <a href="https://auradata.mx">AuraData</a>.
</p>

## Qué es

AuraData BI es una plataforma de inteligencia de negocio basada en
[Apache Superset](https://github.com/apache/superset) 7.0, con su propio diseño y
algunas reglas de producto distintas:

- **Cada gráfico pertenece a un solo tablero.** Los gráficos se crean y se
  editan en un panel lateral del propio tablero y no se comparten entre tableros (ver
  `superset/auradata/single_dashboard.py`).
- **Áreas de trabajo:** agrupan tableros y conjuntos de datos, con imagen, color, miembros y roles
  (lector, colaborador y administrador). Los colaboradores y administradores del área leen los datos
  de los conjuntos del área, y los lectores no.
- **Panel Formato**, como en Power BI:
  - lienzo con fondo de color, degradado o imagen y siempre con medida fija, como las
    páginas de Power BI (16:9 en Full HD, 4:3, Carta o a medida), escalado a cada pantalla;
    márgenes, separación, cuadrícula (líneas, puntos o columnas) con densidad de 12, 24
    o 48 columnas para objetos más pequeños, y vista para móvil;
  - estilo de cada gráfico: fondo, borde, esquinas, sombra, título, subtítulo e iconos;
  - copiar formato, copiar y pegar objetos, ocultar y bloquear.
- **Formato de cada gráfico en su editor** (pestaña «Personalizar»), también al estilo
  Power BI:
  - etiquetas de datos: fuente, fondo, orientación y formato numérico propio;
  - leyenda: alineación, forma del marcador y fuente;
  - ejes y cuadrícula: fuentes de etiquetas y títulos (también del eje secundario),
    ejes invertidos, y color, grosor y estilo de la cuadrícula;
  - series: color por serie, grosor y estilo de línea, forma del marcador, espacio
    entre barras, esquinas redondeadas y borde de las barras;
  - formato condicional: reglas (mayor, menor, entre…) que colorean barras, puntos o
    etiquetas;
  - tablas: estilos predefinidos, fuentes y fondo del encabezado, colores de rayas y
    cuadrícula, e iconos condicionales junto a los números.
- **Elementos de diseño:** imágenes, formas, botones (con enlaces y estados), texto
  enriquecido y **filtros en el lienzo** (como las segmentaciones de Power BI), que se
  aplican al instante y comparten su valor con la barra de filtros.
- **Barra de filtros por niveles**, como en Power BI: *filtros en todas las páginas*
  (siempre visibles), *filtros en esta página* (cambian con la pestaña) y *filtros en
  gráficos*. La sección sale del alcance del filtro o se elige en la pestaña «Alcance»
  del filtro. Desde el engranaje de la barra se puede activar **Aplicar filtros al
  instante** para no tener que pulsar «Aplicar».
- **Modo presentación** y **exportación a PDF o PNG** con portada, una página por
  pestaña del tamaño del tablero y los filtros aplicados.
- **Identidad AuraData** ([guía de marca](https://auradata.mx/brand-guidelines)):
  logotipo Continua, tipografía Outfit con Geist Mono para datos, Azul Aura
  (#2563EB) con acentos violeta y verde, modo claro y oscuro, paletas de gráficos
  (AuraData, Aura suave, Corporativo, Neón, Fresco) y pantalla de carga.
- **En español por defecto**, con inglés como segundo idioma.
- **Una IA puede armar tus informes:** el servicio MCP deja a Claude u otro asistente crear áreas de
  trabajo, conjuntos de datos e informes completos (páginas, gráficos, formato, segmentadores,
  marcadores, obtener detalles, diseño móvil), mirarlos con una captura, exportarlos y compartirlos.
  Se conecta con una clave personal creada en «Conectar IA» y actúa como su dueño, con sus mismos permisos.
- **Un asistente de IA dentro de la aplicación:** «Pregúntale a tus datos» en la lectura y un copiloto en el editor, con
  Claude de Anthropic. Actúa con los permisos de quien pregunta, pide confirmación antes de lo delicado, se puede deshacer y
  tiene topes de gasto. Viene apagado, y lo que consulta viaja a Anthropic.
- Conexión a PostgreSQL, SQL Server, MySQL, Databricks, Amazon Redshift y DuckDB.
- **Historial de versiones y papelera:** un tablero, gráfico o conjunto de datos eliminado se queda
  en la papelera del área de trabajo (o en Administración) hasta que se purga; el historial de un
  tablero se abre desde su menú «…».
- **Menús de escritorio:** barra de menús, barra de estado y menú con clic derecho en las listas.

La personalización vive en pocos sitios para poder seguir trayendo las correcciones
de Superset:

| Qué | Dónde |
| --- | --- |
| Marca, tema, idiomas y paletas | `superset/auradata_config.py` |
| Logotipos e iconos | `superset-frontend/src/assets/images/auradata/` |
| Estilos globales | `superset-frontend/src/assets/auradata/skin.css` |
| Pantallas y funciones de AuraData BI | `superset-frontend/src/auradata/` |
| API, modelos y reglas de AuraData BI | `superset/auradata/` |
| Migraciones de AuraData BI | `superset/migrations/versions/*_mibi_*.py` |
| Traducciones al español | `superset/translations/es/LC_MESSAGES/messages.po` |
| Configuración de producción | `docker/pythonpath_prod/superset_config.py` |

## Documentación

| Para | Documento |
| --- | --- |
| Usuarios | [Manual de AuraData BI](docs/auradata/manual/README.md), pantalla por pantalla |
| Conectar una IA | [docs/auradata/mcp/conectar.md](docs/auradata/mcp/conectar.md) |
| Administrar el asistente de IA | [docs/auradata/asistente/administracion.md](docs/auradata/asistente/administracion.md) y su [evaluación](docs/auradata/asistente/evaluacion.md) |
| Herramientas del MCP | [docs/auradata/mcp/referencia.md](docs/auradata/mcp/referencia.md) (generada) y la [lista de evaluación](docs/auradata/mcp/evaluacion.md) |
| Desarrolladores | [docs/auradata/arquitectura.md](docs/auradata/arquitectura.md) |
| Asistentes de IA que trabajan en el código | [AGENTS.md](AGENTS.md) (`CLAUDE.md` apunta al mismo archivo) |

## Ramas

**La rama buena es `main`.** Todo el trabajo sale de `main` y vuelve a `main`, y los pull
requests se abren contra `main`.

`master` y las ramas con número (`6.1`, `7.0`...) son copias de Apache Superset que vinieron con
el fork: no tienen nada de AuraData BI. Una rama creada desde `master` parece un Superset normal, y su
pull request intentaría deshacer todo AuraData BI.

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
- Servicio MCP: http://localhost:5008/mcp. Pide una clave personal: créala en «Conectar IA»
  (http://localhost:8088/connect-ai/) y envíala como `Authorization: Bearer sst_…`; la IA actúa como tú.
  Con `MCP_API_KEY_ENABLED=false` en `docker/.env-local` vuelve a aceptar peticiones sin clave como `admin`.

Al arrancar se aplican las migraciones pendientes (`superset db upgrade`), incluidas
las de AuraData BI: áreas de trabajo, miembros, imágenes de fondo y de elementos, y conjuntos de datos
por área. Las migraciones de Superset 7.0 y las del fork forman una sola cadena que termina en la revisión
de fusión `f1c7a9e2b305`; una base de 6.1 con las migraciones del fork (`d3f9a2b17c64`) aplica las 41
de 7.0 al actualizar.

Pruebas:

```bash
cd superset-frontend && npm run test -- src/auradata  # interfaz (Jest)
pytest tests/unit_tests/auradata/                     # API y reglas
```

Si hay datos de antes de la regla de un tablero por gráfico, sepáralos con:

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
alertas e informes programados y, con `--profile mcp`, el servicio MCP, al que cada
usuario conecta su IA con una clave personal de «Conectar IA» (o con un JWT firmado con
`MCP_JWT_SECRET`). Pon delante un proxy inverso con HTTPS (nginx, Traefik, Caddy...) que
apunte al puerto 8088 y, si publicas el MCP, indica su dirección en `MCP_SERVICE_URL`.

La imagen (`target: prod`) parte de la imagen mínima `lean` de Superset 7.0 e instala los
drivers de las bases que ofrece AuraData BI (PostgreSQL, SQL Server, MySQL, Databricks,
Amazon Redshift y DuckDB) y un Chromium con Playwright para las capturas de informes y
alertas (`INCLUDE_CHROMIUM=false` lo omite y ahorra unos 600 MB). Una conexión MySQL con el
interruptor SSL exige TLS verificado: si el servidor usa un certificado propio, indica la
CA en el URI (`?ssl=1&ssl_ca=/ruta/ca.pem`) y que esa ruta exista en la web y en los workers; el certificado
debe ser válido para el nombre del servidor. Sin el interruptor la conexión no usa TLS.

### Informes y alertas de tableros sin publicar

Los informes y alertas se ejecutan como su editor (`ALERT_REPORTS_EXECUTORS`) y en Superset 7.0 ese
usuario necesita acceso al tablero. Un borrador solo lo ven sus editores, los administradores y los
colaboradores y administradores de su área de trabajo. Si el editor del informe no es ninguno de
ellos, el informe de un tablero sin publicar deja de ejecutarse. Soluciones, de más a menos
recomendable: publicar el tablero; hacer al editor del informe colaborador del área o editor del
tablero; o añadir un usuario fijo administrador a `ALERT_REPORTS_EXECUTORS`, lo que da a los
informes derechos de administrador y debe decidirlo quien opera el despliegue. Revisa los informes
de tableros en borrador antes de actualizar.

## Traer correcciones de Superset

```bash
git remote add upstream https://github.com/apache/superset.git  # una sola vez
git fetch upstream 7.0
git merge upstream/7.0
```

Cada versión nueva de Superset añade una revisión de fusión de Alembic con su cabeza y la del
fork; nunca se mueven las migraciones del fork (ver «Migraciones» en [AGENTS.md](AGENTS.md)).

## Licencia

AuraData BI se distribuye bajo la [Licencia Apache 2.0](LICENSE.txt), igual que Apache
Superset, en el que se basa. Consulta [NOTICE](NOTICE) para los avisos de terceros.
