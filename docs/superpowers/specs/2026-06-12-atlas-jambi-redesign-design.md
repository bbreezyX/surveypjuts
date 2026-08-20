# Atlas Jambi — Complete UI/UX Redesign (ESDM Tokens)

Date: 2026-06-12
Status: Approved direction, pending spec review

## Context & Goals

The PUTS 2026 map (qgis2web/OpenLayers static app, served by Caddy) currently wears the
"Solar Amber" theme: light surfaces, navy text, amber accents, a 40px padded grid frame
around sidebar + map. The owner wants a complete visual overhaul.

- **Primary audience:** officials and presentations — projectors and large screens in
  rapat rooms. The design must be authoritative and legible from across a room.
- **Branding requirement:** official identity. Lambang Provinsi Jambi displayed; palette
  and typography taken from the official ESDM site (esdm.go.id).
- **Chosen direction:** "Atlas Jambi" — map-first, full-bleed satellite imagery with
  floating panels, reskinned with official ESDM design tokens.

## Design Tokens

Extracted from `esdm.go.id/themes/v2/css/style.css` + `custom.css` on 2026-06-12:

| Token | Value | Usage |
|---|---|---|
| `--ink` | `#293D50` | Headings, body text, dark fills, pin outlines |
| `--blue` | `#0072BC` | Primary accent: icons, group counts, focus rings |
| `--blue-deep` | `#00458F` | Kickers, small text accents, pressed states |
| `--yellow` | `#FEE50F` | Pins, tab underlines, highlight chips. **Never as text on light surfaces** — always navy text on yellow fills (ESDM's own CTA pattern) |
| `--blue-tint` | `#ECF5FF` | Hover and selected-item fills |
| `--hairline` | `#D6EAFF` / `#C9D6E2` | Borders and dividers on white |
| `--muted` | `#5A6B7D` | Secondary text (AA on white) |
| `--muted-2` | `#7E8FA0` | Placeholders and metadata |
| Surfaces | `#FFFFFF`, `rgba(255,255,255,0.96)` | Floating panels, slightly translucent over map |

**Typography:** Montserrat 500/600/700 (masthead title, point titles, numbers, tabs,
kickers) + Work Sans 400/500 (all other UI text). Both via Google Fonts — the same
families esdm.go.id loads. Newsreader and Source Sans 3 are removed.

## Layout — Desktop (≥960px)

Full-bleed map, edge to edge. The current padded `.app-shell` grid frame is removed.
Three floating layers sit on the map:

1. **Masthead chip** (top-left): lambang Provinsi Jambi, hairline divider, then kicker
   "PEMPROV JAMBI · DINAS ESDM" (Montserrat 600, letterspaced, `--blue-deep`) over the
   title "Atlas PUTS 2026" (Montserrat 700, `--ink`).
2. **Data panel** (below masthead, left edge): width clamp(330px–380px), translucent
   white, 12px radius. Top to bottom:
   - Stats strip: titik count in a yellow chip with navy text; pengusul and kab/kota
     counts in plain navy. Labels in `--muted`. Numbers in Montserrat 700.
   - Search field (existing debounced search, restyled).
   - Underline tabs replacing the filled segmented control: "Pengusul" | "Kabupaten",
     active = navy text + 2px yellow underline.
   - Accordion group list (existing behavior): group rows show chevron, name, count in
     blue Montserrat; items show a status dot (yellow w/ navy border = active,
     gray otherwise), primary name, muted location subline. Active item fill `--blue-tint`.
   - Footer note ("Sumber: survey lapangan 2026").
   The panel is collapsible to give a clean full-map presentation view; collapse toggle
   stays available on screen when collapsed.
3. **Map furniture** (right side): layer-switcher chip top-right, zoom buttons and scale
   bar bottom-right — all restyled as white chips with hairline borders.

**Point popup (desktop):** stays an anchored OpenLayers overlay at the pin. Restyled as
a white card: photo on top (lazy-loaded, with "Foto survey awal" badge), kicker
"TITIK NNN · KECAMATAN" in `--blue-deep`, title in Montserrat 700 navy, meta rows
(pengusul, alamat, tanggal dokumentasi) with `--blue` Tabler-style icons and hairline
separators, closed by a short yellow rule. Close button floats on the photo corner.

## Layout — Mobile (<960px)

- **Bottom sheet** replaces the slide-in side panel and the "Data PUTS" edge toggle.
  Peek state: grab handle + stats strip + search (~150px). Expanded state: full group
  list at ~85dvh. Tap-to-toggle only (handle tap switches states; no drag physics in
  this iteration); backdrop tap and Escape close it. Existing `is-panel-open` body-class mechanics are
  adapted to drive sheet states.
- **Compact masthead chip** top-left and layer chip top-right.
- **Point popup: bottom-docked card** (replaces this week's top-anchored-above-pin
  behavior — approved decision). When a pin is tapped, the popup docks at the bottom of
  the viewport and the map auto-pans the pin into the upper half. Zoom buttons stay
  hidden while a popup is open (existing behavior preserved).

## Map Symbology

- **Pins:** yellow `#FEE50F` fill with navy `#293D50` outline (replacing red). Selected
  pin: enlarged with a white ring. Defined in `styles/260331_4_style.js`.
- **Kabupaten boundaries:** white lines and white labels, both unchanged (OpenLayers
  canvas text does not support letterspacing; the existing label style already reads well).
- Kabupaten zoom-to-region filter behavior unchanged.

## Functionality — Explicitly Unchanged

Grouping by pengusul/kabupaten (spatial join), debounced search, "Lihat semua" fit-all,
layer switcher toggles, photo popups, stat counts, kabupaten map filtering. All current
behavior is preserved; this redesign changes presentation and the panel/sheet/popup
interaction mechanics only.

## Implementation Scope

| File | Change |
|---|---|
| `index.html` | New font links (Montserrat, Work Sans), DOM restructure (masthead, panel, bottom sheet), keep script load order and all element IDs used by JS |
| `custom.css` | Full rewrite on the new token system |
| `custom.js` | Keep all data/grouping/search/popup logic and element IDs. Modify: panel→bottom-sheet behavior, mobile popup docking (replace top-anchor offset math), popup HTML template (icons/structure) |
| `styles/260331_4_style.js` | Pin color red → yellow/navy, selected style |
| `assets/` (new) | Official Lambang Provinsi Jambi from Wikimedia Commons (user may substitute an official file) |
| Cache busting | Bump `?v=` query strings on changed assets |

Untouched: data pipeline (`data/points.geojson`), layer files, qgis2web internals,
Caddyfile/Dockerfile, photos.

## Accessibility & Verification

- AA contrast on every text/background pair; yellow never used as text.
- Visible focus rings (blue) on all interactive elements; `aria-expanded` maintained on
  sheet, panel toggle, and accordion groups; touch targets ≥40px on mobile.
- Visual verification in-browser at 1440, 1024, 768, 390, and 360px widths
  (portrait + landscape spot-check) — these breakpoints have caused regressions before.
- Re-verify popup measurement/positioning logic after the restyle (custom.js measures
  popup height; the mobile rework replaces that path).
- Presentation check: collapsed-panel full-map view on a large display.

## Out of Scope

No data pipeline changes, no new features, no backend, no offline support, no print
styles.
