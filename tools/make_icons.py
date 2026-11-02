"""Draws the Care Log Home Screen icon (teal square, white ring with a check mark).

Pure standard library: no image packages needed. Run:
    python tools/make_icons.py
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "docs" / "icons"
TEAL = (14, 107, 99)
WHITE = (255, 255, 255)


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def coverage(x, y):
    """1.0 where the white glyph is, 0.0 elsewhere. Coordinates are 0..1."""
    cx, cy = 0.5, 0.5
    ring_r, ring_w = 0.30, 0.055
    if abs(math.hypot(x - cx, y - cy) - ring_r) <= ring_w / 2:
        return 1.0
    pts = [(0.385, 0.505), (0.47, 0.59), (0.625, 0.425)]
    w = 0.062
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        if seg_dist(x, y, ax, ay, bx, by) <= w / 2:
            return 1.0
    return 0.0


def render(size, samples=4):
    rows = []
    for py in range(size):
        row = bytearray([0])  # PNG filter type 0
        for px in range(size):
            hit = 0
            for sy in range(samples):
                for sx in range(samples):
                    x = (px + (sx + 0.5) / samples) / size
                    y = (py + (sy + 0.5) / samples) / size
                    hit += coverage(x, y)
            a = hit / (samples * samples)
            row += bytes(round(TEAL[i] * (1 - a) + WHITE[i] * a) for i in range(3))
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size):
    raw = render(size)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)
    print(f"wrote {path.name} ({len(png):,} bytes)")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in (180, 192, 512):
        write_png(OUT / f"icon-{s}.png", s)
