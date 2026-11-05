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
superset/auradata_config.py and are not repeated here.
"""

import logging
import os
from urllib.parse import quote

from flask_caching.backends.rediscache import RedisCache

from superset.config import CeleryConfig as DefaultCeleryConfig


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
SESSION_COOKIE_SECURE = _flag("AURADATA_HTTPS", True)
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


CACHE_CONFIG = _cache("auradata_", 300)
DATA_CACHE_CONFIG = _cache("auradata_data_", 3600)
FILTER_STATE_CACHE_CONFIG = _cache("auradata_filter_", 86400)
EXPLORE_FORM_DATA_CACHE_CONFIG = _cache("auradata_explore_", 86400)
THUMBNAIL_CACHE_CONFIG = _cache("auradata_thumbnail_", 86400)

RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_RESULTS_DB,
    key_prefix="auradata_results_",
)


class CeleryConfig(DefaultCeleryConfig):  # pylint: disable=too-few-public-methods
    """Superset's tasks and schedule on Redis.

    Inherits the task modules and the beat schedule of Superset, so a task added by
    a new release (the trash purge, the version history purge, the Excel export, Slack)
    is registered here without touching this file.
    """

    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"


CELERY_CONFIG = CeleryConfig

# --- Alerts and scheduled reports --------------------------------------------

FEATURE_FLAGS = {"ALERT_REPORTS": True}
ALERT_REPORTS_NOTIFICATION_DRY_RUN = not _flag("AURADATA_SEND_REPORTS", False)

# Address the Celery workers use to reach the web app, and the one users see in
# the links of the emails
WEBDRIVER_BASEURL = os.getenv("WEBDRIVER_BASEURL", "http://superset:8088/")
WEBDRIVER_BASEURL_USER_FRIENDLY = os.getenv("AURADATA_PUBLIC_URL", WEBDRIVER_BASEURL)

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_STARTTLS = _flag("SMTP_STARTTLS", True)
SMTP_SSL = _flag("SMTP_SSL", False)
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_MAIL_FROM = os.getenv("SMTP_MAIL_FROM", "auradata@example.com")
EMAIL_REPORTS_SUBJECT_PREFIX = "[AuraData BI] "

# --- MCP service --------------------------------------------------------------
# AI agents authenticate with a personal API key (sst_...), created by each user on
# the «Conectar IA» page (/connect-ai/) and sent as "Authorization: Bearer sst_...":
# the agent acts as the key's owner, and the key's scopes only narrow that. A JWT
# signed with MCP_JWT_SECRET (its "sub" claim is the username) stays as an
# alternative. Without a secret the MCP service takes API keys only; with
# MCP_API_KEY_ENABLED=false and no secret it refuses every request.

FAB_API_KEY_ENABLED = True
FEATURE_FLAGS["FAB_API_KEY_ENABLED"] = True
MCP_API_KEY_ENABLED = _flag("MCP_API_KEY_ENABLED", True)
MCP_API_KEY_CREATE_URL = "/connect-ai/"
# Public address of the MCP service that AI clients call (shown on «Conectar IA»),
# e.g. https://bi.example.com/mcp. Set it whenever the MCP is published: without
# it the page offers the app's address plus /mcp, which only works when the
# reverse proxy routes /mcp to the MCP service.
MCP_SERVICE_URL = os.getenv("MCP_SERVICE_URL") or None
MCP_JWT_SECRET = os.getenv("MCP_JWT_SECRET") or None
MCP_AUTH_ENABLED = MCP_JWT_SECRET is not None
MCP_JWT_ALGORITHM = "HS256"
MCP_JWT_ISSUER = os.getenv("MCP_JWT_ISSUER") or None
MCP_JWT_AUDIENCE = os.getenv("MCP_JWT_AUDIENCE") or None

# --- Logging ------------------------------------------------------------------

LOG_LEVEL = getattr(logging, os.getenv("SUPERSET_LOG_LEVEL", "INFO").upper())
