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
"""Celery beat task: delete the assistant's conversations past their retention."""

from __future__ import annotations

import logging
from typing import Any

from superset.auradata.assistant.retention import purge_conversations, retention_days
from superset.extensions import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="auradata_assistant.purge_conversations")
def purge_assistant_conversations(dry_run: bool = False) -> dict[str, Any]:
    """
    One pass of the retention of the assistant. ``dry_run`` only counts. A failure ends
    the pass and the next firing starts again: deleted batches stay deleted.
    """
    days = retention_days()
    if days is None:
        logger.info("assistant retention: no retention set, nothing is deleted")
        return {"skipped": 1}
    try:
        return purge_conversations(days, dry_run=dry_run)
    except Exception:  # pylint: disable=broad-except
        logger.exception("assistant retention: the task failed")
        return {"error": 1}
