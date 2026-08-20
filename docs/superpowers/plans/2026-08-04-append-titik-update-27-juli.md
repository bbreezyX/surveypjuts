# Append Titik UPDATE 27 Juli 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append 105 new survey points (and their photos) from the 27 Juli 2026 qgis2web export into the existing atlas without changing UI or boundary layers.

**Architecture:** One-shot Python merge script transforms export features into the existing `points.geojson` schema (`Alamat` + `Foto Survey Awal`), appends only Nomor-not-present features, copies matching image files, and bumps the geojson cache query string.

**Tech Stack:** Python 3 stdlib (`json`, `pathlib`, `shutil`, `re`), existing OpenLayers + `custom.js` (unchanged).

## Global Constraints

- Append only — never mutate the 230 existing features
- Keep schema: `Alamat`, `Foto Survey Awal` (not kab/kec/desa split)
- Do not edit `custom.js`, boundary layer JS, or HTML/CSS
- Source export path: `/Users/dany/Downloads/qgis2web_2026_08_04-13_23_55_138831`
- Match key: `Nomor` (string)
- Expected result: 335 features, +105 images

---

### Task 1: Merge script + run append

**Files:**
- Create: `scripts/append_update_27_juli.py`
- Modify: `data/points.geojson`
- Modify: `images/*` (+105 jpg)
- Modify: `layers/layers.js` (cache bust `?v=`)

**Interfaces:**
- Consumes: export `UPDATEPER27JULI2026_4.js`, existing `data/points.geojson`, export `images/`
- Produces: updated geojson (335 features), 105 new image files, bumped `?v=20260804`

- [x] **Step 1: Write `scripts/append_update_27_juli.py`**

Script must:

1. Parse GeoJSON object from the export JS file (slice first `{` to last `}`).
2. Load existing `data/points.geojson`.
3. Snapshot the 230 existing features (deep copy) for post-write equality check.
4. For each export feature whose `Nomor` is not in existing:
   - Compose `Alamat` per spec §4.1
   - Map properties to existing schema
   - Append feature with original geometry
5. Write `data/points.geojson` as a FeatureCollection (compact JSON is fine; match readability of current file if easy).
6. For each new feature, `sanitize` photo path (`\/:` → `_`) and copy that file from export `images/` to repo `images/` if missing.
7. Replace `points.geojson?v=…` in `layers/layers.js` with `?v=20260804`.
8. Print summary counts and fail (non-zero exit) if counts ≠ 105 new / 335 total or any photo missing.

`compose_alamat(desa, kec, kab)` rules:

```python
import re

def compose_alamat(desa, kec, kab):
    desa = (desa or "").strip()
    kec = (kec or "").strip()
    kab = (kab or "").strip()
    if not re.match(r"^(desa|kel\.?|kelurahan)\b", desa, re.I):
        desa = f"Desa {desa}"
    return f"{desa}, Kecamatan {kec}, Kabupaten {kab}"
```

- [x] **Step 2: Run the script**

```bash
python3 scripts/append_update_27_juli.py \
  --export "/Users/dany/Downloads/qgis2web_2026_08_04-13_23_55_138831" \
  --repo "/Users/dany/WEB-DEV/surveypjuts"
```

- [x] **Step 3: Verify**

```bash
python3 - <<'PY'
# assert 335 features, 335 unique Nomor, 230 old deep-equal, 105 new photos exist
PY
```

Expected: all asserts pass; `layers/layers.js` contains `points.geojson?v=20260804`.

- [x] **Step 4: Commit**

```bash
git add data/points.geojson images/ layers/layers.js scripts/append_update_27_juli.py
git commit -m "$(cat <<'EOF'
Append 105 PUTS survey points from 27 Juli 2026 update.

EOF
)"
```

---

## Done when

- [x] Spec approved  
- [x] 335 points in `data/points.geojson`  
- [x] 105 new photos in `images/`  
- [x] Cache bust updated  
- [x] 230 old points unchanged  
- [x] Commit created (push separately if requested)
