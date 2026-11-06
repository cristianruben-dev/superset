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
# A worker of the assistant that talks to the simulated Anthropic of the Playwright
# tests, in place of the normal one for as long as they run.
#
#   scripts/auradata/assistant_fake_worker.sh start   # before the tests
#   scripts/auradata/assistant_fake_worker.sh stop    # after them, always
#
# `start` takes the queue of the assistant from the normal worker, because a turn it
# picked up would call the real API and spend. A restart of the container undoes it all.
set -euo pipefail

CONTAINER="${CONTAINER:-superset-superset-worker-1}"
PORT="${AURADATA_FAKE_ANTHROPIC_PORT:-9933}"
QUEUE=auradata_assistant
NODE=fake-assistant
CELERY="celery --app=superset.tasks.celery_app:app"

normal_worker() {
  docker exec "$CONTAINER" sh -c "$CELERY inspect ping 2>/dev/null" |
    grep -o 'celery@[^:]*' | grep -v "$NODE" | head -1
}

case "${1:-}" in
  start)
    docker exec -d -e ANTHROPIC_BASE_URL="http://host.docker.internal:$PORT" \
      "$CONTAINER" sh -c "exec $CELERY worker -P solo -c 1 -l INFO \
        -Q $QUEUE -n $NODE@%h --logfile=/tmp/fake-assistant.log"
    sleep 15
    docker exec "$CONTAINER" sh -c \
      "$CELERY control -d $(normal_worker) cancel_consumer $QUEUE"
    docker exec "$CONTAINER" sh -c "$CELERY inspect active_queues 2>/dev/null" |
      grep -oE "celery@[^:]*|'name': '[a-z_]+'" || true
    ;;
  stop)
    docker exec "$CONTAINER" sh -c \
      "$CELERY control -d $(normal_worker) add_consumer $QUEUE"
    docker exec "$CONTAINER" sh -c "pkill -f -- '-n $NODE@' || true"
    ;;
  *)
    echo "Usage: $0 start|stop" >&2
    exit 2
    ;;
esac
