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

from unittest.mock import MagicMock, patch

from superset.themes.types import ThemeMode
from superset.views.base import _process_theme, get_theme_bootstrap_data


def test_process_theme_none() -> None:
    """A missing theme becomes an empty dict."""
    assert _process_theme(None, ThemeMode.DEFAULT) == {}


def test_process_theme_empty() -> None:
    """An empty theme stays empty."""
    assert _process_theme({}, ThemeMode.DEFAULT) == {}


@patch("superset.views.base.is_valid_theme")
def test_process_theme_invalid(mock_is_valid: MagicMock) -> None:
    """An invalid theme is cleared and logged."""
    mock_is_valid.return_value = False
    theme = {"invalid": "theme"}

    with patch("superset.views.base.logger") as mock_logger:
        assert _process_theme(theme, ThemeMode.DEFAULT) == {}
        mock_logger.warning.assert_called_once_with(
            "Invalid %s theme configuration: %s, clearing it",
            "default",
            theme,
        )


@patch("superset.views.base.is_valid_theme")
def test_process_theme_valid(mock_is_valid: MagicMock) -> None:
    """A valid theme is returned unchanged."""
    mock_is_valid.return_value = True
    theme = {"token": {"colorPrimary": "#444"}}

    assert _process_theme(theme, ThemeMode.DEFAULT) == theme


@patch("superset.views.base.get_config_value")
def test_bootstrap_data_uses_config_themes(mock_get_config: MagicMock) -> None:
    """The client gets the themes of the configuration, nothing else."""
    mock_get_config.side_effect = lambda k: {
        "THEME_DEFAULT": {"token": {"colorPrimary": "#config1"}},
        "THEME_DARK": {"token": {"colorPrimary": "#config2"}},
    }.get(k)

    result = get_theme_bootstrap_data()

    assert result["theme"]["default"] == {"token": {"colorPrimary": "#config1"}}
    assert result["theme"]["dark"] == {"token": {"colorPrimary": "#config2"}}
    assert "enableUiThemeAdministration" not in result["theme"]


@patch("superset.views.base.get_config_value")
def test_bootstrap_data_without_dark_theme(mock_get_config: MagicMock) -> None:
    """A single-theme product sets THEME_DARK to None and sends no dark theme."""
    mock_get_config.side_effect = lambda k: {
        "THEME_DEFAULT": {"token": {"colorPrimary": "#config1"}},
        "THEME_DARK": None,
    }.get(k)

    result = get_theme_bootstrap_data()

    assert result["theme"]["dark"] == {}
