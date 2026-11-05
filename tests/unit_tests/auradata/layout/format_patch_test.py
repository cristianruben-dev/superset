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
"""Format changes checked against the generated format catalog."""

import pytest

from superset.auradata import catalog
from superset.auradata.layout.format_patch import (
    check_chart_patch,
    check_general_patch,
    FormatPatchError,
    is_site_image,
    merge_patch,
    replace_settings,
    ReportRefs,
    to_rgba,
)

BAR = "echarts_timeseries_bar"


def test_catalog_describes_the_charts_of_the_editor() -> None:
    assert BAR in catalog.chart_types()
    assert "table" in catalog.chart_types()
    visual = catalog.controls_of(BAR, "visual")
    assert visual["show_legend"]["value"] == "boolean"
    assert "metrics" not in catalog.controls_of(BAR)
    # Tooltip fields belong to Analytics for tools
    assert catalog.controls_of(BAR)["tooltip_metrics"]["level"] == "analytics"
    assert "series_colors" in catalog.own_chart_settings()


def test_chart_patch_checks_kind_and_level() -> None:
    clean = check_chart_patch(
        BAR,
        "visual",
        {"show_legend": False, "gridline_color": "#2563EB", "legendType": None},
    )
    assert clean == {
        "show_legend": False,
        "gridline_color": {"r": 37, "g": 99, "b": 235, "a": 1},
        "legendType": None,
    }
    with pytest.raises(FormatPatchError) as error:
        check_chart_patch(
            BAR,
            "visual",
            {
                "show_legend": "yes",
                "metrics": ["count"],
                "legendType": "fancy",
                "reference_lines": [],
            },
        )
    problems = " ".join(error.value.problems)
    assert "show_legend: must be true or false" in problems
    assert "metrics: not a format setting" in problems
    assert "legendType: must be one of" in problems
    assert "reference_lines: belongs to the analytics level" in problems


def test_unknown_chart_type_is_refused() -> None:
    with pytest.raises(FormatPatchError):
        check_chart_patch("no_such_chart", None, {"show_legend": True})


def test_chart_pictures_stay_on_this_site() -> None:
    assert is_site_image("/api/v1/dashboard_image/1/2/")
    assert is_site_image("data:image/png;base64,AAAA")
    assert not is_site_image("https://evil.example/x.png")
    assert not is_site_image("//evil.example/x.png")
    assert not is_site_image("data:image/svg+xml,<svg/>")
    with pytest.raises(FormatPatchError):
        check_chart_patch("pie", None, {"center_image": "https://evil.example/x.png"})


def test_general_patch_splits_chart_settings() -> None:
    box, chart = check_general_patch(
        {
            "background": "#ffffff",
            "title": {"show": True, "size": 18, "align": "center"},
            "auradata_tooltip": {"show": True, "fontSize": 12},
            "auradata_sampling": True,
        }
    )
    assert box == {
        "background": "#ffffff",
        "title": {"show": True, "size": 18, "align": "center"},
    }
    assert chart == {
        "auradata_tooltip": {"show": True, "fontSize": 12},
        "auradata_sampling": True,
    }


def test_general_patch_refuses_typos_and_unsafe_values() -> None:
    with pytest.raises(FormatPatchError) as error:
        check_general_patch(
            {
                "titel": {"show": True},
                "background": "red; background: url(https://evil.example)",
                "title": {"heading": 9},
                "link": {"action": {"type": "url", "url": "javascript:alert(1)"}},
            }
        )
    problems = " ".join(error.value.problems)
    assert "titel: unknown setting" in problems
    assert "background: must be a CSS color" in problems
    assert "title.heading: must be at most 6" in problems
    assert "link.action.url: must start with" in problems


def test_general_patch_checks_pages_of_the_report() -> None:
    refs = ReportRefs(pages={"TAB-1"})
    check_general_patch({"link": {"action": {"type": "page", "tabId": "TAB-1"}}}, refs)
    with pytest.raises(FormatPatchError):
        check_general_patch(
            {"link": {"action": {"type": "page", "tabId": "TAB-9"}}}, refs
        )


def test_merge_and_replace() -> None:
    current = {"title": {"show": True, "size": 12}, "radius": 4}
    assert merge_patch(current, {"title": {"size": None, "bold": True}}) == {
        "title": {"show": True, "bold": True},
        "radius": 4,
    }
    assert merge_patch(current, {"title": {"show": None, "size": None}}) == {
        "radius": 4
    }
    chart = {"x_axis_title_font": {"size": 12, "color": "#000"}}
    assert replace_settings(chart, {"x_axis_title_font": {"size": 14}}) == {
        "x_axis_title_font": {"size": 14}
    }


def test_to_rgba() -> None:
    assert to_rgba("#fff") == {"r": 255, "g": 255, "b": 255, "a": 1}
    assert to_rgba("#00000080") == {"r": 0, "g": 0, "b": 0, "a": 0.502}
    assert to_rgba({"r": 1, "g": 2, "b": 3}) == {"r": 1, "g": 2, "b": 3, "a": 1}
    assert to_rgba({"r": 300, "g": 2, "b": 3}) is None
    assert to_rgba("blue") is None


@pytest.mark.parametrize(
    "options",
    [
        # graphic[].style.image, as JavaScript object code
        "{ graphic: [{ type: 'image', style: { image: 'https://e.com/a.png' } }] }",
        # A symbol drawn from a picture
        '{ series: [{ symbol: "image://https://e.com/pin.png" }] }',
        # Pattern fills and rich text backgrounds
        "{ color: [{ image: '//e.com/p.png', repeat: 'repeat' }] }",
        "{ title: { textStyle: { rich: { a: { backgroundColor: "
        "{ image: `https://e.com/${x}b.png` } } } } } }",
        # Escapes and template parts spell the address past a plain search
        "{ graphic: { style: { image: '\\x68ttps://e.com/a.png' } } }",
        "{ graphic: { style: { image: `htt${''}ps://e.com/a.png` } } }",
        "{ graphic: { style: { image: 'data:text/html,<b>x</b>' } } }",
        # Tooltip formatters are HTML: pictures in them load too
        "{ tooltip: { formatter: '{b}<br/><img src=\"https://e.com/t.png\">' } }",
        '{ tooltip: { formatter: \'<span style="background:url(//e.com/t.png)">'
        "{c}</span>' } }",
        "{ tooltip: { formatter: "
        "'<img srcset=\"/a.png 1x, https://e.com/b.png 2x\">' } }",
    ],
)
def test_option_code_loads_no_picture_of_another_site(options: str) -> None:
    with pytest.raises(FormatPatchError, match="another site"):
        check_chart_patch(BAR, None, {"echart_options": options})


def test_json_settings_load_no_picture_of_another_site() -> None:
    from superset.auradata.layout.format_patch import foreign_addresses

    nested = {"graphic": [{"style": {"image": "image://http://e.com/a.png"}}]}
    assert foreign_addresses(nested) == ["http://e.com/a.png"]
    # Text that only mentions an address loads nothing, nor does a link
    assert foreign_addresses({"label": "See https://e.com"}) == []
    assert foreign_addresses('<b>{b}</b><a href="https://e.com">x</a>') == []
    assert foreign_addresses('<img src="/static/x.png">{c}') == []
    assert foreign_addresses({"a": "Total: 5", "b": "/static/x.png"}) == []
    png = "data:image/png;base64,iVBORw0KGgo="
    assert foreign_addresses([{"image": png}, "image:///static/x.png"]) == []


def test_site_pictures_pass_in_option_code() -> None:
    clean = check_chart_patch(
        BAR,
        None,
        {
            "echart_options": (
                "{ graphic: [{ type: 'image', style: { image: '/static/logo.png' "
                "} }], title: { text: 'Ventas: https://auradata.mx' } }"
            )
        },
    )
    assert "logo.png" in clean["echart_options"]
