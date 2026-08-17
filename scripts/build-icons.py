#!/usr/bin/env python3
"""Build the raster icons that an SVG favicon cannot cover.

    ./scripts/build-icons.py

Writes:
    favicon.ico                  16+32+48, for old clients and crawlers
    apple-touch-icon.png         180, full-bleed (iOS applies its own mask)
    assets/icon-192.png          manifest, purpose "any"
    assets/icon-512.png          manifest, purpose "any"
    assets/icon-maskable-512.png manifest, purpose "maskable"

Why draw the shapes rather than rasterise favicon.svg? This machine has no
rsvg-convert, ImageMagick, Inkscape or cairosvg, and a binary dependency is a
steep price for five icon files. Everything here is Python's standard library,
so the script runs anywhere with no install step.

IMPORTANT: THE GEOMETRY BELOW MIRRORS favicon.svg. Change one and you must
change the other, then re-run. Same drawing space: viewBox 64x64.
"""

import math
import os
import struct
import zlib

# --- geometry, mirroring favicon.svg (64x64 space) --------------------------

INK = (0x29, 0x3D, 0x50)
SUN = (0xFE, 0xE5, 0x0F)

CX, CY = 32.0, 33.0                     # dome centre, and the rays' pivot
DOME_R = 11.0

# one ray wedge, from d="M30.2 19.6h3.6l-.5-6.6h-2.6z"
RAY = [(30.2, 19.6), (33.8, 19.6), (33.3, 13.0), (30.7, 13.0)]
RAY_DILATE = 0.65                       # stroke-width 1.3 / 2, linejoin round
RAY_ANGLES = [-75 + k * (150 / 8) for k in range(9)]   # NINE. See favicon.svg.

# the three earth layers: (x, y, width, height, radius, colour)
BARS = [
    (11.0, 36.0, 42.0, 5.5, 2.75, (0xEC, 0xF5, 0xFF)),
    (16.0, 44.5, 32.0, 5.5, 2.75, (0x9E, 0xCB, 0xEB)),
    (21.0, 53.0, 22.0, 5.5, 2.75, (0x56, 0xA0, 0xD3)),
]

BADGE_RADIUS = 16.0                     # the rx on favicon.svg

# The count carries the meaning — Sepucuk Jambi Sembilan Lurah, the nine
# tributaries of the Batanghari. Thickness and fan angle are free to tune;
# the number is not.
assert len(RAY_ANGLES) == 9, "the mark must keep exactly nine rays"


def _rotate(p, deg):
    """Rotate a point about (CX, CY) using SVG's transform convention."""
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    x, y = p[0] - CX, p[1] - CY
    return (CX + x * c - y * s, CY + x * s + y * c)


RAYS = [[_rotate(p, a) for p in RAY] for a in RAY_ANGLES]


def _in_convex(x, y, poly):
    sign = 0
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
        if cross > 0:
            if sign < 0:
                return False
            sign = 1
        elif cross < 0:
            if sign > 0:
                return False
            sign = -1
    return True


def _dist2_to_poly(x, y, poly):
    best = float("inf")
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        seg = dx * dx + dy * dy
        t = 0.0 if seg == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / seg))
        px, py = ax + t * dx - x, ay + t * dy - y
        best = min(best, px * px + py * py)
    return best


def _in_ray(x, y, poly):
    """The wedge plus its stroke: distance to the polygon <= RAY_DILATE."""
    if _in_convex(x, y, poly):
        return True
    return _dist2_to_poly(x, y, poly) <= RAY_DILATE * RAY_DILATE


def _in_round_rect(x, y, rx, ry, w, h, r):
    if x < rx or x > rx + w or y < ry or y > ry + h:
        return False
    dx = max(rx + r - x, 0.0, x - (rx + w - r))
    dy = max(ry + r - y, 0.0, y - (ry + h - r))
    return dx * dx + dy * dy <= r * r


def _in_dome(x, y):
    if y > CY:
        return False
    dx, dy = x - CX, y - CY
    return dx * dx + dy * dy <= DOME_R * DOME_R


def _content_bbox():
    xs, ys = [], []
    for poly in RAYS:
        for px, py in poly:
            xs += [px - RAY_DILATE, px + RAY_DILATE]
            ys += [py - RAY_DILATE, py + RAY_DILATE]
    xs += [CX - DOME_R, CX + DOME_R]
    ys += [CY - DOME_R, CY]
    for bx, by, bw, bh, _r, _c in BARS:
        xs += [bx, bx + bw]
        ys += [by, by + bh]
    return min(xs), min(ys), max(xs), max(ys)


def _content_circumradius(cx, cy):
    """Furthest distance from (cx, cy) to any inked point of the mark.

    Deliberately not the bounding box's circumradius: the box corners are
    empty, and using them shrinks the maskable icon by 22% for nothing.
    """
    best = 0.0
    for poly in RAYS:
        for px, py in poly:
            best = max(best, math.hypot(px - cx, py - cy) + RAY_DILATE)
    best = max(best, math.hypot(CX - cx, CY - cy) + DOME_R)
    for bx, by, bw, bh, r, _c in BARS:
        # A square corner sits slightly outside the rounded one it stands in
        # for. Safe direction, and the gap is under r*(1-1/sqrt2).
        for px in (bx, bx + bw):
            for py in (by, by + bh):
                best = max(best, math.hypot(px - cx, py - cy))
    return best


# Per-shape bounding boxes, used to reject samples cheaply. Most samples land on
# the background, and without this each one walks all 13 shape tests: adding them
# took a full build from 103s to 17s while raising the sample count.
_RAY_BOXES = [(min(p[0] for p in poly) - RAY_DILATE, min(p[1] for p in poly) - RAY_DILATE,
               max(p[0] for p in poly) + RAY_DILATE, max(p[1] for p in poly) + RAY_DILATE)
              for poly in RAYS]
_RAYS_BOX = (min(b[0] for b in _RAY_BOXES), min(b[1] for b in _RAY_BOXES),
             max(b[2] for b in _RAY_BOXES), max(b[3] for b in _RAY_BOXES))
_BARS_BOX = (min(b[0] for b in BARS), min(b[1] for b in BARS),
             max(b[0] + b[2] for b in BARS), max(b[1] + b[3] for b in BARS))
_CONTENT_BOX = (min(_RAYS_BOX[0], _BARS_BOX[0], CX - DOME_R),
                min(_RAYS_BOX[1], _BARS_BOX[1], CY - DOME_R),
                max(_RAYS_BOX[2], _BARS_BOX[2], CX + DOME_R),
                max(_RAYS_BOX[3], _BARS_BOX[3], CY))


def _topmost(u, v):
    """Colour of the topmost shape at (u, v) in mark space, or None if bare."""
    if (u < _CONTENT_BOX[0] or u > _CONTENT_BOX[2]
            or v < _CONTENT_BOX[1] or v > _CONTENT_BOX[3]):
        return None
    if _BARS_BOX[1] <= v <= _BARS_BOX[3]:
        for bx, by, bw, bh, r, col in reversed(BARS):
            if by <= v <= by + bh and bx <= u <= bx + bw:
                if _in_round_rect(u, v, bx, by, bw, bh, r):
                    return col
    if _in_dome(u, v):
        return SUN
    if _RAYS_BOX[1] <= v <= _RAYS_BOX[3] and _RAYS_BOX[0] <= u <= _RAYS_BOX[2]:
        for poly, (x0, y0, x1, y1) in zip(RAYS, _RAY_BOXES):
            if x0 <= u <= x1 and y0 <= v <= y1 and _in_ray(u, v, poly):
                return SUN
    return None


def render(size, badge_radius=BADGE_RADIUS, safe_zone=False, ss=None):
    """Return a size*size*4 RGBA bytearray.

    badge_radius : corner radius of the badge in 64-space units. 0 = full-bleed.
    safe_zone    : shrink the mark to fit the maskable 80% circle.
    """
    # 4x4 subsamples give 16 coverage levels on an edge pixel; 2x2 gives 5, and
    # that staircase shows on the dome's curve once the icon is drawn large.
    if ss is None:
        ss = 8 if size <= 64 else 4

    scale = 1.0
    ox = oy = 0.0
    if safe_zone:
        x0, y0, x1, y1 = _content_bbox()
        ox, oy = (x0 + x1) / 2, (y0 + y1) / 2
        # A maskable icon is only guaranteed to show inside a circle of 80% the
        # canvas width (W3C), so radius 0.40 * 64 in this drawing space.
        scale = (0.40 * 64) / _content_circumradius(ox, oy)

    buf = bytearray(size * size * 4)
    k = 64.0 / size
    inv = 1.0 / scale
    step = 1.0 / ss
    half = step / 2
    nsub = ss * ss

    for py in range(size):
        rowbase = py * size * 4
        for px in range(size):
            r = g = b = 0
            hits = 0
            for sy in range(ss):
                vy = (py + sy * step + half) * k
                for sx in range(ss):
                    vx = (px + sx * step + half) * k
                    if badge_radius > 0:
                        if not _in_round_rect(vx, vy, 0, 0, 64, 64, badge_radius):
                            continue
                    col = INK
                    if safe_zone:
                        u = (vx - 32.0) * inv + ox
                        v = (vy - 32.0) * inv + oy
                    else:
                        u, v = vx, vy
                    top = _topmost(u, v)
                    if top is not None:
                        col = top
                    r += col[0]
                    g += col[1]
                    b += col[2]
                    hits += 1
            o = rowbase + px * 4
            if hits:
                buf[o] = r // hits
                buf[o + 1] = g // hits
                buf[o + 2] = b // hits
                buf[o + 3] = (hits * 255) // nsub
    return buf


def _png(size, rgba):
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)                                   # filter None
        raw += rgba[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b""))


def _ico(pngs):
    """pngs: list of (size, png_bytes). PNG-in-ICO, read by IE11+ and all modern."""
    out = struct.pack("<HHH", 0, 1, len(pngs))
    offset = 6 + 16 * len(pngs)
    entries, blobs = b"", b""
    for size, data in pngs:
        entries += struct.pack("<BBBBHHII",
                               0 if size >= 256 else size,
                               0 if size >= 256 else size,
                               0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    return out + entries + blobs


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(root, "assets"), exist_ok=True)

    def write(path, data):
        full = os.path.join(root, path)
        with open(full, "wb") as fh:
            fh.write(data)
        print("  %-30s %6d bytes" % (path, len(data)))

    print("Building icons from the favicon.svg geometry:")

    ico_parts = [(n, _png(n, render(n, ss=8))) for n in (16, 32, 48)]
    write("favicon.ico", _ico(ico_parts))

    # iOS applies its own squircle mask, so do not round the corners here as
    # well, and ship no alpha at all — iOS renders transparency as black.
    write("apple-touch-icon.png", _png(180, render(180, badge_radius=0)))

    write("assets/icon-192.png", _png(192, render(192)))
    write("assets/icon-512.png", _png(512, render(512)))
    write("assets/icon-maskable-512.png",
          _png(512, render(512, badge_radius=0, safe_zone=True)))

    print("Done. Remember ./scripts/bump-version.sh")


if __name__ == "__main__":
    main()
