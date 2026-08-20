# Atlas Jambi Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the PUTS 2026 map as "Atlas Jambi" — full-bleed map with floating panels, official ESDM tokens (navy/blue/yellow, Montserrat + Work Sans), bottom sheet + bottom-docked popup on mobile — per `docs/superpowers/specs/2026-06-12-atlas-jambi-redesign-design.md`.

**Architecture:** Static qgis2web/OpenLayers app. All work happens in 4 files (`index.html`, `custom.css`, `custom.js`, `styles/260331_4_style.js`) plus one legend swatch in `layers/layers.js`, a new `assets/` dir, and Caddyfile cache header. Every element ID and body-class hook used by `custom.js` is preserved; `custom.css` is rewritten from scratch on the new token system.

**Tech Stack:** Vanilla HTML/CSS/JS, OpenLayers (ol.js, qgis2web export), Google Fonts (Montserrat, Work Sans), Caddy static serving.

**Verification setup (no test framework exists — this is a static site; every task verifies in a real browser):**

1. Serve the repo root: `npx -y http-server -p 8123 -c-1` (run in background; `-c-1` disables caching).
2. Use chrome-devtools MCP: `new_page` → `http://localhost:8123`, `resize_page` to the width under test, `take_screenshot`, `list_console_messages` (expect no errors), `evaluate_script` for DOM assertions.
3. Standard widths: desktop 1440×900, laptop 1024×768, tablet 768×1024, phone 390×844, small phone 360×740, landscape phone 844×390.

**JS contract — these must keep working after every task** (all referenced from `custom.js`):
IDs `#sidebar #sidebar-close #panel-toggle #panel-backdrop #list-search #fit-map #list-data #count-points #count-groups #count-groups-label #count-visible #popup #popup-content #popup-closer`; body classes `is-panel-open is-popup-open is-sidebar-collapsed`; element classes built by JS: `.group .group-toggle .group-chevron .group-title .group-meta .group-items .item .item-code .item-copy .item-label .item-subline .empty-state`; globals `window.map window.lyr_260331_4 window.lyr_BatasKabupaten2011_1 window.overlayPopup window.featureOverlay window.collection style_260331_4`.

---

### Task 1: Branch, lambang asset, fonts, Caddyfile

**Files:**
- Create: `assets/lambang-jambi.svg` (downloaded)
- Modify: `index.html:18-23` (fonts), `index.html:14` (theme-color), `index.html:39` (title)
- Modify: `Caddyfile` (assets cache header)

- [ ] **Step 1: Create the working branch**

```bash
git checkout -b redesign/atlas-jambi
```

- [ ] **Step 2: Download the official lambang**

```bash
mkdir -p assets
curl -sL "https://commons.wikimedia.org/wiki/Special:FilePath/Coat_of_arms_of_Jambi.svg" -o assets/lambang-jambi.svg
```

Verify: file is non-trivial SVG — `head -c 200 assets/lambang-jambi.svg` shows `<svg` or `<?xml`, and size > 10KB. (URL verified 2026-06-12 → redirects to `upload.wikimedia.org/wikipedia/commons/f/f2/Coat_of_arms_of_Jambi.svg`, HTTP 200.)

- [ ] **Step 3: Swap fonts, theme color, and title in index.html**

Replace the Google Fonts link (line 20-23):

```html
<link
  href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Work+Sans:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

Replace line 14:

```html
<meta name="theme-color" content="#293d50" />
```

Replace line 39:

```html
<title>Atlas PUTS 2026 · Penerangan Jalan Umum Tenaga Surya Provinsi Jambi</title>
```

- [ ] **Step 4: Add assets cache rule to Caddyfile**

After the `header /images/*` line add:

```
    header /assets/* Cache-Control "public, max-age=604800"
```

- [ ] **Step 5: Verify and commit**

Serve + open `http://localhost:8123` — page still renders with old design, no console errors, new fonts load (Network tab shows fonts.googleapis.com css2 request).

```bash
git add assets/lambang-jambi.svg index.html Caddyfile
git commit -m "Add lambang asset, ESDM fonts, assets cache rule"
```

---

### Task 2: index.html — new DOM structure

**Files:**
- Modify: `index.html:41-147` (entire `<body>` markup before scripts)

- [ ] **Step 1: Replace the body markup**

Replace everything from `<div class="app-shell">` through `</main>` (lines 42-147) with:

```html
    <div class="app-shell">
      <header class="masthead">
        <img
          class="masthead-lambang"
          src="./assets/lambang-jambi.svg"
          alt="Lambang Provinsi Jambi"
          width="34"
          height="40"
        />
        <div class="masthead-copy">
          <p class="masthead-kicker">Pemprov Jambi &middot; Dinas ESDM</p>
          <h1 class="masthead-title">Atlas PUTS 2026</h1>
        </div>
      </header>

      <aside id="sidebar" aria-label="Daftar titik PUTS">
        <button
          id="sheet-handle"
          type="button"
          aria-controls="sidebar"
          aria-expanded="false"
          aria-label="Buka atau tutup daftar titik"
        ></button>
        <button id="sidebar-close" type="button" aria-label="Tutup panel data">
          &times;
        </button>

        <div class="sidebar-header">
          <div class="sidebar-stats" aria-label="Ringkasan data">
            <div class="stat stat--lead">
              <strong id="count-points">0</strong>
              <span>titik</span>
            </div>
            <div class="stat">
              <strong id="count-groups">0</strong>
              <span id="count-groups-label">pengusul</span>
            </div>
            <div class="stat">
              <strong id="count-visible">0</strong>
              <span>tampil</span>
            </div>
          </div>

          <div class="sidebar-actions">
            <label class="search-field" for="list-search">
              <span class="visually-hidden">Cari titik PUTS</span>
              <i class="fas fa-search search-icon" aria-hidden="true"></i>
              <input
                id="list-search"
                type="search"
                placeholder="Cari nomor, pengusul, alamat..."
                autocomplete="off"
              />
            </label>
            <button id="fit-map" class="secondary-action" type="button">
              Lihat semua
            </button>
          </div>

          <div class="group-mode" role="group" aria-label="Kelompokkan titik">
            <button
              type="button"
              class="group-mode__btn is-active"
              data-mode="nama"
              aria-pressed="true"
            >
              Pengusul
            </button>
            <button
              type="button"
              class="group-mode__btn"
              data-mode="kabupaten"
              aria-pressed="false"
            >
              Kabupaten
            </button>
          </div>
        </div>

        <div class="sidebar-scroll">
          <div id="list-data" aria-live="polite"></div>
        </div>

        <p class="sidebar-footer">
          Sumber: survey lapangan 2026 &middot; Dinas ESDM Provinsi Jambi
        </p>
      </aside>

      <button
        id="panel-backdrop"
        type="button"
        aria-label="Tutup panel data"
        tabindex="-1"
      ></button>

      <button
        id="panel-toggle"
        class="panel-toggle"
        type="button"
        aria-controls="sidebar"
        aria-expanded="false"
        aria-label="Tampilkan atau sembunyikan panel data"
      >
        <span class="panel-toggle__chevron" aria-hidden="true"></span>
      </button>

      <main class="map-frame">
        <div id="map" aria-label="Peta sebaran PUTS">
          <div id="popup" class="ol-popup">
            <a href="#" id="popup-closer" class="ol-popup-closer" aria-label="Tutup info titik"></a>
            <div id="popup-content"></div>
          </div>
        </div>
      </main>
    </div>
```

Notes on what changed and why:
- `.masthead` is new (replaces `.sidebar-brand` — the title moves out of the panel).
- `#sheet-handle` is new (mobile bottom-sheet grab handle).
- `.sidebar-hint` paragraph removed (the masthead + stats explain the app now); `.sidebar-footer` moved outside `.sidebar-scroll` so it pins to the panel bottom.
- Stat markup: `.stat-card` → `.stat` + `.stat--lead`; all IDs unchanged.
- Everything else (IDs, script tags below) untouched in this task.

- [ ] **Step 2: Verify hooks still resolve, commit**

Serve and run in the browser console (or `evaluate_script`):

```js
["sidebar","sheet-handle","sidebar-close","panel-toggle","panel-backdrop","list-search","fit-map","list-data","count-points","count-groups","count-groups-label","count-visible","popup","popup-content","popup-closer"].filter(id => !document.getElementById(id))
```

Expected: `[]`. Also: list renders (group names + counts appear in `#list-data`), no console errors. Layout will look rough — old CSS, new DOM — that's expected until Task 3.

```bash
git add index.html
git commit -m "Restructure DOM: masthead, sheet handle, pinned footer"
```

---

### Task 3: custom.css — full rewrite, desktop

**Files:**
- Rewrite: `custom.css` (replace entire file; mobile block comes in Task 4)

- [ ] **Step 1: Replace custom.css with the new desktop stylesheet**

```css
:root {
    --ink: #293d50;
    --ink-soft: #3d5165;
    --blue: #0072bc;
    --blue-deep: #00458f;
    --yellow: #fee50f;
    --blue-tint: #ecf5ff;
    --hairline: #d6eaff;
    --hairline-strong: #c9d6e2;
    --divider: #e5edf4;
    --muted: #5a6b7d;
    --muted-2: #7e8fa0;
    --surface: #ffffff;
    --surface-glass: rgba(255, 255, 255, 0.96);
    --scrim: rgba(41, 61, 80, 0.45);
    --shadow-lg: 0 18px 48px rgba(41, 61, 80, 0.22);
    --shadow-sm: 0 6px 18px rgba(41, 61, 80, 0.14);
    --radius-lg: 16px;
    --radius-md: 12px;
    --radius-sm: 8px;
    --panel-width: clamp(330px, 26vw, 380px);
    --panel-left: 16px;
    --panel-top: 84px;
    --font-display: "Montserrat", sans-serif;
    --font-ui: "Work Sans", sans-serif;
}

* {
    box-sizing: border-box;
}

html,
body {
    width: 100%;
    height: 100%;
    margin: 0;
}

body {
    font-family: var(--font-ui);
    color: var(--ink);
    background: #14202c;
    overflow: hidden;
}

.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
}

:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
}

.app-shell {
    position: relative;
    width: 100%;
    height: 100dvh;
}

.map-frame {
    position: absolute;
    inset: 0;
}

#map {
    width: 100%;
    height: 100%;
    background: #14202c;
}

/* ---------- Masthead ---------- */

.masthead {
    position: absolute;
    top: 16px;
    left: var(--panel-left);
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 16px 9px 12px;
    background: var(--surface-glass);
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
}

.masthead-lambang {
    width: 34px;
    height: auto;
    display: block;
}

.masthead-copy {
    border-left: 1px solid var(--hairline);
    padding-left: 12px;
    display: grid;
    gap: 2px;
}

.masthead-kicker {
    margin: 0;
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--blue-deep);
}

.masthead-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.1;
    color: var(--ink);
}

/* ---------- Data panel ---------- */

#sidebar {
    position: absolute;
    top: var(--panel-top);
    bottom: 16px;
    left: var(--panel-left);
    z-index: 19;
    width: var(--panel-width);
    display: flex;
    flex-direction: column;
    background: var(--surface-glass);
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    transition: transform 0.3s ease, opacity 0.3s ease;
}

body.is-sidebar-collapsed #sidebar {
    transform: translateX(calc(-100% - 40px));
    opacity: 0;
    pointer-events: none;
}

#sheet-handle {
    display: none;
}

#sidebar-close {
    display: none;
}

.sidebar-header {
    flex-shrink: 0;
    display: grid;
    gap: 14px;
    padding: 18px 18px 0;
}

.sidebar-stats {
    display: flex;
    align-items: baseline;
    gap: 16px;
    flex-wrap: wrap;
}

.stat {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.stat strong {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--ink);
}

.stat--lead strong {
    background: var(--yellow);
    border-radius: 6px;
    padding: 1px 7px;
}

.stat span {
    font-size: 12px;
    color: var(--muted);
}

.sidebar-actions {
    display: flex;
    gap: 8px;
}

.search-field {
    position: relative;
    flex: 1;
}

.search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 13px;
    color: var(--muted-2);
    pointer-events: none;
}

.search-field input {
    width: 100%;
    height: 40px;
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    background: var(--surface);
    padding: 0 12px 0 34px;
    font: 500 14px var(--font-ui);
    color: var(--ink);
}

.search-field input::placeholder {
    color: var(--muted-2);
}

.search-field input:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 1px;
}

.secondary-action {
    height: 40px;
    padding: 0 14px;
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    background: var(--surface);
    color: var(--blue-deep);
    font: 600 13px var(--font-display);
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
}

.secondary-action:hover {
    background: var(--blue-tint);
    border-color: var(--blue);
}

.group-mode {
    display: flex;
    gap: 18px;
    border-bottom: 1px solid var(--hairline);
}

.group-mode__btn {
    appearance: none;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    padding: 0 2px 9px;
    font: 600 13px var(--font-display);
    color: var(--muted-2);
    cursor: pointer;
}

.group-mode__btn:hover {
    color: var(--ink-soft);
}

.group-mode__btn.is-active {
    color: var(--ink);
    border-bottom-color: var(--yellow);
}

/* ---------- Group list ---------- */

.sidebar-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 18px 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--hairline-strong) transparent;
}

.group {
    border-bottom: 1px solid var(--divider);
}

.group-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 2px;
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    text-align: left;
}

.group-chevron {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-right: 2px solid var(--blue);
    border-bottom: 2px solid var(--blue);
    transform: rotate(-45deg);
    transition: transform 0.18s ease;
}

.group-toggle[aria-expanded="true"] .group-chevron {
    transform: rotate(45deg);
}

.group-title {
    flex: 1;
    margin: 0;
    font: 600 13.5px var(--font-ui);
    color: var(--ink);
}

.group-meta {
    margin: 0;
    font: 700 13px var(--font-display);
    color: var(--blue);
}

.group-items {
    padding-bottom: 8px;
}

.item {
    position: relative;
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 2px 0;
    padding: 9px 10px;
    border: none;
    border-radius: 9px;
    background: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
}

.item::before {
    content: "";
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    margin-top: 5px;
    border-radius: 50%;
    background: var(--hairline-strong);
}

.item:hover {
    background: var(--blue-tint);
}

.item.is-active {
    background: var(--blue-tint);
}

.item.is-active::before {
    background: var(--yellow);
    box-shadow: 0 0 0 1.5px var(--ink);
}

.item-copy {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
}

.item-label {
    font: 500 13.5px var(--font-ui);
    color: var(--ink);
}

.item-subline {
    font-size: 12px;
    color: var(--muted);
}

.item-code {
    order: 3;
    margin-left: auto;
    padding-top: 2px;
    font: 600 11px var(--font-display);
    color: var(--muted-2);
}

.empty-state {
    padding: 18px 4px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--muted);
}

.sidebar-footer {
    flex-shrink: 0;
    margin: 0;
    padding: 10px 18px 14px;
    border-top: 1px solid var(--divider);
    font-size: 11.5px;
    color: var(--muted-2);
}

/* ---------- Panel toggle (desktop) ---------- */

.panel-toggle {
    position: absolute;
    top: var(--panel-top);
    left: calc(var(--panel-left) + var(--panel-width) + 12px);
    z-index: 21;
    width: 40px;
    height: 40px;
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    background: var(--surface-glass);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: left 0.3s ease, background-color 0.15s ease;
}

.panel-toggle:hover {
    background: var(--blue-tint);
}

body.is-sidebar-collapsed .panel-toggle {
    left: var(--panel-left);
}

.panel-toggle__chevron {
    display: block;
    width: 8px;
    height: 8px;
    margin: 0 auto;
    border-left: 2px solid var(--ink);
    border-bottom: 2px solid var(--ink);
    transform: rotate(45deg) translate(1px, -1px);
    transition: transform 0.3s ease;
}

body.is-sidebar-collapsed .panel-toggle__chevron {
    transform: rotate(225deg) translate(1px, -1px);
}

#panel-backdrop {
    display: none;
}

/* ---------- Point popup (desktop: anchored overlay) ---------- */

.ol-popup {
    position: absolute;
    bottom: 26px;
    left: -150px;
    width: 300px;
    background: var(--surface);
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    display: none;
}

.ol-popup::after {
    content: "";
    position: absolute;
    bottom: -8px;
    left: 50%;
    width: 14px;
    height: 14px;
    transform: translateX(-50%) rotate(45deg);
    background: var(--surface);
    border-right: 1px solid var(--hairline-strong);
    border-bottom: 1px solid var(--hairline-strong);
}

.ol-popup-closer {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: var(--shadow-sm);
    text-align: center;
    line-height: 28px;
    text-decoration: none;
    color: var(--muted);
    font-size: 14px;
}

.ol-popup-closer::after {
    content: "\2715";
}

.feature-popup {
    border-radius: var(--radius-md);
    overflow: hidden;
}

.feature-popup__media {
    position: relative;
    height: 150px;
    background: var(--hairline-strong);
}

.feature-popup__media img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.feature-popup__media-badge {
    position: absolute;
    left: 10px;
    bottom: 8px;
    background: rgba(41, 61, 80, 0.85);
    color: #ffffff;
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 6px;
}

.feature-popup__body {
    padding: 12px 14px 14px;
}

.feature-popup__eyebrow {
    margin: 0;
    font: 600 11px var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--blue-deep);
}

.feature-popup__title {
    margin: 3px 0 8px;
    font: 700 18px var(--font-display);
    line-height: 1.2;
    color: var(--ink);
}

.feature-popup__meta {
    margin: 0;
    display: grid;
}

.feature-popup__meta-row {
    display: flex;
    gap: 9px;
    padding: 6px 0;
    border-top: 1px solid var(--divider);
}

.meta-icon {
    flex-shrink: 0;
    width: 16px;
    padding-top: 1px;
    text-align: center;
    color: var(--blue);
    font-size: 13px;
}

.feature-popup__meta-row dt {
    margin: 0;
    font-size: 11px;
    color: var(--muted-2);
}

.feature-popup__meta-row dd {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--ink-soft);
}

.feature-popup__rule {
    width: 32px;
    border-top: 3px solid var(--yellow);
    margin-top: 10px;
}

/* ---------- Map furniture ---------- */

.ol-control {
    background: none;
    padding: 0;
}

.ol-control button {
    margin: 0;
}

.ol-zoom {
    position: absolute;
    top: auto;
    left: auto;
    right: 16px;
    bottom: 92px;
    background: var(--surface-glass);
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    padding: 0;
}

.ol-zoom button {
    display: block;
    width: 38px;
    height: 36px;
    background: none;
    border: none;
    border-radius: 0;
    color: var(--ink);
    font-size: 18px;
    font-weight: 500;
    cursor: pointer;
}

.ol-zoom button:hover,
.ol-zoom button:focus {
    background: var(--blue-tint);
    color: var(--ink);
    outline: none;
}

.ol-zoom .ol-zoom-in {
    border-bottom: 1px solid var(--hairline);
}

.ol-scale-line {
    position: absolute;
    left: auto;
    right: 16px;
    bottom: 48px;
    background: var(--surface-glass);
    border: 1px solid var(--hairline-strong);
    border-radius: 6px;
    padding: 3px 8px;
}

.ol-scale-line-inner {
    border: 1px solid var(--ink-soft);
    border-top: none;
    color: var(--ink-soft);
    font-size: 11px;
    font-family: var(--font-ui);
}

/* qgis2web replaces the stock attribution with className 'bottom-attribution'
   (resources/qgis2web.js:563) — style that, not .ol-attribution */
.bottom-attribution {
    position: absolute;
    right: 16px;
    bottom: 16px;
    left: auto;
    top: auto;
    background: var(--surface-glass);
    border: 1px solid var(--hairline-strong);
    border-radius: 6px;
    padding: 1px 6px;
    max-width: none;
}

.bottom-attribution ul {
    margin: 0;
    padding: 2px 4px;
    font-size: 11px;
    color: var(--muted);
    text-shadow: none;
}

.bottom-attribution button {
    display: none;
}

.ol-rotate {
    display: none;
}

/* ---------- Layer switcher ---------- */

.layer-switcher {
    position: absolute;
    top: 16px;
    right: 16px;
}

.layer-switcher button {
    width: 42px;
    height: 42px;
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    background-color: var(--surface-glass);
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%23293d50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 9l9 5 9-5-9-5z"/><path d="m3 14 9 5 9-5"/></svg>');
    background-position: center;
    background-repeat: no-repeat;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
}

.layer-switcher.shown button {
    background-color: var(--blue-tint);
}

.layer-switcher .panel {
    margin-top: 6px;
    border: 1px solid var(--hairline-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    padding: 12px 14px;
    font: 13px var(--font-ui);
    color: var(--ink);
}

.layer-switcher .panel ul {
    margin: 0;
    padding: 0;
    list-style: none;
}

.layer-switcher .panel li {
    padding: 4px 0;
}

.layer-switcher .panel label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--ink-soft);
}

.layer-switcher .panel input[type="checkbox"] {
    accent-color: var(--blue);
    width: 15px;
    height: 15px;
}

.layer-switcher .panel .group > label {
    font: 600 11px var(--font-display);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--blue-deep);
}
```

Implementation note for the executor: the old `custom.css` contained overrides for qgis2web internals (`.ol-popup` arrow, layer-switcher quirks, measure controls). The new file above intentionally replaces all of them; `resources/qgis2web.css` and `resources/ol-layerswitcher.css` still load first, so if a stray default bleeds through (e.g. layer-switcher arrow glyphs, attribution collapse button), neutralize it with a targeted override appended to the relevant section — keep selector names, don't edit the vendored files.

- [ ] **Step 2: Visual verification, desktop**

Serve; chrome-devtools at 1440×900 and 1024×768:
- Map fills the entire viewport (no padded frame).
- Masthead chip top-left shows lambang + kicker + "Atlas PUTS 2026" in Montserrat.
- Panel floats below the masthead: yellow-chip titik stat, search with icon, yellow-underline active tab, accordion groups with blue counts.
- Expanding a group shows items with dots, name, subline, right-aligned code.
- Clicking an item: popup card appears anchored at the pin (photo top, blue-deep kicker, Montserrat title, meta rows, yellow rule); selected item gets blue-tint + yellow dot.
- `#panel-toggle` chevron chip beside the panel collapses it (panel slides off, chip slides to the left edge, map full); clicking again restores.
- Zoom buttons, scale, attribution = white chips bottom-right; layer chip top-right opens the restyled panel.
- `list_console_messages`: no errors.

- [ ] **Step 3: Commit**

```bash
git add custom.css
git commit -m "Rewrite custom.css on ESDM tokens: desktop Atlas layout"
```

---

### Task 4: custom.css — mobile bottom sheet + docked popup

**Files:**
- Modify: `custom.css` (append mobile + motion blocks at end of file)

- [ ] **Step 1: Append the mobile and reduced-motion blocks**

```css
/* ---------- Mobile (<960px): bottom sheet + docked popup ---------- */

@media (max-width: 959px) {
    :root {
        --sheet-peek: 178px;
    }

    .masthead {
        top: 12px;
        left: 12px;
        right: 66px;
        padding: 7px 12px 7px 10px;
        gap: 10px;
    }

    .masthead-lambang {
        width: 26px;
    }

    .masthead-kicker {
        font-size: 10px;
        letter-spacing: 0.12em;
    }

    .masthead-title {
        font-size: 16px;
    }

    .panel-toggle {
        display: none;
    }

    #sidebar {
        top: auto;
        left: 0;
        right: 0;
        bottom: 0;
        width: auto;
        max-height: 85dvh;
        height: 85dvh;
        border-radius: 18px 18px 0 0;
        border-left: none;
        border-right: none;
        border-bottom: none;
        transform: translateY(calc(100% - var(--sheet-peek)));
        transition: transform 0.3s ease;
    }

    body.is-panel-open #sidebar {
        transform: translateY(0);
    }

    body.is-popup-open #sidebar {
        transform: translateY(100%);
    }

    #sheet-handle {
        display: block;
        flex-shrink: 0;
        width: 100%;
        padding: 10px 0 4px;
        background: none;
        border: none;
        cursor: pointer;
    }

    #sheet-handle::before {
        content: "";
        display: block;
        width: 44px;
        height: 5px;
        margin: 0 auto;
        border-radius: 3px;
        background: var(--hairline-strong);
    }

    #sidebar-close {
        position: absolute;
        top: 10px;
        right: 12px;
        z-index: 2;
        display: none;
        width: 34px;
        height: 34px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--hairline-strong);
        border-radius: 50%;
        background: var(--surface);
        color: var(--muted);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
    }

    body.is-panel-open #sidebar-close {
        display: flex;
    }

    .sidebar-header {
        padding: 4px 16px 0;
        gap: 10px;
    }

    .stat strong {
        font-size: 19px;
    }

    .sidebar-scroll {
        padding: 4px 16px 10px;
        overflow-y: hidden;
    }

    body.is-panel-open .sidebar-scroll {
        overflow-y: auto;
    }

    .sidebar-footer {
        display: none;
    }

    body.is-panel-open .sidebar-footer {
        display: block;
    }

    #panel-backdrop {
        position: fixed;
        inset: 0;
        z-index: 18;
        border: none;
        padding: 0;
        background: var(--scrim);
        cursor: pointer;
    }

    body:not(.is-panel-open) #panel-backdrop {
        display: none;
    }

    body.is-panel-open #panel-backdrop {
        display: block;
    }

    /* Bottom-docked point popup.
       OpenLayers positions its overlay wrapper (.ol-overlay-container, the
       parent of #popup) with inline left/top/transform. A transform on an
       ancestor re-roots position:fixed, so neutralize the wrapper on mobile
       and dock the card against the real viewport. (!important is required
       to beat OL's inline styles.) */
    .ol-overlay-container {
        position: static !important;
        transform: none !important;
    }

    .ol-popup {
        position: fixed !important;
        top: auto !important;
        left: 10px !important;
        right: 10px !important;
        bottom: 10px !important;
        width: auto !important;
        max-height: 62dvh;
        overflow-y: auto;
        z-index: 22;
    }

    .ol-popup::after {
        display: none;
    }

    .feature-popup__media {
        height: 132px;
    }

    /* Map furniture yields while popup or sheet is open */
    body.is-popup-open .ol-zoom,
    body.is-popup-open .layer-switcher,
    body.is-popup-open .ol-scale-line,
    body.is-popup-open .bottom-attribution,
    body.is-panel-open .ol-zoom,
    body.is-panel-open .ol-scale-line {
        display: none;
    }

    .ol-zoom {
        bottom: calc(var(--sheet-peek) + 16px);
    }

    .ol-scale-line {
        bottom: calc(var(--sheet-peek) + 16px);
        right: 62px;
    }

    .bottom-attribution {
        bottom: calc(var(--sheet-peek) + 16px);
        right: auto;
        left: 12px;
    }
}

@media (max-width: 959px) and (max-height: 500px) {
    :root {
        --sheet-peek: 118px;
    }

    .sidebar-header {
        gap: 6px;
    }

    .sidebar-stats {
        display: none;
    }
}

@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        transition: none !important;
        animation: none !important;
    }
}
```

- [ ] **Step 2: Visual verification, mobile**

Chrome-devtools at 390×844, 360×740, and 844×390 (landscape):
- Sheet rests at peek: handle + stats + search visible at the bottom; map above with compact masthead.
- Tapping the handle expands the sheet to 85dvh with backdrop behind it; handle tap / backdrop / close button / Escape all collapse it. (Handle JS lands in Task 5 — at this point verify by toggling `document.body.classList.toggle('is-panel-open')` via `evaluate_script`.)
- With `is-popup-open` set: sheet fully hides; popup card (tap an expanded item first) docks bottom, full-width minus 10px gutters; zoom/layer/scale/attribution hidden.
- Landscape 844×390: peek shrinks (no stats), everything reachable.

- [ ] **Step 3: Commit**

```bash
git add custom.css
git commit -m "Mobile: bottom sheet, docked popup, furniture yielding"
```

---

### Task 5: custom.js — popup template, sheet handle, dock panning

**Files:**
- Modify: `custom.js:63-129` (buildPopupHtml), `custom.js:150-156` (setPanelOpen), `custom.js:299-305` (group label case), `custom.js:396-414` (mobile pan math), after `custom.js:739` (sheet handle + search focus listeners)

- [ ] **Step 1: Replace buildPopupHtml (lines 63-129)**

```js
  function buildPopupHtml(item) {
    var rows = [];
    var photoPath = item.photo ? sanitizeMediaPath(item.photo) : "";

    var fieldIcons = {
      nama: '<i class="fas fa-user-check"></i>',
      alamat: '<i class="fas fa-map-marker-alt"></i>',
      tanggal: '<i class="fas fa-calendar-alt"></i>',
      keterangan: '<i class="fas fa-info-circle"></i>'
    };

    function metaRow(icon, label, value) {
      return (
        '<div class="feature-popup__meta-row">' +
          '<div class="meta-icon">' + icon + '</div>' +
          '<div><dt>' + label + '</dt><dd>' + escapeHtml(value) + '</dd></div>' +
        "</div>"
      );
    }

    if (item.nama) {
      rows.push(metaRow(fieldIcons.nama, "Pengusul", item.nama));
    }
    if (item.alamat) {
      rows.push(metaRow(fieldIcons.alamat, "Alamat", item.alamat));
    }
    if (item.tanggal) {
      rows.push(metaRow(fieldIcons.tanggal, "Dokumentasi", item.tanggal));
    }
    if (item.keterangan) {
      rows.push(metaRow(fieldIcons.keterangan, "Keterangan", item.keterangan));
    }

    var kicker =
      "Titik " + escapeHtml(item.display.code) +
      (item.kabupaten ? " · " + escapeHtml(item.kabupaten) : "");

    return (
      '<div class="feature-popup">' +
      (photoPath
        ? '<div class="feature-popup__media">' +
          '<img src="images/' + encodeURI(photoPath) + '" alt="Foto lokasi ' + escapeHtml(item.nomor) + '" loading="lazy" />' +
          '<span class="feature-popup__media-badge">Foto survey awal</span>' +
          "</div>"
        : "") +
      '<div class="feature-popup__body">' +
      '<p class="feature-popup__eyebrow">' + kicker + "</p>" +
      '<h3 class="feature-popup__title">' + escapeHtml(item.display.primary) + "</h3>" +
      (rows.length ? '<dl class="feature-popup__meta">' + rows.join("") + "</dl>" : "") +
      '<div class="feature-popup__rule"></div>' +
      "</div>" +
      "</div>"
    );
  }
```

(The CSS text-transform uppercases the kicker; `item.kabupaten` is set during init before any popup can open.)

- [ ] **Step 2: Update setPanelOpen to sync the sheet handle (lines 150-156)**

```js
  function setPanelOpen(isOpen) {
    document.body.classList.toggle("is-panel-open", isOpen);
    var toggle = document.getElementById("panel-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
    var handle = document.getElementById("sheet-handle");
    if (handle) {
      handle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }
```

- [ ] **Step 3: Lowercase the group-count label (line 302-304)**

In `updateGroupStats`, replace the ternary:

```js
        countGroupsLabel.textContent =
          groupMode === "kabupaten" ? "wilayah" : "pengusul";
```

- [ ] **Step 4: Replace the mobile pan math in focusItem (lines 393-414)**

Replace the whole block beginning with the comment `// On mobile the popup sits at the top of the map.` and ending just before `view.animate({` with:

```js
      // Mobile: the popup docks at the bottom of the screen, so pan the pin
      // into the upper third where the card can never cover it.
      var animateCenter = featureCenter;
      if (window.innerWidth < 960) {
        var size = window.map.getSize();
        if (size && size[1]) {
          var targetResolution = view.getResolutionForZoom(targetZoom);
          var pinTargetY = size[1] * 0.32;
          var offsetPxDown = pinTargetY - size[1] / 2;
          animateCenter = [
            featureCenter[0],
            featureCenter[1] + offsetPxDown * targetResolution
          ];
        }
      }
```

(Removes the `void popup.offsetHeight` measurement path — no longer needed.)

- [ ] **Step 5: Add sheet-handle and search-focus listeners (after the panelBackdrop block, line ~745)**

```js
    var sheetHandle = document.getElementById("sheet-handle");
    if (sheetHandle) {
      sheetHandle.addEventListener("click", function () {
        setPanelOpen(!document.body.classList.contains("is-panel-open"));
      });
    }

    // Focusing search from the peek sheet expands it so results are visible.
    searchInput.addEventListener("focus", function () {
      if (window.innerWidth < 960) {
        setPanelOpen(true);
      }
    });
```

- [ ] **Step 6: Verify both viewports**

Desktop 1440×900: click item → popup shows photo-first card with "TITIK 001 · KOTA JAMBI"-style kicker; collapse/restore panel; search filters; tab switch to Kabupaten regroups and label reads "wilayah".
Mobile 390×844: handle tap expands/collapses sheet (aria-expanded flips); focusing search expands sheet; tapping an item closes the sheet, docks the popup bottom, pin animates to upper third and stays visible above the card; popup ✕ → selection cleared, sheet returns at peek. Watch for pan flicker when the popup opens: the vendor overlay has `autoPan` (qgis2web.js:107) which now measures a zero-size static wrapper — `focusItem` already cancels in-flight animations (`view.cancelAnimations()`) before its own `view.animate`, which suppresses it; if any visible jump survives, that cancel call is the place to debug. `list_console_messages`: clean.

- [ ] **Step 7: Commit**

```bash
git add custom.js
git commit -m "Popup card template, sheet handle wiring, bottom-dock panning"
```

---

### Task 6: Pin symbology — yellow/navy pins, selected ring, legend swatch

**Files:**
- Modify: `styles/260331_4_style.js:4-9` (pin SVG)
- Modify: `custom.js:190-191` (pinStyle)
- Modify: `layers/layers.js:71` (layer-switcher legend swatch)

- [ ] **Step 1: Recolor the layer pin (styles/260331_4_style.js lines 4-9)**

```js
var pinSvg_260331_4 =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 36 48">' +
        '<filter id="p"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.4"/></filter>' +
        '<path filter="url(%23p)" d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="%23fee50f" stroke="%23293d50" stroke-width="2"/>' +
        '<circle cx="18" cy="18" r="6.5" fill="%23293d50"/>' +
    '</svg>';
```

- [ ] **Step 2: Selected-pin overlay style (custom.js lines 190-191)**

Replace:

```js
    // Selection overlay disabled — the layer's red pin is the only marker
    var pinStyle = null;
```

with:

```js
    // Selected pin: enlarged with a white ring, drawn on the feature overlay
    // above the layer's yellow pin.
    var selectedPinSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 36 48">' +
        '<path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="%23fee50f" stroke="%23ffffff" stroke-width="3"/>' +
        '<circle cx="18" cy="18" r="6.5" fill="%23293d50"/>' +
      '</svg>';
    var pinStyle = new ol.style.Style({
      image: new ol.style.Icon({
        src: "data:image/svg+xml," + selectedPinSvg,
        anchor: [0.5, 1],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        scale: 1
      }),
      zIndex: 10
    });
```

(`focusItem` already calls `window.featureOverlay.setStyle(pinStyle)` and `clearSelection` resets it to `null` — no further wiring needed.)

- [ ] **Step 3: Match the layer-switcher legend swatch (layers/layers.js line 71)**

Replace the `title:` value of `lyr_260331_4` with:

```js
                title: '<img src=\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="0 0 36 48"><path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="%23fee50f" stroke="%23293d50" stroke-width="2"/><circle cx="18" cy="18" r="6.5" fill="%23293d50"/></svg>\' /> Titik PUTS'
```

- [ ] **Step 4: Verify**

Desktop: pins render yellow with navy outline + navy core on the satellite map; clicking one swaps in the larger white-ring pin; closing the popup restores the normal pin; layer-switcher legend shows the yellow swatch. Mobile spot-check 390×844: pins legible against terrain.

- [ ] **Step 5: Commit**

```bash
git add styles/260331_4_style.js custom.js layers/layers.js
git commit -m "Yellow/navy pin symbology with white-ring selected state"
```

---

### Task 7: Cache busting + full verification sweep

**Files:**
- Modify: `index.html` (version query strings)

- [ ] **Step 1: Bump versions on every changed asset reference in index.html**

- `./custom.css?v=20260607j` → `./custom.css?v=20260612a`
- `./custom.js?v=20260607f` → `./custom.js?v=20260612a`
- `styles/260331_4_style.js?v=20260421` → `styles/260331_4_style.js?v=20260612`
- `./layers/layers.js?v=20260607b` → `./layers/layers.js?v=20260612`

- [ ] **Step 2: Full sweep at all six viewports**

For each of 1440×900, 1024×768, 768×1024, 390×844, 360×740, 844×390: screenshot default state, expanded group + selected item + open popup, and (mobile) expanded sheet. Checklist:
- No horizontal overflow, no clipped controls, popup never covers its pin.
- Kabupaten tab: selecting a kabupaten filters pins and zooms to region; "Lihat semua" restores.
- Search: typing filters; clearing restores; empty query message styled.
- Desktop collapse: full-map presentation view with masthead + chip only.
- `list_console_messages` at every viewport: no errors.
- Contrast spot-check via `evaluate_script` + getComputedStyle: `.stat--lead strong` is `#293d50` on `#fee50f` (12.6:1), `.feature-popup__eyebrow` `#00458f` on `#fff` (9.4:1), `.item-subline` `#5a6b7d` on white (5.9:1) — all AA.

- [ ] **Step 3: Fix anything the sweep catches, then commit**

```bash
git add -A
git commit -m "Bump asset versions for Atlas Jambi release"
```

---

### Task 8: Merge readiness

- [ ] **Step 1: Review the full diff**

```bash
git diff master --stat
```

Expected: only `index.html`, `custom.css`, `custom.js`, `styles/260331_4_style.js`, `layers/layers.js`, `Caddyfile`, `assets/lambang-jambi.svg`, docs.

- [ ] **Step 2: Hand off** — use superpowers:finishing-a-development-branch (merge to master / PR / keep branch — owner's call).
