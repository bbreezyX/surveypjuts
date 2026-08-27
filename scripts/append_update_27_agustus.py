#!/usr/bin/env python3
"""Append the genuinely new points from the 27 Agustus qgis2web export.

The export contains 508 rows, but this repository already has 471 rows from
the earlier batches.  Ninety-three apparent ID differences are only the
normalised Kota Jambi and Merangin spellings already used by the application.
After matching those aliases, the export contributes 39 new survey points:

* 9 in Lembah Masurai, Merangin
* 30 in Tanjung Jabung Barat

The two Rawasari points added from the Kadis workbook are intentionally kept;
they are not present in the qgis2web export.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from copy import deepcopy
from pathlib import Path

from normalize_attributes import NAMA_FIXES, fix_nomor, photo_filename


EXPECTED_EXISTING = 471
EXPECTED_SOURCE = 508
EXPECTED_NEW = 39
EXPECTED_FINAL = 510

KNOWN_MISSING = {
    "TEBO-TEBO TENGAH-MANGUN JAYO-007",
    "SAROLANGUN-BATANG ASAI-BATU EMPANG-013",
    "SAROLANGUN-BATANG ASAI-BATU EMPANG-014",
    "SAROLANGUN-BATANG ASAI-BATU EMPANG-015",
}


def compose_alamat(desa: str | None, kecamatan: str | None, kabupaten: str | None) -> str:
    desa = (desa or "").strip()
    kecamatan = (kecamatan or "").strip()
    kabupaten = (kabupaten or "").strip()
    lowered = desa.lower()
    if not (
        lowered.startswith("desa ")
        or lowered.startswith("kel. ")
        or lowered.startswith("kelurahan ")
    ):
        desa = f"Desa {desa}"
    return f"{desa}, Kecamatan {kecamatan}, Kabupaten {kabupaten}"


def parse_export_geojson(js_path: Path) -> dict:
    text = js_path.read_text(encoding="utf-8", errors="replace")
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise SystemExit(f"GeoJSON object not found in {js_path}")
    return json.loads(text[start : end + 1])


def transform_feature(feature: dict, fid: int) -> dict:
    props = feature.get("properties") or {}
    source_nomor = str(props.get("Nomor") or "")
    nomor = fix_nomor(source_nomor)

    # Every point introduced by this batch already uses its canonical ID.  If
    # this changes in a later export, stop instead of copying a photo under a
    # filename that no longer matches Foto Survey Awal.
    if nomor != source_nomor:
        raise SystemExit(
            f"New point needs an unplanned ID/photo rename: {source_nomor} -> {nomor}"
        )

    nama = props.get("Nama Anggota")
    return {
        "type": "Feature",
        "properties": {
            # Source fids 470 and 471 collide with the two manually retained
            # Rawasari rows, so the appended rows continue the repository's
            # existing 1..471 sequence instead.
            "fid": str(fid),
            "Nomor": nomor,
            "Nama Anggota": NAMA_FIXES.get(nama, nama),
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
        },
        "geometry": deepcopy(feature.get("geometry")),
    }


def validate_unique(features: list[dict]) -> None:
    nomors = [str((feature.get("properties") or {}).get("Nomor")) for feature in features]
    fids = [str((feature.get("properties") or {}).get("fid")) for feature in features]
    if len(nomors) != len(set(nomors)):
        raise SystemExit("Duplicate Nomor found in merged data")
    if len(fids) != len(set(fids)):
        raise SystemExit("Duplicate fid found in merged data")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--export",
        type=Path,
        default=Path(
            r"C:\Users\distributorkomputer\Downloads\Update 27 Agustus"
            r"\qgis2web_2026_08_27-04_56_23_361324"
        ),
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(r"C:\Users\distributorkomputer\Documents\web-dev\PJUTS 2026"),
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    export_js = args.export / "layers" / "UPDATEPER27JULI2026_4.js"
    export_images = args.export / "images"
    points_path = args.repo / "data" / "points.geojson"
    repo_images = args.repo / "images"

    for path in (export_js, export_images, points_path, repo_images):
        if not path.exists():
            raise SystemExit(f"Missing input: {path}")

    current = json.loads(points_path.read_text(encoding="utf-8"))
    source = parse_export_geojson(export_js)
    old_features = current.get("features") or []
    source_features = source.get("features") or []

    if len(source_features) != EXPECTED_SOURCE:
        raise SystemExit(
            f"Expected {EXPECTED_SOURCE} source features, got {len(source_features)}"
        )
    if len(old_features) not in (EXPECTED_EXISTING, EXPECTED_FINAL):
        raise SystemExit(
            f"Expected {EXPECTED_EXISTING} or {EXPECTED_FINAL} repository features, "
            f"got {len(old_features)}"
        )

    old_snapshot = deepcopy(old_features)
    current_nomors = {
        str((feature.get("properties") or {}).get("Nomor")) for feature in old_features
    }
    max_fid = max(int((feature.get("properties") or {}).get("fid")) for feature in old_features)

    unseen_source = []
    for feature in source_features:
        source_nomor = str((feature.get("properties") or {}).get("Nomor") or "")
        if fix_nomor(source_nomor) not in current_nomors:
            unseen_source.append(feature)

    if len(old_features) == EXPECTED_FINAL:
        if unseen_source:
            raise SystemExit(
                f"Repository has {EXPECTED_FINAL} rows but still misses {len(unseen_source)} source rows"
            )
        print("Already up to date: 510 points")
        return 0

    if len(unseen_source) != EXPECTED_NEW:
        raise SystemExit(f"Expected {EXPECTED_NEW} new source features, got {len(unseen_source)}")

    appended = [
        transform_feature(feature, max_fid + index)
        for index, feature in enumerate(unseen_source, start=1)
    ]
    merged_features = old_features + appended
    if len(merged_features) != EXPECTED_FINAL:
        raise SystemExit(f"Expected {EXPECTED_FINAL} merged features, got {len(merged_features)}")
    validate_unique(merged_features)

    copies: list[tuple[Path, Path]] = []
    for feature in appended:
        props = feature["properties"]
        image_name = photo_filename(props["Foto Survey Awal"])
        source_image = export_images / image_name
        destination = repo_images / image_name
        if not source_image.is_file():
            raise SystemExit(f"Missing source photo for {props['Nomor']}: {source_image}")
        if destination.exists():
            if not destination.is_file() or source_image.read_bytes() != destination.read_bytes():
                raise SystemExit(f"Conflicting destination photo: {destination}")
        else:
            copies.append((source_image, destination))

    by_area: dict[str, int] = {}
    for feature in appended:
        alamat = feature["properties"]["Alamat"]
        area = alamat.rsplit(", ", 1)[-1]
        by_area[area] = by_area.get(area, 0) + 1

    print(f"existing: {len(old_features)}")
    print(f"append:   {len(appended)}")
    print(f"final:    {len(merged_features)}")
    for area, count in sorted(by_area.items()):
        print(f"  {area}: {count}")
    print(f"photos:   {len(appended) - len(copies)} already present, {len(copies)} to copy")

    if args.dry_run:
        print("dry-run: nothing written")
        return 0

    for source_image, destination in copies:
        shutil.copy2(source_image, destination)

    merged = {
        "type": "FeatureCollection",
        "name": current.get("name", "points"),
        "features": merged_features,
    }
    if "crs" in current:
        merged["crs"] = current["crs"]

    temporary = points_path.with_suffix(".geojson.tmp")
    try:
        temporary.write_text(
            json.dumps(merged, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
            newline="\n",
        )
        os.replace(temporary, points_path)
    finally:
        if temporary.exists():
            temporary.unlink()

    written = json.loads(points_path.read_text(encoding="utf-8"))
    written_features = written.get("features") or []
    if written_features[:EXPECTED_EXISTING] != old_snapshot:
        raise SystemExit("Existing 471 features changed during append")
    validate_unique(written_features)

    missing = []
    for feature in written_features:
        props = feature.get("properties") or {}
        if not (repo_images / photo_filename(props.get("Foto Survey Awal"))).is_file():
            missing.append(str(props.get("Nomor")))
    if set(missing) != KNOWN_MISSING:
        raise SystemExit(f"Unexpected missing-photo set: {sorted(missing)}")

    print(f"photo coverage: {len(written_features) - len(missing)}/{len(written_features)}")
    print(f"known missing:  {len(missing)} pre-existing points")
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
