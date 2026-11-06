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
Images a person attaches to the assistant. An upload is hostile until proven otherwise.

``clean_image`` is the only way in. The type comes from the bytes, through the decoders
of Pillow for the three formats on offer, never from a name or a header: SVG has no
decoder there, and neither has anything else. The size is read from the header and
checked before a pixel is decoded, which is what stops a decompression bomb. What gets
stored is a new image, made only of pixels, so no metadata survives, and it is made to
fit what the API takes: a stored image goes out on every later request of a conversation
that can only grow, so one the API refused would break that conversation for good.

An image is stored once and its bytes never change. That is what keeps the prefix of the
prompt cache stable: a message only names it (``auradata_attachment``), and
``with_images`` makes the block of the API, the same on every request. Those tokens are
counted by ``usage``, so they reach the spending limits and the context warning alone.

An upload is a draft of its person until a message claims it. Reads are for the owner,
and a conversation takes its images with it (``conversations.erase_conversations``).
"""

from __future__ import annotations

import base64
import io
import logging
import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from flask_babel import gettext as _
from PIL import Image, ImageOps

from superset.auradata.assistant.tools import MAX_IMAGE_BASE64_CHARS
from superset.auradata.models import AssistantAttachment
from superset.extensions import db

logger = logging.getLogger(__name__)

ATTACHMENT_BLOCK = "auradata_attachment"

# Under the 10 MB a proxy of this product takes in a request, with room for its form
MAX_UPLOAD_BYTES = 8_000_000
# Read from the header, before decoding: 40 MP takes 160 MB of memory at most
MAX_PIXELS = 40_000_000
MAX_PER_MESSAGE = 5
# Every image of a conversation goes out again on each of its requests
MAX_PER_CONVERSATION = 20
# Uploads nobody has sent yet, per person
MAX_DRAFTS = 20
DRAFT_WINDOW = timedelta(days=1)

# What the largest models read. Under 3000 px, so requests with more than 20 images pass
MAX_LONG_EDGE = 2576
MAX_VISUAL_TOKENS = 4784
PATCH = 28
MAX_ENCODED_BYTES = MAX_IMAGE_BASE64_CHARS * 3 // 4
SHRINK_STEP = 0.8

# Each format stays as it came: a screenshot keeps its text sharp, and a photo its size
FORMATS = {
    "PNG": ("image/png", {}),
    "JPEG": ("image/jpeg", {"quality": 90}),
    "WEBP": ("image/webp", {"quality": 90}),
}


class ImageRefusedError(ValueError):
    """An image the assistant does not take, with the message for the person."""


@dataclass(frozen=True)
class CleanImage:
    """An image that is safe to keep, show and send."""

    data: bytes
    media_type: str
    width: int
    height: int


def visual_tokens(width: int, height: int) -> int:
    """What an image costs on the API, in its patches."""
    return math.ceil(width / PATCH) * math.ceil(height / PATCH)


def _size_within_limits(width: int, height: int) -> tuple[int, int]:
    """The largest size of this shape that fits the model untouched."""
    scale = min(
        1.0,
        MAX_LONG_EDGE / max(width, height),
        math.sqrt(MAX_VISUAL_TOKENS * PATCH**2 / (width * height)),
    )
    size = max(1, int(width * scale)), max(1, int(height * scale))
    while visual_tokens(*size) > MAX_VISUAL_TOKENS:
        size = max(1, size[0] - PATCH), max(1, size[1] - PATCH)
    return size


def _pixels_of(decoded: Image.Image) -> Image.Image:
    """
    Only the pixels of an image, upright. Saving reads ``info`` for some fields, so
    a copy would keep them: this one is built from nothing.
    """
    upright = ImageOps.exif_transpose(decoded)
    has_alpha = upright.mode in {"RGBA", "LA", "PA"} or "transparency" in upright.info
    plain = upright.convert("RGBA" if has_alpha else "RGB")
    return Image.frombytes(plain.mode, plain.size, plain.tobytes())


def _encoded(pixels: Image.Image, image_format: str) -> bytes:
    buffer = io.BytesIO()
    pixels.save(buffer, format=image_format, **FORMATS[image_format][1])
    return buffer.getvalue()


def clean_image(raw: bytes) -> CleanImage:
    """
    The image to keep from what someone uploaded. Refuses what is not a PNG, JPEG or
    WEBP that decodes whole, whatever it says it is.
    """
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ImageRefusedError(_("This image is larger than 8 MB."))
    try:
        with Image.open(io.BytesIO(raw), formats=tuple(FORMATS)) as decoded:
            image_format = decoded.format or ""
            if decoded.width * decoded.height > MAX_PIXELS:
                raise ImageRefusedError(_("This image has too many pixels."))
            decoded.load()
            pixels = _pixels_of(decoded)
    except ImageRefusedError:
        raise
    except Image.DecompressionBombError as ex:
        raise ImageRefusedError(_("This image has too many pixels.")) from ex
    except Exception as ex:  # pylint: disable=broad-except
        # Hostile bytes can fail anywhere in a decoder, and all of it means the same
        logger.info("An attached image was refused: %s", type(ex).__name__)
        raise ImageRefusedError(_("Use a PNG, JPEG or WEBP image.")) from ex

    size = _size_within_limits(*pixels.size)
    if size != pixels.size:
        pixels = pixels.resize(size, Image.Resampling.LANCZOS)
    data = _encoded(pixels, image_format)
    while len(data) > MAX_ENCODED_BYTES:
        size = (
            max(1, int(pixels.width * SHRINK_STEP)),
            max(1, int(pixels.height * SHRINK_STEP)),
        )
        pixels = pixels.resize(size, Image.Resampling.LANCZOS)
        data = _encoded(pixels, image_format)
    return CleanImage(data, FORMATS[image_format][0], pixels.width, pixels.height)


def _drafts_of(user_id: int) -> Any:
    return db.session.query(AssistantAttachment).filter(
        AssistantAttachment.user_id == user_id,
        AssistantAttachment.conversation_id.is_(None),
    )


def save_draft(user_id: int, image: CleanImage) -> AssistantAttachment:
    """Keep an image until a message sends it."""
    if _drafts_of(user_id).count() >= MAX_DRAFTS:
        raise ImageRefusedError(
            _("You have too many images waiting. Send or remove some first.")
        )
    draft = AssistantAttachment(
        id=uuid4(),
        user_id=user_id,
        image=image.data,
        image_type=image.media_type,
        width=image.width,
        height=image.height,
    )
    db.session.add(draft)
    db.session.commit()  # pylint: disable=consider-using-transaction
    return draft


def find_attachment(attachment_id: UUID, user_id: int) -> AssistantAttachment | None:
    """An image of this person. Anyone else's is None, like one that never was."""
    return (
        db.session.query(AssistantAttachment)
        .filter(
            AssistantAttachment.id == attachment_id,
            AssistantAttachment.user_id == user_id,
        )
        .one_or_none()
    )


def delete_draft(attachment_id: UUID, user_id: int) -> bool:
    """Drop an image that was not sent. A sent one goes with its conversation."""
    deleted = (
        _drafts_of(user_id)
        .filter(AssistantAttachment.id == attachment_id)
        .delete(synchronize_session=False)
    )
    db.session.commit()  # pylint: disable=consider-using-transaction
    return bool(deleted)


def has_drafts(ids: Sequence[UUID], user_id: int) -> bool:
    """Whether all of these are drafts of this person."""
    return _drafts_of(user_id).filter(AssistantAttachment.id.in_(ids)).count() == len(
        ids
    )


def claim_drafts(ids: Sequence[UUID], conversation_id: UUID, user_id: int) -> bool:
    """
    Give drafts to a conversation, in the transaction of the message that sends them.
    False when one is gone: of two messages that send the same draft, only one wins.
    """
    claimed = (
        _drafts_of(user_id)
        .filter(AssistantAttachment.id.in_(ids))
        .update({"conversation_id": conversation_id}, synchronize_session=False)
    )
    return claimed == len(ids)


def attachments_in(conversation_id: UUID) -> int:
    """How many images a conversation resends on each request."""
    return (
        db.session.query(AssistantAttachment)
        .filter(AssistantAttachment.conversation_id == conversation_id)
        .count()
    )


def delete_attachments_of(conversation_ids: Sequence[UUID]) -> None:
    """Delete the images of conversations, in the transaction of the caller."""
    db.session.query(AssistantAttachment).filter(
        AssistantAttachment.conversation_id.in_(conversation_ids)
    ).delete(synchronize_session=False)


def attachment_block(attachment_id: UUID) -> dict[str, Any]:
    """What a stored message holds of an image: never its bytes."""
    return {"type": ATTACHMENT_BLOCK, "id": str(attachment_id)}


def with_images(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Messages as the API takes them, with each named image as its block. The bytes are
    the stored ones, so a block comes out the same on every request.
    """
    wanted = [
        UUID(block["id"])
        for message in messages
        for block in message["content"]
        if block["type"] == ATTACHMENT_BLOCK
    ]
    if not wanted:
        return messages
    images = {
        str(row.id): {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": row.image_type,
                "data": base64.standard_b64encode(row.image).decode("ascii"),
            },
        }
        for row in db.session.query(
            AssistantAttachment.id,
            AssistantAttachment.image_type,
            AssistantAttachment.image,
        ).filter(AssistantAttachment.id.in_(wanted))
    }
    return [
        {
            **message,
            "content": [
                images[block["id"]] if block["type"] == ATTACHMENT_BLOCK else block
                for block in message["content"]
            ],
        }
        for message in messages
    ]


def purge_drafts(dry_run: bool = False, now: datetime | None = None) -> int:
    """
    Delete the uploads nobody sent, however long conversations are kept: they are not
    part of any. With ``dry_run`` it only counts them.
    """
    cutoff = (now or datetime.now()) - DRAFT_WINDOW
    stale = db.session.query(AssistantAttachment).filter(
        AssistantAttachment.conversation_id.is_(None),
        AssistantAttachment.created_on < cutoff,
    )
    count = stale.count()
    if not dry_run and count:
        stale.delete(synchronize_session=False)
    db.session.commit()  # pylint: disable=consider-using-transaction
    logger.info("assistant retention: %s unsent images (dry run %s)", count, dry_run)
    return count
