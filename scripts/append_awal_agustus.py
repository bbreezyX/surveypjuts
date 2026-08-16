#!/usr/bin/env python3
"""Append the 16 Agustus 2026 batch into points.geojson.

Two sources:
  1. qgis2web export UPDATEPER27JULI2026_4.js — a superset of the current 335
     points, so only the 134 unseen Nomor are appended.
  2. "PJUTS 2026 - Survey Kota Jambi ... Kadis ESDM.xlsx" — supplies the 2
     Rawasari points the QGIS export dropped entirely, plus the photos for the
     6 Telanaipura points whose Foto path in the export has a typo
     ("Surya 202" instead of "Surya 2026") that stopped qgis2web from copying
     them.

The Telanaipura photo filenames follow the xlsx numbering, which runs opposite
to the export numbering, so the mapping is derived by matching coordinates and
then asserted against the hand-verified table rather than trusted blindly.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from copy import deepcopy
from pathlib import Path

import openpyxl

FOTO_PREFIX = "D:/011. ESDM/Penerangan Jalan Umum Tenaga Surya 2026/2026/03. Foto"

# Verified against the Timemark stamp burned into each photo (label "Nama" and
# coordinates): export point 001 is the file named 007, and so on.
TELANAIPURA_EXPECTED = {
    "JAMBI-TELANAIPURA-TELANAIPURA-001": "JAMBI-TELANAIPURA-TELANAIPURA-007.png",
    "JAMBI-TELANAIPURA-TELANAIPURA-002": "JAMBI-TELANAIPURA-TELANAIPURA-005.png",
    "JAMBI-TELANAIPURA-TELANAIPURA-003": "JAMBI-TELANAIPURA-TELANAIPURA-004.png",
    "JAMBI-TELANAIPURA-TELANAIPURA-004": "JAMBI-TELANAIPURA-TELANAIPURA-003.png",
    "JAMBI-TELANAIPURA-TELANAIPURA-005": "JAMBI-TELANAIPURA-TELANAIPURA-002.png",
    "JAMBI-TELANAIPURA-TELANAIPURA-006": "JAMBI-TELANAIPURA-TELANAIPURA-001.png",
}

# The QGIS export never received these; they come straight from the xlsx.
# The export already carries JAMBI-KOTA BARU-RAWA SARI-001..010 on the same
# street, so these continue that numbering and spelling instead of introducing
# a second spelling of the same kelurahan. Numbered by position along the line:
# 011 is the closer one to RAWA SARI-001 (49 m), 012 the farther (60 m).
RAWASARI = [
    {
        "nomor": "JAMBI-KOTA BARU-RAWA SARI-011",
        "src": "JAMBI-KOTABARU-RAWASARI-001.png",
        "lon": 103.56784,
        "lat": -1.62021,
    },
    {
        "nomor": "JAMBI-KOTA BARU-RAWA SARI-012",
        "src": "JAMBI-KOTABARU-RAWASARI-002.png",
        "lon": 103.56772,
        "lat": -1.6202,
    },
]

# Photos already known missing from every source before this batch.
KNOWN_MISSING = {
    "TEBO-TEBO TENGAH-MANGUN JAYO-007",
    "SAROLANGUN-BATANG ASAI-BATU EMPANG-013",
    "SAROLANGUN-BATANG ASAI-BATU EMPANG-014",
    "SAROLANGUN-BATANG ASAI-BATU EMPANG-015",
}


def compose_alamat(desa: str | None, kec: str | None, kab: str | None) -> str:
    desa = (desa or "").strip()
    kec = (kec or "").strip()
    kab = (kab or "").strip()
    if not re.match(r"^(desa|kel\.?|kelurahan)\b", desa, re.I):
        desa = f"Desa {desa}"
    return f"{desa}, Kecamatan {kec}, Kabupaten {kab}"


def sanitize_media_path(value: str) -> str:
    return re.sub(r"[\\/:]", "_", str(value or "")).strip()


def parse_export_geojson(js_path: Path) -> dict:
    text = js_path.read_text(encoding="utf-8", errors="replace")
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise SystemExit(f"Could not find GeoJSON object in {js_path}")
    return json.loads(text[start : end + 1])


def transform_feature(feature: dict) -> dict:
    props = feature.get("properties") or {}
    new_props = {
        "fid": props.get("fid"),
        "Nomor": props.get("Nomor"),
        "Nama Anggota": props.get("Nama Anggota"),
        "Alamat": compose_alamat(
            props.get("Desa/Kelurahan"),
            props.get("Kecamatan"),
            props.get("Kabupaten/Kota"),
        ),
        "Longitude": props.get("Longitude"),
        "Latitude": props.get("Latitude"),
        "Tanggal Dokumentasi": props.get("Tanggal Dokumentasi"),
        "Keterangan": props.get("Keterangan"),
        "Foto Survey Awal": props.get("Foto"),
    }
    return {
        "type": "Feature",
        "properties": new_props,
        "geometry": deepcopy(feature.get("geometry")),
    }


def build_rawasari_feature(spec: dict, fid: int) -> dict:
    return {
        "type": "Feature",
        "properties": {
            "fid": str(fid),
            "Nomor": spec["nomor"],
            # The xlsx says "Gubernur Jambi"; the atlas groups by this string
            # and every other point from this proposer says "Gubernur".
            "Nama Anggota": "Gubernur",
            "Alamat": compose_alamat("Rawa Sari", "Kota Baru", "Jambi"),
            "Longitude": spec["lon"],
            "Latitude": spec["lat"],
            "Tanggal Dokumentasi": "25/06/2026",
            "Keterangan": None,
            "Foto Survey Awal": f"{FOTO_PREFIX}/{spec['nomor']}.png",
        },
        "geometry": {"type": "Point", "coordinates": [spec["lon"], spec["lat"]]},
    }


def resolve_telanaipura_photos(xlsx_path: Path, export_by_nomor: dict) -> dict[str, str]:
    """Map export Nomor -> source PNG filename by matching coordinates."""
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["Data Bersih"]
    by_coord: dict[tuple[float, float], str] = {}
    for nomor, _nama, _alamat, lon, lat, *_rest in ws.iter_rows(min_row=2, values_only=True):
        if nomor and "TELANAIPURA-TELANAIPURA" in str(nomor):
            by_coord[(round(float(lon), 5), round(float(lat), 5))] = f"{nomor}.png"

    mapping: dict[str, str] = {}
    for nomor in TELANAIPURA_EXPECTED:
        feature = export_by_nomor[nomor]
        lon, lat = feature["geometry"]["coordinates"]
        key = (round(float(lon), 5), round(float(lat), 5))
        if key not in by_coord:
            raise SystemExit(f"No xlsx row matches {nomor} at {key}")
        mapping[nomor] = by_coord[key]

    if mapping != TELANAIPURA_EXPECTED:
        raise SystemExit(
            "Coordinate-derived photo mapping disagrees with the verified table:\n"
            f"  derived : {mapping}\n"
            f"  expected: {TELANAIPURA_EXPECTED}"
        )
    return mapping


def bump_cache(layers_js: Path, version: str) -> None:
    text = layers_js.read_text(encoding="utf-8")
    updated, n = re.subn(
        r"(points\.geojson\?v=)[0-9A-Za-z._-]+",
        rf"\g<1>{version}",
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"Failed to bump cache query in {layers_js}")
    layers_js.write_text(updated, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--export",
        type=Path,
        default=Path(
            r"C:\Users\distributorkomputer\Downloads\update awal agustus"
            r"\qgis2web_2026_08_16-20_43_14_743727"
        ),
    )
    parser.add_argument(
        "--kadis",
        type=Path,
        default=Path(r"C:\Users\distributorkomputer\Downloads\PJUTS - Kadis"),
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(r"C:\Users\distributorkomputer\Documents\web-dev\PJUTS 2026"),
    )
    parser.add_argument("--cache-version", default="20260816")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    export_js = args.export / "layers" / "UPDATEPER27JULI2026_4.js"
    export_images = args.export / "images"
    kadis_images = args.kadis / "Foto"
    kadis_xlsx = args.kadis / "PJUTS 2026 - Survey Kota Jambi 20-26 Jun 2026 - Kadis ESDM.xlsx"
    points_path = args.repo / "data" / "points.geojson"
    repo_images = args.repo / "images"
    layers_js = args.repo / "layers" / "layers.js"

    for path in (export_js, kadis_xlsx, points_path):
        if not path.is_file():
            raise SystemExit(f"Missing input: {path}")

    existing = json.loads(points_path.read_text(encoding="utf-8"))
    old_features = existing.get("features") or []
    old_snapshot = deepcopy(old_features)
    old_nomors = {(f.get("properties") or {}).get("Nomor") for f in old_features}
    if len(old_features) != 335:
        raise SystemExit(f"Expected 335 existing features, got {len(old_features)}")

    export = parse_export_geojson(export_js)
    export_features = export.get("features") or []
    export_by_nomor = {
        (f.get("properties") or {}).get("Nomor"): f for f in export_features
    }
    if len(export_features) != 469:
        raise SystemExit(f"Expected 469 export features, got {len(export_features)}")

    photo_map = resolve_telanaipura_photos(kadis_xlsx, export_by_nomor)

    new_features: list[dict] = []
    for feature in export_features:
        nomor = (feature.get("properties") or {}).get("Nomor")
        if nomor in old_nomors:
            continue
        transformed = transform_feature(feature)
        if nomor in photo_map:
            # The export's own path has the "Surya 202" typo and a .jpg
            # extension for files that are actually .png.
            transformed["properties"]["Foto Survey Awal"] = f"{FOTO_PREFIX}/{nomor}.png"
        new_features.append(transformed)

    if len(new_features) != 134:
        raise SystemExit(f"Expected 134 new export features, got {len(new_features)}")

    next_fid = len(old_features) + len(new_features) + 1
    rawasari_features = [
        build_rawasari_feature(spec, next_fid + i) for i, spec in enumerate(RAWASARI)
    ]
    rawasari_src = {spec["nomor"]: spec["src"] for spec in RAWASARI}
    for feature in rawasari_features:
        if feature["properties"]["Nomor"] in old_nomors:
            raise SystemExit(f"Rawasari point already present: {feature['properties']['Nomor']}")

    appended = new_features + rawasari_features
    total = len(old_features) + len(appended)
    print(f"existing: {len(old_features)}")
    print(f"append:   {len(new_features)} (export) + {len(rawasari_features)} (xlsx) = {len(appended)}")
    print(f"total:    {total}")

    # Resolve every photo source before writing anything.
    copies: list[tuple[Path, Path]] = []
    unresolved: list[str] = []
    for feature in appended:
        props = feature["properties"]
        nomor = props["Nomor"]
        dst_name = sanitize_media_path(props["Foto Survey Awal"])
        if not dst_name:
            unresolved.append(f"{nomor}: empty Foto")
            continue
        if nomor in photo_map:
            src = kadis_images / photo_map[nomor]
        elif nomor in rawasari_src:
            src = kadis_images / rawasari_src[nomor]
        else:
            src = export_images / dst_name
        if not src.is_file():
            unresolved.append(f"{nomor}: {src}")
            continue
        copies.append((src, repo_images / dst_name))

    if unresolved:
        raise SystemExit(
            f"Unresolved photos ({len(unresolved)}):\n  " + "\n  ".join(unresolved[:10])
        )
    print(f"photos resolved: {len(copies)}/{len(appended)}")

    if args.dry_run:
        print("\ndry-run: nothing written")
        return 0

    merged = {
        "type": "FeatureCollection",
        "name": existing.get("name", "points"),
        "features": old_features + appended,
    }
    if "crs" in existing:
        merged["crs"] = existing["crs"]

    points_path.write_text(
        json.dumps(merged, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    written = json.loads(points_path.read_text(encoding="utf-8"))
    if written["features"][: len(old_snapshot)] != old_snapshot:
        raise SystemExit("Old features changed after write")
    if len(written["features"]) != total:
        raise SystemExit(f"Expected {total} total after write, got {len(written['features'])}")

    copied = skipped = 0
    for src, dst in copies:
        if dst.exists():
            skipped += 1
            continue
        shutil.copy2(src, dst)
        copied += 1

    still_missing = [
        f["properties"]["Nomor"]
        for f in written["features"]
        if not (repo_images / sanitize_media_path(f["properties"]["Foto Survey Awal"])).is_file()
    ]
    unexpected = set(still_missing) - KNOWN_MISSING
    if unexpected:
        raise SystemExit(f"Unexpected missing photos: {sorted(unexpected)}")

    bump_cache(layers_js, args.cache_version)

    print("\nOK")
    print(f"  photos copied:  {copied} (already present: {skipped})")
    print(f"  photo coverage: {total - len(still_missing)}/{total}")
    print(f"  known missing:  {len(still_missing)} (pre-existing, no source available)")
    print(f"  cache:          ?v={args.cache_version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
