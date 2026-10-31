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
"""
AuraData BI production settings, baked into the `prod` Docker image.

Every value comes from the environment (see docker/.env-prod.example), so the same
image runs in any deployment. Branding, theme and languages come from
superset/mibi_config.py and are not repeated here.
"""

import logging
import os
from urllib.parse import quote

from celery.schedules import crontab
from flask_caching.backends.rediscache import RedisCache


def _required(name: str) -> str:
    """Return an environment variable, failing fast when it is missing."""
    if not (value := os.getenv(name)):
        raise RuntimeError(f"The {name} environment variable is required")
    return value


def _flag(name: str, default: bool) -> bool:
    """Read a true/false environment variable."""
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes"}


# --- Security ---------------------------------------------------------------

SECRET_KEY = _required("SUPERSET_SECRET_KEY")

# Behind a reverse proxy (nginx, Traefik, a load balancer) that terminates TLS
ENABLE_PROXY_FIX = True
SESSION_COOKIE_SECURE = _flag("MIBI_HTTPS", True)
SESSION_COOKIE_SAMESITE = "Lax"

# --- Metadata database ------------------------------------------------------

SQLALCHEMY_DATABASE_URI = (
    "postgresql+psycopg2://"
    f"{quote(_required('POSTGRES_USER'))}:{quote(_required('POSTGRES_PASSWORD'))}"
    f"@{os.getenv('POSTGRES_HOST', 'db')}:{os.getenv('POSTGRES_PORT', '5432')}"
    f"/{_required('POSTGRES_DB')}"
)

# --- Redis: caches, SQL Lab results and Celery ------------------------------

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = int(os.getenv("REDIS_RESULTS_DB", "1"))


def _cache(prefix: str, timeout: int) -> dict[str, object]:
    return {
        "CACHE_TYPE": "RedisCache",
        "CACHE_DEFAULT_TIMEOUT": timeout,
        "CACHE_KEY_PREFIX": prefix,
        "CACHE_REDIS_HOST": REDIS_HOST,
        "CACHE_REDIS_PORT": REDIS_PORT,
        "CACHE_REDIS_DB": REDIS_RESULTS_DB,
    }


CACHE_CONFIG = _cache("mibi_", 300)
DATA_CACHE_CONFIG = _cache("mibi_data_", 3600)
FILTER_STATE_CACHE_CONFIG = _cache("mibi_filter_", 86400)
EXPLORE_FORM_DATA_CACHE_CONFIG = _cache("mibi_explore_", 86400)
THUMBNAIL_CACHE_CONFIG = _cache("mibi_thumbnail_", 86400)

RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST, port=REDIS_PORT, db=REDIS_RESULTS_DB, key_prefix="mibi_results_"
)


class CeleryConfig:  # pylint: disable=too-few-public-methods
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
    )
    worker_prefetch_multiplier = 1
    task_acks_late = False
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=10, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

# --- Alerts and scheduled reports --------------------------------------------

FEATURE_FLAGS = {"ALERT_REPORTS": True}
ALERT_REPORTS_NOTIFICATION_DRY_RUN = not _flag("MIBI_SEND_REPORTS", False)

# Address the Celery workers use to reach the web app, and the one users see in
# the links of the emails
WEBDRIVER_BASEURL = os.getenv("WEBDRIVER_BASEURL", "http://superset:8088/")
WEBDRIVER_BASEURL_USER_FRIENDLY = os.getenv("MIBI_PUBLIC_URL", WEBDRIVER_BASEURL)

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_STARTTLS = _flag("SMTP_STARTTLS", True)
SMTP_SSL = _flag("SMTP_SSL", False)
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_MAIL_FROM = os.getenv("SMTP_MAIL_FROM", "mibi@example.com")
EMAIL_REPORTS_SUBJECT_PREFIX = "[AuraData BI] "

# --- MCP service --------------------------------------------------------------
# AI agents authenticate with a JWT signed with MCP_JWT_SECRET; its "sub" claim is
# the AuraData BI username the agent acts as. Without a secret the MCP service refuses
# every request.

MCP_JWT_SECRET = os.getenv("MCP_JWT_SECRET") or None
MCP_AUTH_ENABLED = MCP_JWT_SECRET is not None
MCP_JWT_ALGORITHM = "HS256"
MCP_JWT_ISSUER = os.getenv("MCP_JWT_ISSUER") or None
MCP_JWT_AUDIENCE = os.getenv("MCP_JWT_AUDIENCE") or None

# --- Logging ------------------------------------------------------------------

LOG_LEVEL = getattr(logging, os.getenv("SUPERSET_LOG_LEVEL", "INFO").upper())
