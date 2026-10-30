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
from copy import deepcopy
from typing import Any

from superset.utils import json

database_metadata_config: dict[str, Any] = {
    "version": "1.0.0",
    "type": "Database",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}

dataset_metadata_config: dict[str, Any] = {
    "version": "1.0.0",
    "type": "SqlaTable",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}

chart_metadata_config: dict[str, Any] = {
    "version": "1.0.0",
    "type": "Slice",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}

dashboard_metadata_config: dict[str, Any] = {
    "version": "1.0.0",
    "type": "Dashboard",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}
metadata_files = {
    "database": database_metadata_config,
    "dataset": dataset_metadata_config,
    "chart": chart_metadata_config,
    "dashboard": dashboard_metadata_config,
}
saved_queries_metadata_config: dict[str, Any] = {
    "version": "1.0.0",
    "type": "SavedQuery",
    "timestamp": "2021-03-30T20:37:54.791187+00:00",
}
database_config_sqlite: dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_dml": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "sqlite:///test.db",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "version": "1.0.0",
}

database_config: dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_dml": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "postgresql://user:pass@host1",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "version": "1.0.0",
}
database_config_no_creds: dict[str, Any] = {
    "allow_csv_upload": False,
    "allow_ctas": False,
    "allow_cvas": False,
    "allow_dml": False,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database_no_creds",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "bigquery://test-db/",
    "uuid": "2ff17edc-f3fa-4609-a5ac-b484281225bc",
    "version": "1.0.0",
}

database_config_with_masked_encrypted_extra: dict[str, Any] = {
    "allow_csv_upload": False,
    "allow_ctas": False,
    "allow_cvas": False,
    "allow_dml": False,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database_encrypted",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "bigquery://test-project/",
    "uuid": "c9a1dde3-889e-5bc0-9ae9-0bc229e8fa90",
    "masked_encrypted_extra": json.dumps(
        {
            "credentials_info": {
                "type": "service_account",
                "project_id": "test-project",
                "private_key": "-----BEGIN PRIVATE KEY-----\nMyPriVaTeKeY\n-----END PRIVATE KEY-----\n",  # noqa: E501
            }
        }
    ),
    "version": "1.0.0",
}

database_with_ssh_tunnel_config_private_key: dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_dml": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "postgresql://user:pass@host1",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "ssh_tunnel": {
        "server_address": "localhost",
        "server_port": 22,
        "username": "Test",
        "private_key": "XXXXXXXXXX",
        "private_key_password": "XXXXXXXXXX",
    },
    "version": "1.0.0",
}

database_with_ssh_tunnel_config_password: dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_dml": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "postgresql://user:pass@host1",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "ssh_tunnel": {
        "server_address": "localhost",
        "server_port": 22,
        "username": "Test",
        "password": "XXXXXXXXXX",
    },
    "version": "1.0.0",
}

database_with_ssh_tunnel_config_no_credentials: dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_dml": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "sqlite:///test.db",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "ssh_tunnel": {
        "server_address": "localhost",
        "server_port": 22,
        "username": "Test",
    },
    "version": "1.0.0",
}

database_with_ssh_tunnel_config_mix_credentials: dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_dml": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "sqlite:///test.db",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "ssh_tunnel": {
        "server_address": "localhost",
        "server_port": 22,
        "username": "Test",
        "password": "XXXXXXXXXX",
        "private_key": "XXXXXXXXXX",
    },
    "version": "1.0.0",
}

database_with_ssh_tunnel_config_private_pass_only: dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_dml": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "sqlite:///test.db",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "ssh_tunnel": {
        "server_address": "localhost",
        "server_port": 22,
        "username": "Test",
        "private_key_password": "XXXXXXXXXX",
    },
    "version": "1.0.0",
}


dataset_config: dict[str, Any] = {
    "table_name": "imported_dataset",
    "main_dttm_col": None,
    "currency_code_column": "currency",
    "description": "This is a dataset that was exported",
    "default_endpoint": "",
    "offset": 66,
    "cache_timeout": 55,
    "schema": "",
    "catalog": "default",
    "sql": "",
    "params": None,
    "template_params": {},
    "normalize_columns": False,
    "always_filter_main_dttm": False,
    "filter_select_enabled": True,
    "fetch_values_predicate": None,
    "extra": '{ "certification": { "certified_by": "Data Platform Team", "details": "This table is the source of truth." }, "warning_markdown": "This is a warning." }',  # noqa: E501
    "metrics": [
        {
            "metric_name": "count",
            "verbose_name": "",
            "metric_type": None,
            "expression": "count(1)",
            "description": None,
            "d3format": None,
            "extra": {},
            "warning_text": None,
        },
    ],
    "columns": [
        {
            "column_name": "cnt",
            "verbose_name": "Count of something",
            "is_dttm": False,
            "is_active": None,
            "type": "NUMBER",
            "groupby": False,
            "filterable": True,
            "expression": "",
            "description": None,
            "python_date_format": None,
        },
    ],
    "version": "1.0.0",
    "uuid": "10808100-158b-42c4-842e-f32b99d88dfb",
    "database_uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
}

chart_config: dict[str, Any] = {
    "slice_name": "Deck Path",
    "viz_type": "deck_path",
    "params": {
        "color_picker": {"a": 1, "b": 135, "g": 122, "r": 0},
        "datasource": "12__table",
        "js_columns": ["color"],
        "js_data_mutator": r"data => data.map(d => ({\n    ...d,\n    color: colors.hexToRGB(d.extraProps.color)\n}));",  # noqa: E501
        "js_onclick_href": "",
        "js_tooltip": "",
        "line_column": "path_json",
        "line_type": "json",
        "line_width": 150,
        "mapbox_style": "mapbox://styles/mapbox/light-v9",
        "reverse_long_lat": False,
        "row_limit": 5000,
        "slice_id": 43,
        "time_grain_sqla": None,
        "time_range": " : ",
        "viewport": {
            "altitude": 1.5,
            "bearing": 0,
            "height": 1094,
            "latitude": 37.73671752604488,
            "longitude": -122.18885402582598,
            "maxLatitude": 85.05113,
            "maxPitch": 60,
            "maxZoom": 20,
            "minLatitude": -85.05113,
            "minPitch": 0,
            "minZoom": 0,
            "pitch": 0,
            "width": 669,
            "zoom": 9.51847667620428,
        },
        "viz_type": "deck_path",
    },
    "query_context": '{"datasource":{"id":12,"type":"table"},"force":false,"queries":[{"time_range":" : ","filters":[],"extras":{"time_grain_sqla":null,"having":"","where":""},"applied_time_extras":{},"columns":[],"metrics":[],"annotation_layers":[],"row_limit":5000,"timeseries_limit":0,"order_desc":true,"url_params":{},"custom_params":{},"custom_form_data":{}}],"result_format":"json","result_type":"full"}',  # noqa: E501
    "cache_timeout": None,
    "uuid": "0c23747a-6528-4629-97bf-e4b78d3b9df1",
    "version": "1.0.0",
    "dataset_uuid": "10808100-158b-42c4-842e-f32b99d88dfb",
}
chart_config_with_mixed_annotations: dict[str, Any] = deepcopy(chart_config)
chart_config_with_mixed_annotations["params"]["annotation_layers"] = [
    {
        "name": "Formula test layer",
        "annotationType": "FORMULA",
        "color": None,
        "descriptionColumns": [],
        "hideLine": False,
        "opacity": "",
        "overrides": {"time_range": None},
        "show": True,
        "showLabel": False,
        "showMarkers": False,
        "style": "solid",
        "value": "100000",
        "width": 1,
    },
    {
        "name": "Native layer to be removed on import",
        "annotationType": "EVENT",
        "sourceType": "NATIVE",
        "color": None,
        "opacity": "",
        "style": "solid",
        "width": 1,
        "showMarkers": False,
        "hideLine": False,
        "value": 2,
        "overrides": {"time_range": None},
        "show": True,
        "showLabel": False,
        "descriptionColumns": [],
    },
]

dashboard_config: dict[str, Any] = {
    "dashboard_title": "Test dash",
    "description": None,
    "css": "",
    "slug": None,
    "uuid": "c4b28c4e-a1fe-4cf8-a5ac-d6f11d6fdd51",
    "position": {
        "CHART-SVAlICPOSJ": {
            "children": [],
            "id": "CHART-SVAlICPOSJ",
            "meta": {
                "chartId": 83,
                "height": 50,
                "sliceName": "Number of California Births",
                "uuid": "0c23747a-6528-4629-97bf-e4b78d3b9df1",
                "width": 4,
            },
            "parents": ["ROOT_ID", "GRID_ID", "ROW-dP_CHaK2q"],
            "type": "CHART",
        },
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": ["ROW-dP_CHaK2q"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "Test dash"},
            "type": "HEADER",
        },
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "ROW-dP_CHaK2q": {
            "children": ["CHART-SVAlICPOSJ"],
            "id": "ROW-dP_CHaK2q",
            "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
    },
    "metadata": {
        "timed_refresh_immune_slices": [83],
        "filter_scopes": {
            "83": {"region": {"scope": ["ROOT_ID"], "immune": [83]}},
        },
        "expanded_slices": {"83": True},
        "refresh_frequency": 0,
        "default_filters": "{}",
        "color_scheme": None,
        "remote_id": 7,
        "import_time": 1604342885,
    },
    "version": "1.0.0",
}
saved_queries_config = {
    "schema": "public",
    "label": "Test Saved Query",
    "description": None,
    "sql": "-- Note: Unless you save your query, these tabs will NOT persist if you clear\nyour cookies or change browsers.\n\n\nSELECT * from birth_names",  # noqa: E501
    "uuid": "05b679b5-8eaf-452c-b874-a7a774cfa4e9",
    "version": "1.0.0",
    "database_uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "catalog": "default",
}
