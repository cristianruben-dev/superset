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
"""Command that restores a chart to a previous version."""

from __future__ import annotations

from collections.abc import Iterator

from flask_babel import gettext as _

from superset.auradata.single_dashboard import get_chart_dashboard_ids
from superset.auradata.workspace_datasets import validate_chart_dataset
from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartNotFoundError,
    ChartUpdateFailedError,
)
from superset.commands.version_restore import BaseRestoreVersionCommand
from superset.extensions import db
from superset.models.slice import Slice
from superset.versioning.restore import RestoreResult


class RestoreChartVersionCommand(BaseRestoreVersionCommand):
    """Revert a chart to a previous version.

    The restore is non-destructive: it produces a new version row (authored
    by the restoring user), so prior versions remain in the history and the
    change is itself reversible. The base builds the ``@transaction``
    boundary from :attr:`failed_exc`, binding the commit that fires
    Continuum's ``after_flush`` hook — the one that writes the new version
    row — to this command's lifecycle.
    """

    model_cls = Slice
    not_found_exc = ChartNotFoundError
    forbidden_exc = ChartForbiddenError
    failed_exc = ChartUpdateFailedError

    def _do_restore(self) -> RestoreResult:
        """
        AuraData BI: a chart only uses datasets of its dashboard's workspace or
        shared ones. A version from before the dashboard moved to its workspace
        can name a dataset of another workspace; restoring it is refused, as
        saving that dataset would be.
        """
        result = super()._do_restore()
        chart = result.entity

        def dashboard_ids() -> Iterator[int]:
            # Looked up only when the dataset belongs to a workspace
            yield from get_chart_dashboard_ids([chart.id]).get(chart.id, set())

        if error := validate_chart_dataset(
            chart.datasource_id, chart.datasource_type, dashboard_ids()
        ):
            db.session.rollback()  # pylint: disable=consider-using-transaction
            reasons = error.normalized_messages().values()
            raise ChartUpdateFailedError(
                _(
                    "This version can't be restored: %(reason)s",
                    reason=" ".join(
                        str(message)
                        for messages in reasons
                        for message in (
                            messages if isinstance(messages, list) else [messages]
                        )
                    ),
                )
            )
        return result
