#!/usr/bin/env python3
"""Append new points from qgis2web UPDATE PER 27 JULI 2026 into points.geojson."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from copy import deepcopy
from pathlib import Path


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
        default=Path("/Users/dany/Downloads/qgis2web_2026_08_04-13_23_55_138831"),
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path("/Users/dany/WEB-DEV/surveypjuts"),
    )
    parser.add_argument("--cache-version", default="20260804")
    args = parser.parse_args()

    export_js = args.export / "layers" / "UPDATEPER27JULI2026_4.js"
    export_images = args.export / "images"
    points_path = args.repo / "data" / "points.geojson"
    repo_images = args.repo / "images"
    layers_js = args.repo / "layers" / "layers.js"

    if not export_js.is_file():
        raise SystemExit(f"Missing export layer: {export_js}")
    if not points_path.is_file():
        raise SystemExit(f"Missing points file: {points_path}")

    existing = json.loads(points_path.read_text(encoding="utf-8"))
    export = parse_export_geojson(export_js)

    old_features = existing.get("features") or []
    old_snapshot = deepcopy(old_features)
    old_nomors = {
        (f.get("properties") or {}).get("Nomor") for f in old_features
    }

    new_features: list[dict] = []
    for feature in export.get("features") or []:
        nomor = (feature.get("properties") or {}).get("Nomor")
        if nomor in old_nomors:
            continue
        new_features.append(transform_feature(feature))

    if len(old_features) != 230:
        raise SystemExit(f"Expected 230 existing features, got {len(old_features)}")
    if len(new_features) != 105:
        raise SystemExit(f"Expected 105 new features, got {len(new_features)}")

    merged = {
        "type": "FeatureCollection",
        "name": existing.get("name", "points"),
        "crs": existing.get("crs"),
        "features": old_features + new_features,
    }
    # Drop crs key if it was absent
    if "crs" not in existing:
        merged.pop("crs", None)

    points_path.write_text(
        json.dumps(merged, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Verify old features untouched
    written = json.loads(points_path.read_text(encoding="utf-8"))
    if written["features"][:230] != old_snapshot:
        raise SystemExit("Old features changed after write — aborting mentally (file already written)")
    if len(written["features"]) != 335:
        raise SystemExit(f"Expected 335 total after write, got {len(written['features'])}")

    copied = 0
    missing: list[str] = []
    for feature in new_features:
        photo = (feature.get("properties") or {}).get("Foto Survey Awal") or ""
        name = sanitize_media_path(photo)
        if not name:
            missing.append(str((feature.get("properties") or {}).get("Nomor")))
            continue
        src = export_images / name
        dst = repo_images / name
        if not src.is_file():
            missing.append(name)
            continue
        if not dst.exists():
            shutil.copy2(src, dst)
            copied += 1
        elif not dst.is_file():
            missing.append(name)

    if missing:
        raise SystemExit(f"Missing photos ({len(missing)}): {missing[:5]}")

    bump_cache(layers_js, args.cache_version)

    print("OK")
    print(f"  existing kept: {len(old_features)}")
    print(f"  appended:      {len(new_features)}")
    print(f"  total:         {len(written['features'])}")
    print(f"  photos copied: {copied}")
    print(f"  cache:         ?v={args.cache_version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
