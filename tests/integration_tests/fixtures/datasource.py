# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Fixtures for test_datasource.py"""

from collections.abc import Generator

import pytest
from sqlalchemy import Column, create_engine, Date, Integer, MetaData, String, Table
from sqlalchemy.ext.declarative import declarative_base

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from superset.models.core import Database
from superset.utils.database import get_example_database  # noqa: F401
from tests.integration_tests.test_app import app


@pytest.fixture
def load_dataset_with_columns() -> Generator[SqlaTable, None, None]:
    engine = create_engine(app.config["SQLALCHEMY_DATABASE_URI"], echo=True)
    meta = MetaData()

    students = Table(
        "students",
        meta,
        Column("id", Integer, primary_key=True),
        Column("name", String(255)),
        Column("lastname", String(255)),
        Column("ds", Date),
    )
    meta.create_all(engine)

    students.insert().values(name="George", ds="2021-01-01")

    dataset = SqlaTable(
        database_id=db.session.query(Database).first().id, table_name="students"
    )
    column = TableColumn(table_id=dataset.id, column_name="name")
    dataset.columns = [column]
    db.session.add(dataset)
    db.session.commit()
    yield dataset

    # cleanup
    if (students_table := meta.tables.get("students")) is not None:
        base = declarative_base()
        # needed for sqlite
        db.session.commit()
        base.metadata.drop_all(engine, [students_table], checkfirst=True)
    db.session.delete(dataset)
    db.session.delete(column)
    db.session.commit()
