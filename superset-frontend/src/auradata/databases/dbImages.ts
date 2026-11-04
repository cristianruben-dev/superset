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
import { assetUrl } from 'src/utils/assetUrl';

/** The logo of each database engine, in `src/assets/images`. */
const DATABASE_LOGOS: Record<string, string> = {
  postgresql: 'postgresql.png',
  mssql: 'mssql-server.png',
  mysql: 'mysql.png',
  databricks: 'databricks.png',
  redshift: 'redshift.png',
  duckdb: 'duckdb.svg',
  sqlite: 'sqlite.png',
  snowflake: 'snowflake.png',
};

/**
 * The logos of the cards shown when connecting a database, by engine. Logos
 * set in `DB_IMAGES` of `superset_text.yml` win over these.
 */
export function databaseImages(
  custom: Record<string, string> = {},
): Record<string, string> {
  const images = Object.fromEntries(
    Object.entries(DATABASE_LOGOS).map(([engine, file]) => [
      engine,
      assetUrl(`/static/assets/images/${file}`),
    ]),
  );
  return { ...images, ...custom };
}
