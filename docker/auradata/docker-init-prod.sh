#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Prepares the AuraData BI metadata database. Safe to run on every deploy: migrations
# are applied once, the admin user is created only if it does not exist yet, and
# roles and permissions are refreshed.
set -euo pipefail

echo "Applying database migrations"
superset db upgrade

if [ -n "${ADMIN_PASSWORD:-}" ]; then
    echo "Creating the admin user (skipped if it already exists)"
    superset fab create-admin \
        --username "${ADMIN_USERNAME:-admin}" \
        --firstname "${ADMIN_FIRSTNAME:-Admin}" \
        --lastname "${ADMIN_LASTNAME:-AuraData BI}" \
        --email "${ADMIN_EMAIL:-admin@example.com}" \
        --password "${ADMIN_PASSWORD}"
fi

echo "Refreshing roles and permissions"
superset init
