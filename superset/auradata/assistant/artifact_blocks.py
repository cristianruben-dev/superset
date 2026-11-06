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
What a document of the assistant can hold, block by block.

Everything here comes from the model, so everything is refused unless it fits: every
level forbids unknown fields, each list and text has a limit, and a block of data has no
field for a number, only its query. The ids and dates a block carries are the server's:
``id`` and ``written_on`` are not fields of these models, so the model cannot set them.

The query keeps the shape ``query_dataset`` takes, because it comes out of what the
model has just queried, and ``artifacts.query_problem`` holds it against the dataset.
The JSON schema of these models is what the tools offer to the model, so it never drifts
from what is checked.

Markdown of a text block is refused here when it holds raw HTML, a picture or a link off
this site, and the panel renders it through ``AssistantMarkdown`` anyway. Both hold:
this stored text will also reach PDFs and report pages.

This module imports the schemas of the MCP service, so it is imported where it is used.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
    StringConstraints,
)

from superset.mcp_service.dataset.schemas import (
    QueryDatasetAggregate,
    QueryDatasetFilter,
    validate_time_range,
)

MAX_TITLE_CHARS = 200
MAX_LABEL_CHARS = 120
MAX_TEXT_CHARS = 8_000
MAX_NAME_CHARS = 250
MAX_BLOCKS = 40
MAX_CHANGES = 20
MAX_QUERY_COLUMNS = 8
MAX_QUERY_METRICS = 8
MAX_CHART_METRICS = 4
MAX_FILTERS = 20
MAX_FILTER_VALUES = 100
MAX_ROWS = 100

# A tag or comment of HTML, also inside an autolink. A lone "<" is arithmetic
_RAW_HTML = re.compile(r"<[a-zA-Z/!?]")
_PICTURE = re.compile(r"!\[")
# The address of an inline link, unless it is a path of this site
_OUTSIDE_LINK = re.compile(r"\]\(\s*<?(?!/(?!/))")

Name = Annotated[str, StringConstraints(min_length=1, max_length=MAX_NAME_CHARS)]
Title = Annotated[
    str,
    StringConstraints(
        min_length=1,
        max_length=MAX_TITLE_CHARS,
        strip_whitespace=True,
        pattern=r"^[^\n\r]+$",
    ),
]
Label = Annotated[
    str,
    StringConstraints(
        min_length=1,
        max_length=MAX_LABEL_CHARS,
        strip_whitespace=True,
        pattern=r"^[^\n\r]+$",
    ),
]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ArtifactFilter(QueryDatasetFilter):
    """A filter of a query, with its value kept to what a filter can use."""

    model_config = ConfigDict(extra="forbid")

    col: Name

    @field_validator("val")
    @classmethod
    def _plain_value(cls, value: Any) -> Any:
        values = value if isinstance(value, list) else [value]
        if len(values) > MAX_FILTER_VALUES:
            raise ValueError(f"at most {MAX_FILTER_VALUES} values")
        for item in values:
            if not isinstance(item, (str, int, float, bool, type(None))):
                raise ValueError("a filter value is a text, a number or a list of them")
            if isinstance(item, str) and len(item) > MAX_NAME_CHARS:
                raise ValueError(f"a value takes at most {MAX_NAME_CHARS} characters")
        return value


class ArtifactAggregate(QueryDatasetAggregate):
    """An aggregate over a column of the dataset."""

    model_config = ConfigDict(extra="forbid")

    column: Name
    label: Label | None = Field(
        default=None,
        description=(
            "What a person calls this number, in their language, such as Ventas. "
            "Legends and table headers show it instead of SUM(ventas)."
        ),
    )


class ArtifactQuery(_Strict):
    """
    What a block of data asks for, in the words of ``query_dataset``. It is all a block
    knows about its numbers: they are read through the chart data API, as whoever opens
    the document.
    """

    dataset_id: int = Field(..., gt=0, description="Numeric id of the dataset.")
    columns: list[Name] = Field(
        default_factory=list,
        max_length=MAX_QUERY_COLUMNS,
        description="Columns to group by, as in query_dataset.",
    )
    metrics: list[Name] = Field(
        default_factory=list,
        max_length=MAX_QUERY_METRICS,
        description="Saved metrics of the dataset, as in query_dataset.",
    )
    aggregates: list[ArtifactAggregate] = Field(
        default_factory=list,
        max_length=MAX_QUERY_METRICS,
        description="Aggregates over columns, as in query_dataset.",
    )
    filters: list[ArtifactFilter] = Field(
        default_factory=list,
        max_length=MAX_FILTERS,
        description="Filters, as in query_dataset.",
    )
    time_range: str | None = Field(
        default=None,
        max_length=MAX_NAME_CHARS,
        description="A time range, as in query_dataset.",
    )
    time_column: Name | None = Field(
        default=None,
        description="Column of the time range. By default, the dataset's main one.",
    )
    order_by: list[Name] | None = Field(
        default=None,
        max_length=MAX_QUERY_METRICS,
        description="Column or metric names to sort by.",
    )
    order_desc: bool = Field(default=True, description="Sort descending.")
    row_limit: int = Field(
        default=30, ge=1, le=MAX_ROWS, description="Rows to read, 100 at most."
    )

    @field_validator("time_range")
    @classmethod
    def _valid_time_range(cls, value: str | None) -> str | None:
        return validate_time_range(value)

    @property
    def metric_count(self) -> int:
        return len(self.metrics) + len(self.aggregates)


class TextBlock(_Strict):
    """Paragraphs in Markdown. No HTML, no pictures, and links only of this site."""

    type: Literal["text"]
    text: str = Field(
        ...,
        min_length=1,
        max_length=MAX_TEXT_CHARS,
        description=(
            "Markdown: paragraphs, ## headings, lists, bold. No HTML, pictures or "
            "links to other sites."
        ),
    )

    @field_validator("text")
    @classmethod
    def _plain_markdown(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("the text is empty")
        if _RAW_HTML.search(value):
            raise ValueError("raw HTML is not allowed")
        if _PICTURE.search(value):
            raise ValueError("pictures are not allowed")
        if _OUTSIDE_LINK.search(value):
            raise ValueError("links to other sites are not allowed")
        return value


class FigureBlock(_Strict):
    """One number that stands out, read from its query."""

    type: Literal["figure"]
    label: Label = Field(..., description="What the number is. Never the number.")
    format: Literal["number", "compact", "percent", "currency"] = Field(
        default="number", description="How the number reads."
    )
    query: ArtifactQuery = Field(
        ..., description="One metric or aggregate, with no columns."
    )

    @model_validator(mode="after")
    def _one_number(self) -> "FigureBlock":
        if self.query.columns or self.query.metric_count != 1:
            raise ValueError("a figure takes one metric and no columns")
        return self


class ChartBlock(_Strict):
    """A chart drawn from its query."""

    type: Literal["chart"]
    title: Title = Field(..., description="What the chart shows.")
    chart: Literal["bar", "line", "area", "pie"] = Field(
        ..., description="How to draw it."
    )
    query: ArtifactQuery = Field(
        ...,
        description=(
            "columns[0] is the axis, or the slices of a pie, and an optional "
            "columns[1] splits it into series. A pie takes one column and one metric."
        ),
    )

    @model_validator(mode="after")
    def _drawable(self) -> "ChartBlock":
        columns = len(self.query.columns)
        metrics = self.query.metric_count
        if self.chart == "pie":
            if columns != 1 or metrics != 1:
                raise ValueError("a pie takes one column and one metric")
        elif columns not in (1, 2) or not 1 <= metrics <= MAX_CHART_METRICS:
            raise ValueError(
                f"a chart takes one or two columns and 1 to {MAX_CHART_METRICS} metrics"
            )
        elif columns == 2 and metrics > 1:
            raise ValueError("a chart split into series takes one metric")
        return self


class TableBlock(_Strict):
    """Rows read from its query."""

    type: Literal["table"]
    title: Title = Field(..., description="What the table shows.")
    query: ArtifactQuery = Field(..., description="Columns, metrics or both.")

    @model_validator(mode="after")
    def _something_to_read(self) -> "TableBlock":
        if not self.query.columns and not self.query.metric_count:
            raise ValueError("a table takes columns, metrics or both")
        return self


Block = Annotated[
    TextBlock | FigureBlock | ChartBlock | TableBlock,
    Field(discriminator="type"),
]


class ReplaceBlock(_Strict):
    """Put a whole new block in the place of one, keeping its id."""

    action: Literal["replace"]
    block_id: Name
    block: Block


class AddBlock(_Strict):
    """Add a block after another one, or first when ``after`` is null."""

    action: Literal["add"]
    after: Name | None = Field(..., description="Id of the block before, or null.")
    block: Block


class RemoveBlock(_Strict):
    """Take a block out of the document."""

    action: Literal["remove"]
    block_id: Name


class MoveBlock(_Strict):
    """Move a block after another one, or first when ``after`` is null."""

    action: Literal["move"]
    block_id: Name
    after: Name | None = Field(..., description="Id of the block before, or null.")


Change = Annotated[
    ReplaceBlock | AddBlock | RemoveBlock | MoveBlock,
    Field(discriminator="action"),
]


class CreateArtifact(_Strict):
    """A new document for the person asking, beside this conversation."""

    title: Title
    blocks: list[Block] = Field(..., min_length=1, max_length=MAX_BLOCKS)


class ChangeArtifact(_Strict):
    """
    Changes to a document, applied together as one new version. ``version`` is the one
    they are based on, so a change never lands on a document that moved.
    """

    artifact_id: str = Field(..., description="Id of the document.")
    version: int = Field(..., ge=1, description="The version these changes start from.")
    title: Title | None = Field(default=None, description="A new title, if it changes.")
    changes: list[Change] = Field(default_factory=list, max_length=MAX_CHANGES)


class SaveArtifactAsPage(_Strict):
    """A document of this person on this report, as new pages of the report."""

    artifact_id: str = Field(..., description="Id of the document.")
    version: int = Field(..., ge=1, description="The last version you saw.")


class ReadArtifact(_Strict):
    """A document, or the list of those of this conversation without an id."""

    artifact_id: str | None = Field(default=None, description="Id of the document.")
    version: int | None = Field(
        default=None, ge=1, description="An earlier version. By default, the last one."
    )


def stored_block(block: BaseModel) -> dict[str, Any]:
    """A block as a version stores it, before the server adds its id."""
    return block.model_dump(mode="json", exclude_none=True)
