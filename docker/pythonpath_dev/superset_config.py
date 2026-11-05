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
#
# This file is included in the final Docker image and SHOULD be overridden when
# deploying the image to prod. Settings configured here are intended for use in local
# development environments. Also note that superset_config_docker.py is imported
# as a final step as a means to override "defaults" configured here
#
import logging
import os
import sys
from datetime import timedelta

from flask_caching.backends.filesystemcache import FileSystemCache

from superset.config import CeleryConfig as DefaultCeleryConfig

logger = logging.getLogger()

DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

EXAMPLES_USER = os.getenv("EXAMPLES_USER")
EXAMPLES_PASSWORD = os.getenv("EXAMPLES_PASSWORD")
EXAMPLES_HOST = os.getenv("EXAMPLES_HOST")
EXAMPLES_PORT = os.getenv("EXAMPLES_PORT")
EXAMPLES_DB = os.getenv("EXAMPLES_DB")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

# Use environment variable if set, otherwise construct from components
# This MUST take precedence over any other configuration
SQLALCHEMY_EXAMPLES_URI = os.getenv(
    "SUPERSET__SQLALCHEMY_EXAMPLES_URI",
    (
        f"{DATABASE_DIALECT}://"
        f"{EXAMPLES_USER}:{EXAMPLES_PASSWORD}@"
        f"{EXAMPLES_HOST}:{EXAMPLES_PORT}/{EXAMPLES_DB}"
    ),
)


REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = CACHE_CONFIG
# Screenshots change with the dashboard digest; the timeout refreshes their data
THUMBNAIL_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=1).total_seconds()),
}


class CeleryConfig(DefaultCeleryConfig):
    # Superset's tasks and beat schedule (reports, trash and version history purge,
    # Excel export, Slack) on the compose Redis.
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"


CELERY_CONFIG = CeleryConfig

FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DATASET_FOLDERS": True,
    # Dashboard cards show a screenshot taken by the worker's headless Chromium
    # (INCLUDE_CHROMIUM in docker-compose.yml), as the user who views them
    "THUMBNAILS": True,
    "ENABLE_EXTENSIONS": True,
    # MOBILE_CONSUMPTION_MODE (Superset 7.0) stays off: AuraData BI has its own
    # mobile layout per page (meta.auradataMobile)
    "SEMANTIC_LAYERS": True,
}
EXTENSIONS_PATH = "/app/docker/extensions"
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
# The worker's headless browser reaches the app through its compose service name
# ("superset", port 8088). Report paths are root-relative, so urljoin drops the base
# path; only the scheme, host, and port must be correct here. SUPERSET_APP_ROOT is
# kept for consumers that concatenate paths directly (e.g. cache warm-up).
WEBDRIVER_BASEURL = f"http://superset:8088{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
# The address people open the app at: links of email reports and of MCP tools.
# docker-compose passes the host port it publishes the app on (SUPERSET_PORT) as
# SUPERSET_HOST_PORT; set SUPERSET_PUBLIC_URL (e.g. in docker/.env-local) when the
# app is reached some other way, such as through nginx or another host name.
SUPERSET_PUBLIC_URL = os.getenv("SUPERSET_PUBLIC_URL") or (
    f"http://localhost:{os.getenv('SUPERSET_HOST_PORT', '8088')}"
)
WEBDRIVER_BASEURL_USER_FRIENDLY = (
    f"{SUPERSET_PUBLIC_URL.rstrip('/')}"
    f"{os.environ.get('SUPERSET_APP_ROOT', '/').rstrip('/')}/"
)
SQLLAB_CTAS_NO_LIMIT = True

# Personal API keys (sst_...): each user creates them on the «Conectar IA» page
# (/connect-ai/) and an AI agent sends one as "Authorization: Bearer sst_..." to act
# as that user; the key's scopes only narrow what the user may do. The feature flag
# shows the keys in the web app; MCP_API_KEY_ENABLED accepts them on the MCP service.
_api_keys = os.getenv("MCP_API_KEY_ENABLED", "true").lower() in ("1", "true", "yes")
FAB_API_KEY_ENABLED = True
FEATURE_FLAGS["FAB_API_KEY_ENABLED"] = True
MCP_API_KEY_ENABLED = _api_keys
MCP_API_KEY_CREATE_URL = "/connect-ai/"
# Address an AI client connects to, shown on the «Conectar IA» page. The compose file
# publishes the MCP port on the host as MCP_PORT (5008 unless overridden) and passes
# it as MCP_HOST_PORT; set MCP_SERVICE_URL when the MCP is reached some other way.
MCP_SERVICE_URL = os.getenv("MCP_SERVICE_URL") or (
    f"http://localhost:{os.getenv('MCP_HOST_PORT', '5008')}/mcp"
)

# AI assistant. Set ANTHROPIC_API_KEY in docker/.env-local, which git ignores. The key
# stays on the server. AURADATA_ASSISTANT_* are the defaults: what an admin picks in
# Administration › AI assistant wins over them.
_assistant_models = os.getenv("AURADATA_ASSISTANT_ALLOWED_MODELS", "")
_assistant_budget = os.getenv("AURADATA_ASSISTANT_MONTHLY_BUDGET_USD", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or None
AURADATA_ASSISTANT_ENABLED = os.getenv(
    "AURADATA_ASSISTANT_ENABLED", "false"
).lower() in ("1", "true", "yes")
AURADATA_ASSISTANT_DEFAULT_MODEL = (
    os.getenv("AURADATA_ASSISTANT_DEFAULT_MODEL") or "claude-sonnet-5-5"
)
AURADATA_ASSISTANT_ALLOWED_MODELS = [
    model.strip() for model in _assistant_models.split(",") if model.strip()
] or None
AURADATA_ASSISTANT_MONTHLY_BUDGET_USD = (
    float(_assistant_budget) if _assistant_budget else None
)

# User the MCP service acts as when it takes no credential. With API keys on (the
# default) the MCP service refuses any request without a key, so this only applies
# after setting MCP_API_KEY_ENABLED=false in docker/.env-local. Local development only.
MCP_DEV_USERNAME = os.getenv("MCP_DEV_USERNAME", "admin")

log_level_text = os.getenv("SUPERSET_LOG_LEVEL", "INFO")
LOG_LEVEL = getattr(logging, log_level_text.upper(), logging.INFO)

if os.getenv("CYPRESS_CONFIG") == "true":
    # When running the service as a cypress backend, we need to import the config
    # located @ tests/integration_tests/superset_test_config.py
    base_dir = os.path.dirname(__file__)
    module_folder = os.path.abspath(
        os.path.join(base_dir, "../../tests/integration_tests/")
    )
    sys.path.insert(0, module_folder)
    from superset_test_config import *  # noqa

    sys.path.pop(0)

#
# Optionally import superset_config_docker.py (which will have been included on
# the PYTHONPATH) in order to allow for local settings to be overridden
#
try:
    import superset_config_docker
    from superset_config_docker import *  # noqa: F403

    logger.info(
        "Loaded your Docker configuration at [%s]", superset_config_docker.__file__
    )
except ImportError:
    logger.info("Using default Docker config...")
