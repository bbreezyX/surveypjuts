#!/usr/bin/env python3
"""Round geometry coordinates to 6 decimal places (~11 cm).

QGIS exports coordinates with ~15 decimal places, which is sub-micrometre
precision for data whose real accuracy is metres. Those digits are pure payload:
trimming them cut layers/BatasKabupaten2011_1.js from 222 KB to 97 KB gzipped
with a maximum geometric deviation of 0.0 m.

Only geometry is touched. Feature properties are left alone — the popup prints
its "Koordinat" row from the Longitude/Latitude properties, not the geometry.

Run after any QGIS re-export of the boundary layers, otherwise the
full-precision coordinates come back:

    ./scripts/trim_coord_precision.py
"""

import io
import json
import os
import sys

PRECISION = 6

# (path, prefix to preserve before the JSON payload)
#
# data/points.geojson is deliberately NOT here. QGIS already exported it at 4
# decimals, so trimming saved 0 KB while nudging 8 of the 471 surveyed points by
# up to 5 cm. No gain, so leave the survey coordinates alone.
TARGETS = [
    ("layers/BatasKabupaten2011_1.js", "var json_BatasKabupaten2011_1 = "),
    ("data/dissolved.geojson", ""),
]


def round_coords(node):
    """Recursively round a GeoJSON coordinates array in place."""
    if isinstance(node[0], (int, float)):
        return [round(v, PRECISION) for v in node]
    return [round_coords(child) for child in node]


def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    total_before = total_after = 0

    for rel_path, prefix in TARGETS:
        path = os.path.join(root, rel_path)
        if not os.path.exists(path):
            print("skip (missing): %s" % rel_path)
            continue

        raw = io.open(path, encoding="utf-8").read()
        before = len(raw.encode("utf-8"))

        payload = raw[len(prefix):].strip().rstrip(";") if prefix else raw
        data = json.loads(payload)

        for feature in data["features"]:
            geometry = feature.get("geometry")
            if geometry and geometry.get("coordinates"):
                geometry["coordinates"] = round_coords(geometry["coordinates"])

        out = prefix + json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        if prefix:
            out += ";"
        io.open(path, "w", encoding="utf-8", newline="\n").write(out)

        after = len(out.encode("utf-8"))
        total_before += before
        total_after += after
        print("%-38s %6d KB -> %6d KB" % (rel_path, before // 1024, after // 1024))

    if total_before:
        saved = 100 * (total_before - total_after) / total_before
        print("total %d KB -> %d KB (-%.0f%%)"
              % (total_before // 1024, total_after // 1024, saved))
    return 0


if __name__ == "__main__":
    sys.exit(main())
