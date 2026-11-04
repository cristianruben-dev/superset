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
"""Flags the product fixes to off (Superset's mobile consumption mode)."""

from flask import Flask

from superset.utils.feature_flag_manager import FeatureFlagManager


def _manager(flags: dict[str, bool], **config: object) -> FeatureFlagManager:
    app = Flask(__name__)
    app.config.update(
        DEFAULT_FEATURE_FLAGS={},
        FEATURE_FLAGS=flags,
        GET_FEATURE_FLAGS_FUNC=config.get("get_flags"),
        IS_FEATURE_ENABLED_FUNC=config.get("is_enabled"),
    )
    manager = FeatureFlagManager()
    manager.init_app(app)
    return manager


def test_mobile_consumption_mode_is_off_even_when_configured() -> None:
    manager = _manager({"MOBILE_CONSUMPTION_MODE": True, "OTHER": True})

    assert manager.get_feature_flags()["MOBILE_CONSUMPTION_MODE"] is False
    assert manager.is_feature_enabled("MOBILE_CONSUMPTION_MODE") is False
    assert manager.get_feature_flags()["OTHER"] is True


def test_mobile_consumption_mode_is_off_under_dynamic_callbacks() -> None:
    manager = _manager(
        {"MOBILE_CONSUMPTION_MODE": False},
        get_flags=lambda flags: {**flags, "MOBILE_CONSUMPTION_MODE": True},
        is_enabled=lambda _name, _default: True,
    )

    assert manager.get_feature_flags()["MOBILE_CONSUMPTION_MODE"] is False
    assert manager.is_feature_enabled("MOBILE_CONSUMPTION_MODE") is False
