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
"""Pictures the report tools receive: base64 only, never an address."""

import base64
import binascii

from superset.mcp_service.report_layout.editing import LayoutEditError


def decode_image(encoded: str) -> tuple[bytes, str]:
    """The bytes and media type of a base64 picture, checked as uploads are."""
    from superset.auradata.backgrounds import check_image, ImageUploadError

    text = encoded.strip()
    if text.startswith("data:"):
        text = text.split(",", 1)[-1]
    try:
        data = base64.b64decode(text, validate=True)
    except (binascii.Error, ValueError) as ex:
        raise LayoutEditError("image_base64 is not valid base64.") from ex
    try:
        return data, check_image(data)
    except ImageUploadError as ex:
        raise LayoutEditError(str(ex)) from ex
