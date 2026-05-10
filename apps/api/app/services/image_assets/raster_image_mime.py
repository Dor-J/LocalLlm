"""Resolve and validate raster image MIME types from bytes (magic-byte sniffing)."""

from __future__ import annotations

import filetype

_RASTER_EXT_TO_MIME: dict[str, str] = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
}


def resolve_raster_image_mime(*, content: bytes, declared_content_type: str) -> str:
    """
    Return the canonical raster ``image/*`` MIME for ``content``.

    Sniffs bytes with ``filetype``; only PNG, JPEG, GIF, and WebP are allowed.
    Rejects SVG and other formats. If the client declares ``image/*``, it must
    match the sniffed type (after normalizing ``image/jpg`` to ``image/jpeg``).
    ``application/octet-stream`` or an empty declaration skips that check.
    """
    if not content:
        raise ValueError("Empty file.")

    declared = (declared_content_type or "").strip().lower()
    if (
        declared
        and not declared.startswith("image/")
        and declared != "application/octet-stream"
    ):
        raise ValueError("Only image uploads are supported.")

    if declared.startswith("image/svg"):
        raise ValueError("SVG uploads are not supported.")

    if declared == "image/jpg":
        declared = "image/jpeg"

    kind = filetype.guess(content)
    if kind is None:
        head = content[:4096].lstrip().lower()
        if head.startswith((b"<?xml", b"<svg")) or b"<svg" in head[:2048]:
            raise ValueError("SVG uploads are not supported.")
        raise ValueError(
            "Could not recognize image format. Upload a PNG, JPEG, GIF, or WebP file."
        )

    ext = (kind.extension or "").lower()
    if ext == "svg":
        raise ValueError("SVG uploads are not supported.")
    if ext == "jpg":
        ext = "jpeg"
    canonical = _RASTER_EXT_TO_MIME.get(ext)
    if canonical is None:
        raise ValueError(
            "Unsupported image type. Upload a PNG, JPEG, GIF, or WebP file."
        )

    if declared.startswith("image/") and declared != canonical:
        raise ValueError("Content-Type does not match file contents.")

    return canonical
