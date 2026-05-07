#!/usr/bin/env python3
"""Write solid-color square PNGs for PWA manifest (stdlib only)."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path


def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_solid_png(path: Path, size: int, rgb: tuple[int, int, int]) -> None:
    w, h = size, size
    r, g, b = rgb
    raw = bytearray()
    row = bytes([0]) + bytes([r, g, b] * w)
    for _ in range(h):
        raw.extend(row)
    compressed = zlib.compress(bytes(raw), 9)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", compressed) + _chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    icons = root / "icons"
    lavender = (167, 139, 250)
    write_solid_png(icons / "icon-192.png", 192, lavender)
    write_solid_png(icons / "icon-512.png", 512, lavender)
    print("Wrote", icons / "icon-192.png", icons / "icon-512.png")


if __name__ == "__main__":
    main()
