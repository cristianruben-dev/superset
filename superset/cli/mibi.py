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
import click
from flask.cli import with_appcontext

from superset.extensions import db


@click.command()
@with_appcontext
@click.option(
    "--dry-run",
    is_flag=True,
    default=False,
    help="Show what would change without saving it",
)
def split_shared_charts(dry_run: bool) -> None:
    """Give every dashboard its own copy of the charts it shares with others"""
    # pylint: disable=import-outside-toplevel
    from superset.mibi.split_shared_charts import split_shared_charts as split

    result = split()
    if not result.replacements:
        click.secho("No charts are shared between dashboards.", fg="green")
        return

    for dashboard_id, mapping in sorted(result.replacements.items()):
        changes = ", ".join(f"{old} -> {new}" for old, new in sorted(mapping.items()))
        click.echo(f"Dashboard {dashboard_id}: {changes}")

    if dry_run:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        click.secho(
            f"Dry run: {result.cloned_charts} charts would be cloned. "
            "Nothing was saved.",
            fg="yellow",
        )
        return

    db.session.commit()  # pylint: disable=consider-using-transaction
    click.secho(f"Cloned {result.cloned_charts} charts.", fg="green")
