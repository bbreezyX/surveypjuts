# Favicon — an ESDM-themed mark, and the icon set around it

Date: 2026-08-18
Trigger: request for a new favicon on an "energy" theme, redirected mid-way to
"lebih ke ESDM, ada elemen filosofinya" — closer to ESDM, with real symbolism.
Then extended to cover every device.

## What was wrong with the old favicon

`favicon.svg` drew a street lamp: an amber circle, a cream pole, on `#1f2a2b`.
Two faults.

1. **Off-palette.** Amber `#f0b44f` / cream `#fbf7ef` / `#1f2a2b` appear nowhere
   in `custom.css`. The site tokens are `--ink #293d50`, `--blue #0072bc`,
   `--yellow #fee50f`, and `#293d50` is also the `theme-color`. The favicon was
   the only thing on the page outside the colour system.
2. **It failed at 16px.** A 5-unit pole on a 64 viewBox lands at ~1.2px. What
   reached the tab bar was a dark blob with an orange dot — not a lamp, and not
   an identity.

## The mark

A solar dome with nine rays, above three earth layers, in a `#293d50` rounded
badge.

## Symbolism

Every element has a source. Nothing is ornament.

| Element | Source | Meaning |
|---|---|---|
| Sun dome | Api semangat / bintang sinergi, Kementerian ESDM logo | Solar energy — what this map is a map of. The **E** in ESDM. |
| Nine rays | Jambi provincial emblem, "Sepucuk Jambi Sembilan Lurah" | The nine lurah: nine tributaries of the Batanghari; the unity of the province. |
| Three earth layers | "Tiga lapisan bumi", an official element of the Kementerian ESDM logo | Mineral resources and sustainable management. The **SDM** half. |
| Blue and yellow | Dominant colours of the Jambi emblem (`#01cafe`, `#ffff00`) | Already aligned with the site's `--blue`/`--yellow`. |

Read top to bottom it spells the agency: energy above, mineral resources below.

## The constraints that shaped it

A favicon is judged at 16px, not at hero size. Three rules bound the drawing.

1. **Nine is not negotiable.** The count is the meaning. Only thickness, length
   and fan angle were free to tune.
2. **Detail must merge, not vanish.** The rays are solid wedges rather than
   strokes, so at 16px the nine fuse into one dense crown. A first attempt with
   thin wedges left a fringe of fuzz; shortening and fattening them fixed it.
3. **Three depth steps, no more.** Layers run `#ecf5ff` → `#9ecbeb` → `#56a0d3`.
   The deepest deliberately avoids `--blue #0072bc`: against `#293d50` that is
   only ~2.1:1 and the third layer disappears when small. `#56a0d3` gives ~3.9:1
   and survives.

Concepts tried and dropped: an eight-ray solar burst (stroke rays died at 16px),
a PJU lamp post with rays (too many parts), and a blencong — the wayang lamp that
is an official ESDM element. The blencong was tempting because it is a lamp, like
PUTS itself, but its silhouette is too particular to survive simplification to
16px; what came out read as a laboratory beaker.

## Cross-device coverage

An SVG alone is not enough: iOS will not use one for a home-screen icon, and
Android takes its icons from the manifest.

| Client | File |
|---|---|
| Chrome / Firefox / Edge / Safari (tab) | `favicon.svg` |
| Browsers without SVG support, crawlers, feed readers | `favicon.ico` (16/32/48) |
| iOS — Add to Home Screen | `apple-touch-icon.png` 180 |
| Android — Chrome, PWA install | `assets/icon-192.png`, `assets/icon-512.png` |
| Android shaped launchers (circle, squircle) | `assets/icon-maskable-512.png` |

`favicon.ico` and `apple-touch-icon.png` **must sit at the root**: many clients
request `/favicon.ico` and `/apple-touch-icon.png` without reading any HTML.

The `<link>` order in `index.html` follows the settled pattern — `.ico` first
with `sizes="32x32"`, then `.svg` with `type="image/svg+xml"`, so modern browsers
take the SVG and older ones stop at the `.ico`.

### Where the platforms differ

- **iOS** applies its own squircle mask and renders transparent pixels black. So
  `apple-touch-icon.png` is full-bleed: corners deliberately left square (no
  double rounding) and no alpha anywhere. Verified against a mask of corner
  radius 22.37%: nothing inked is clipped.
- **Android maskable** may crop to any shape; only a circle of 80% the canvas
  width is guaranteed visible. The mark is scaled to fit that circle, and the
  scale comes from the furthest inked point's distance to the centre, **not**
  from the bounding box circumradius — the box corners are empty, and using them
  shrank the icon 22% for nothing. Safe-zone usage went 79% → 97%, still with
  zero inked pixels outside.

## Rebuilding the rasters

`scripts/build-icons.py`, standard library only, no dependencies.

This machine has no rsvg-convert, ImageMagick, Inkscape or cairosvg, so there is
no ready SVG→PNG path. Rather than add a binary dependency for five icon files,
the script draws the shapes itself with supersampling. The cost of that choice:
**the geometry in the script is a copy of `favicon.svg`** and the two must move
together. The script asserts the ray count is still nine.

Fidelity was measured, not assumed: the script's output was compared pixel by
pixel against the browser engine's render of the SVG at 512×512. Mean difference
0.2/255, and of the 888 pixels differing by more than 24, **every one sits on an
anti-aliasing edge and none in the interior** — the shapes are identical, only
edge smoothing differs.

Bounding-box rejection per shape took a full build from 103s to 17s, which paid
for raising the sample count rather than lowering it.

## Cache consequences

`Caddyfile` now also sets `/favicon.ico` and `/apple-touch-icon.png` (a week) and
`/manifest.json` (a day). None of them are `immutable` on purpose: the
unversioned URL is what clients that skip the HTML will ask for.

The manifest icons live under `/assets/*`, which **is** `immutable,
max-age=31536000`. So `scripts/bump-version.sh` was widened to rewrite `?v=` in
`manifest.json` as well as `index.html`; without that the icons inside it could
never be replaced.

`theme-color` stays `#293d50` — already the badge background, nothing to change.

## Noted in passing

`.claude/launch.json` set `runtimeExecutable` to `python`, which does not exist on
this machine, so the preview server could not start at all. Corrected to
`python3`. Unrelated to the icons, but it blocked verifying any of this in a
browser.
