"""Tests for magic-byte raster image MIME resolution."""

from __future__ import annotations

import pytest

from app.services.image_assets.raster_image_mime import resolve_raster_image_mime

# Tiny transparent 1x1 PNG
_MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00"
    b"\x01\r\x0b\xca\xe6\x00\x00\x00\x00IEND\xaeB`\x82"
)

# Tiny grayscale 1x1 JPEG
_MINIMAL_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00"
    b"\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19"
    b"\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \x22#\x1c\x1c(7),01444\x1f'"
    b"9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x14\x00"
    b"\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xda\x00\x08"
    b"\x01\x01\x00\x00?\x00\xaa\xff\xd9"
)

# Tiny 1x1 GIF87a
_MINIMAL_GIF = (
    b"GIF87a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff"
    b",\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x01D\x00;"
)

# Minimal lossy WebP (1x1); VP8 bitstream
_MINIMAL_WEBP = (
    b"RIFF(\x00\x00\x00WEBPVP8 \x1c\x00\x00\x00\x10\x00\x00\x00\x00\x00\x00\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
)


@pytest.mark.parametrize(
    ("content", "declared", "expected"),
    [
        (_MINIMAL_PNG, "image/png", "image/png"),
        (_MINIMAL_PNG, "application/octet-stream", "image/png"),
        (_MINIMAL_PNG, "", "image/png"),
        (_MINIMAL_JPEG, "image/jpeg", "image/jpeg"),
        (_MINIMAL_JPEG, "image/jpg", "image/jpeg"),
        (_MINIMAL_GIF, "image/gif", "image/gif"),
        (_MINIMAL_WEBP, "image/webp", "image/webp"),
    ],
)
def test_resolve_accepts_whitelisted_raster(
    content: bytes, declared: str, expected: str
) -> None:
    assert resolve_raster_image_mime(content=content, declared_content_type=declared) == expected


def test_resolve_rejects_empty_content() -> None:
    with pytest.raises(ValueError, match="Empty"):
        resolve_raster_image_mime(content=b"", declared_content_type="image/png")


def test_resolve_rejects_non_image_declared_type() -> None:
    with pytest.raises(ValueError, match="Only image"):
        resolve_raster_image_mime(
            content=_MINIMAL_PNG,
            declared_content_type="text/plain",
        )


def test_resolve_rejects_svg_declaration_even_with_raster_bytes() -> None:
    with pytest.raises(ValueError, match="SVG uploads are not supported"):
        resolve_raster_image_mime(
            content=_MINIMAL_PNG,
            declared_content_type="image/svg+xml",
        )


def test_resolve_rejects_sniffed_svg() -> None:
    svg = (
        b"<svg xmlns='http://www.w3.org/2000/svg'>"
        b"<rect width='1' height='1'/></svg>"
    )
    with pytest.raises(ValueError, match="SVG uploads are not supported"):
        resolve_raster_image_mime(
            content=svg,
            declared_content_type="application/octet-stream",
        )


def test_resolve_rejects_declared_mismatch() -> None:
    with pytest.raises(ValueError, match="does not match"):
        resolve_raster_image_mime(
            content=_MINIMAL_GIF,
            declared_content_type="image/png",
        )


def test_resolve_rejects_unknown_binary() -> None:
    with pytest.raises(ValueError, match="Could not recognize"):
        resolve_raster_image_mime(
            content=b"not an image at all",
            declared_content_type="application/octet-stream",
        )
