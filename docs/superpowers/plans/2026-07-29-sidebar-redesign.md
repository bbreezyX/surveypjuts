# Sidebar Drill-Down Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the accordion sidebar with a two-screen drill-down, merge the masthead into the panel on desktop, and collapse the three-stat row plus the active-filter chip into one contextual summary line.

**Architecture:** `activeGroup` (already in `custom.js`) becomes the screen selector — `null` renders screen 1 (group rows), a group name renders screen 2 (that group's points). `renderList()` splits into `renderGroupScreen()` and `renderItemScreen()`. `visibleIds` remains the single source of truth for what the map draws, so map-filter semantics are untouched.

**Tech Stack:** Static qgis2web export. Vanilla ES5-style JS in one IIFE (`custom.js`), hand-written CSS (`custom.css`), OpenLayers global `ol`. No build step, no bundler, no package manager.

## Global Constraints

- **UI language is Indonesian.** Every user-facing string in this plan is final copy — do not translate or reword.
- **No new colour or font tokens.** The `:root` block in `custom.css:1-27` is used as-is.
- **ES5 style.** Match the surrounding code: `var`, `function`, no arrow functions, no template literals, no `const`/`let` in `custom.js`. (Verification snippets run in the browser console and may use modern syntax — they are not shipped code.)
- **Cache-busting.** `index.html` references every asset with `?v=YYYYMMDD<letter>`. Task 8 bumps them all once at the end; do not bump per task.
- **Touch targets ≥44px** for `.group-row`, `.panel-back`, and `.item`.
- **Contrast floor AA 4.5:1.** `--muted` (#5a6b7d) and `--muted-2` (#647587) were already corrected for this — do not lighten them.
- Spec: `docs/superpowers/specs/2026-07-29-sidebar-redesign-design.md`.

## Testing Approach — Read This First

**This repo has no test runner, no `package.json`, and no `node_modules`.** All of `custom.js` lives inside a single IIFE with its state trapped in the `init()` closure — nothing is exported, so unit-testing it would mean restructuring the module into something importable. That is a large, unrelated change and is out of scope for a sidebar redesign.

So every task in this plan is verified the way this repo has always been verified: **assertions run against the live DOM in the preview browser.** These are real pass/fail checks, not eyeballing.

Standard cycle per task:

1. Write the assertion snippet.
2. Run it **before** implementing — confirm it FAILS. (This is the "red" step. It matters: it proves the assertion actually tests something.)
3. Implement.
4. Run the snippet again — confirm PASS.
5. Screenshot for the visual tasks.
6. Commit.

**Setup, once, before Task 1:**

```bash
python3 -m http.server 8765 --directory /Users/dany/WEB-DEV/surveypjuts
```

Then open the preview at `http://localhost:8765` (use `preview_start` with `{url: "http://localhost:8765"}`, since a server may already hold that port).

**Every assertion snippet in this plan follows this shape** — run it via the browser `javascript_tool`, and hard-reload the page first so CSS/JS changes are picked up:

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  if (!document.querySelector('#list-data')) return 'NOT_READY — reload and retry';
  // checks go here
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

Data loads async from `data/points.geojson`. If a snippet returns `NOT_READY` or finds zero rows, reload and re-run — locally it lands in well under a second.

**Known gotcha (from prior sessions):** clicking an `.item` kicks off an ~800ms map fly-to that repositions the popup. A screenshot taken immediately after races it. Wait ~1.4s before screenshotting anything that follows an item click.

---

## File Structure

Three files change. They must change together — a CSS-only or HTML-only task would leave the app broken — so every task below is a vertical slice that leaves the site working.

| File | Responsibility | Change shape |
|---|---|---|
| `index.html` | Panel markup skeleton | Restructure `#sidebar` children; delete `#active-filter`; add `.panel-brand` |
| `custom.css` | All presentation | Rewrite the "Data panel" section; delete accordion + stats + chip rules; keep `.item*`, popup, skeleton, map furniture |
| `custom.js` | List rendering + state | Split `renderList()`; add `renderSummary()`; delete `renderActiveFilter()`, `updateGroupStats()`, `setCountsUnknown()` |

Task order runs top-to-bottom through the panel (brand → search → grouping → summary), then the navigation rewrite, then mobile. This way no task undoes markup an earlier task wrote.

**Naming note:** the spec (§3) calls the second zone `.panel-nav`. This plan keeps its existing class name `.sidebar-header` instead. The mobile media query already targets that selector in several places, and renaming it buys nothing but churn. `.sidebar-header` *is* the spec's `.panel-nav` zone.

---

### Task 1: Merge the masthead into the panel

**Files:**
- Modify: `index.html:45-58` (masthead), `index.html:60-72` (sidebar open)
- Modify: `custom.css:22` (`--panel-top`), `custom.css:82-128` (masthead block), `custom.css:130-168` (panel top)
- Modify: `custom.css:1158-1206` (mobile masthead rules)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `.panel-brand` block inside `#sidebar`, rendered above `.sidebar-header`. Later tasks insert their zones *below* it. `--panel-top` becomes `16px`.

- [ ] **Step 1: Write the failing assertion**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  if (!document.querySelector('#list-data')) return 'NOT_READY — reload and retry';
  const brand = document.querySelector('#sidebar .panel-brand');
  const mast = document.querySelector('.masthead');
  check('.panel-brand exists inside #sidebar', !!brand);
  check('.panel-brand is visible on desktop', brand && getComputedStyle(brand).display !== 'none');
  check('.masthead is hidden on desktop', mast && getComputedStyle(mast).display === 'none');
  check('panel top is 16px', getComputedStyle(document.getElementById('sidebar')).top === '16px');
  const h1s = [...document.querySelectorAll('h1')].filter(h => h.offsetParent !== null);
  check('exactly one visible h1', h1s.length === 1);
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

- [ ] **Step 2: Run it — confirm FAIL**

Resize the browser to desktop (1280x800) first. Expected: `FAIL: .panel-brand exists inside #sidebar | ...`

- [ ] **Step 3: Add the markup**

In `index.html`, insert immediately after the `<button id="sidebar-close">…</button>` closing tag and before `<div class="sidebar-header">`:

```html
        <div class="panel-brand">
          <img
            class="panel-brand__lambang"
            src="./assets/lambang-jambi.svg"
            alt="Lambang Provinsi Jambi"
            width="34"
            height="40"
            decoding="async"
          />
          <div class="panel-brand__copy">
            <p class="panel-brand__kicker">Pemprov Jambi &middot; Dinas ESDM</p>
            <h1 class="panel-brand__title">Peta Sebaran PUTS 2026</h1>
          </div>
        </div>
```

Leave `<header class="masthead">` exactly as it is — it is the mobile presentation.

- [ ] **Step 4: Add the CSS**

In `custom.css`, change line 22:

```css
    --panel-top: 16px;
```

Then add this block immediately before `/* ---------- Data panel ---------- */`:

```css
/* Desktop: the panel carries the identity, so the floating masthead retires
   and the panel takes over its slot at the top of the map. */
@media (min-width: 960px) {
    .masthead {
        display: none;
    }
}

.panel-brand {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 16px 18px 14px;
    border-bottom: 1px solid var(--divider);
}

.panel-brand__lambang {
    flex-shrink: 0;
    width: 30px;
    height: auto;
}

.panel-brand__copy {
    min-width: 0;
}

.panel-brand__kicker {
    margin: 0;
    font: 600 9.5px var(--font-display);
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--muted-2);
}

.panel-brand__title {
    margin: 2px 0 0;
    font: 700 16px var(--font-display);
    line-height: 1.2;
    color: var(--ink);
}
```

- [ ] **Step 5: Hide the brand on mobile**

Inside `@media (max-width: 959px) { … }`, next to the existing `.masthead` overrides, add:

```css
    .panel-brand {
        display: none;
    }
```

- [ ] **Step 6: Run the assertion — confirm PASS**

Hard-reload first. Expected: `PASS`

- [ ] **Step 7: Check the mobile side did not regress**

Resize to 390x844, reload, then run:

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const brand = document.querySelector('#sidebar .panel-brand');
  const mast = document.querySelector('.masthead');
  check('.panel-brand hidden on mobile', brand && getComputedStyle(brand).display === 'none');
  check('.masthead visible on mobile', mast && getComputedStyle(mast).display !== 'none');
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

Expected: `PASS`. Then resize back to 1280x800.

- [ ] **Step 8: Screenshot**

Take a desktop screenshot. Confirm by eye: one floating card in the top-left, not two.

- [ ] **Step 9: Commit**

```bash
git add index.html custom.css
git commit -m "Merge masthead into the data panel on desktop"
```

---

### Task 2: Full-width search row

**Files:**
- Modify: `index.html:88-102` (`.sidebar-actions`)
- Modify: `custom.css:202-264` (`.sidebar-actions`, `.search-field`, `.secondary-action`)

**Interfaces:**
- Consumes: `.panel-brand` from Task 1 sits above this zone.
- Produces: `.search-field` is full-width inside `.sidebar-header`. `#fit-map` is temporarily parked directly under it and moves into the summary row in Task 4. `#list-search` keeps its id, listeners, and `disabled` wiring.

- [ ] **Step 1: Write the failing assertion**

The bug being fixed is a truncated placeholder, so measure it directly.

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const input = document.getElementById('list-search');
  if (!input) return 'NOT_READY — reload and retry';
  const field = input.closest('.search-field');
  const header = document.querySelector('.sidebar-header');
  check('search field spans the header width',
    Math.abs(field.getBoundingClientRect().width - (header.clientWidth - 36)) < 2);
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + getComputedStyle(input).font;
  probe.textContent = input.placeholder;
  document.body.appendChild(probe);
  const textW = probe.getBoundingClientRect().width;
  probe.remove();
  check('placeholder fits without truncation', textW < input.clientWidth - 44);
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

- [ ] **Step 2: Run it — confirm FAIL**

Expected: `FAIL: search field spans the header width | placeholder fits without truncation`

- [ ] **Step 3: Restructure the markup**

In `index.html`, replace the whole `<div class="sidebar-actions">…</div>` block with:

```html
          <label class="search-field" for="list-search">
            <span class="visually-hidden">Cari titik PUTS</span>
            <span class="search-icon" aria-hidden="true"></span>
            <input
              id="list-search"
              type="search"
              placeholder="Cari nomor, pengusul, alamat..."
              autocomplete="off"
            />
          </label>
```

Note the `<i class="fas fa-search">` is replaced by a `<span>`. Font Awesome was removed from this project; the old `<i>` rendered nothing. Task 2 draws the icon in CSS instead.

- [ ] **Step 4: Update the CSS**

In `custom.css`, delete the `.sidebar-actions` rule (lines 202-205) and replace the `.search-icon` rule with a CSS-drawn magnifier:

```css
.search-field {
    position: relative;
    display: block;
    width: 100%;
}

/* CSS-drawn magnifier: circle + handle. Font Awesome is gone from this
   project, so the old <i class="fas fa-search"> rendered nothing. */
.search-icon {
    position: absolute;
    left: 13px;
    top: 50%;
    width: 10px;
    height: 10px;
    margin-top: -6px;
    border: 1.6px solid var(--muted-2);
    border-radius: 50%;
    pointer-events: none;
}

.search-icon::after {
    content: "";
    position: absolute;
    top: 9px;
    left: 7px;
    width: 1.6px;
    height: 5px;
    border-radius: 1px;
    background: var(--muted-2);
    transform: rotate(-45deg);
    transform-origin: top center;
}
```

Keep `.search-field input`, `::placeholder`, and `:focus-visible` as they are, but widen the left padding to clear the icon:

```css
.search-field input {
    width: 100%;
    height: 40px;
    border: 1px solid var(--hairline-strong);
    border-radius: 10px;
    background: var(--surface);
    padding: 0 12px 0 36px;
    font: 500 14px var(--font-ui);
    color: var(--ink);
}
```

- [ ] **Step 5: Run the assertion — confirm PASS**

Hard-reload first. Expected: `PASS`

- [ ] **Step 6: Confirm search still works**

```js
(() => {
  const input = document.getElementById('list-search');
  input.value = 'bangko';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return new Promise(r => setTimeout(() => {
    const n = document.querySelectorAll('#list-data .item').length;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    r(n > 0 ? 'PASS — ' + n + ' rows' : 'FAIL — search returned nothing');
  }, 500));
})()
```

Expected: `PASS — N rows`. If the tool will not await the promise, run the first three lines, wait, then count rows in a second call.

- [ ] **Step 7: Commit**

```bash
git add index.html custom.css
git commit -m "Give the panel search its own full-width row"
```

---

### Task 3: Segmented control for the grouping toggle

**Files:**
- Modify: `index.html:122-142` (`.group-mode-field`)
- Modify: `custom.css:266-303` (`.group-mode-field`, `.group-mode-label`, `.group-mode`, `.group-mode__btn`)

**Interfaces:**
- Consumes: sits below the search row from Task 2.
- Produces: `.group-mode__btn` keeps its class name, `data-mode` attribute (`nama` / `kabupaten`), `.is-active` class, and `aria-pressed` — so `applyGroupMode()` and `setDataControlsDisabled()` in `custom.js` keep working untouched.

- [ ] **Step 1: Write the failing assertion**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const track = document.querySelector('.group-mode');
  const btns = [...document.querySelectorAll('.group-mode__btn')];
  if (!track) return 'NOT_READY — reload and retry';
  const label = document.querySelector('.group-mode-label');
  check('label shortened to "Kelompok"', label && label.textContent.trim() === 'Kelompok');
  check('label sits on the same row as the track',
    label && Math.abs(label.getBoundingClientRect().top - track.getBoundingClientRect().top) < 20);
  check('track has a tinted background',
    getComputedStyle(track).backgroundColor === 'rgb(236, 245, 255)');
  check('two buttons', btns.length === 2);
  check('active button is yellow-underlined',
    getComputedStyle(btns[0]).borderBottomColor === 'rgb(254, 229, 15)');
  check('active button has a white pill', getComputedStyle(btns[0]).backgroundColor === 'rgb(255, 255, 255)');
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

- [ ] **Step 2: Run it — confirm FAIL**

Expected: `FAIL: label shortened to "Kelompok" | ...`

- [ ] **Step 3: Update the markup**

In `index.html`, replace the `<span class="group-mode-label">` text and keep the rest of the structure:

```html
          <div class="group-mode-field">
            <span class="group-mode-label" id="group-mode-label">Kelompok</span>
            <div class="group-mode" role="group" aria-labelledby="group-mode-label">
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
```

- [ ] **Step 4: Replace the CSS**

Replace the four rules at `custom.css:266-303` with:

```css
.group-mode-field {
    display: flex;
    align-items: center;
    gap: 10px;
}

.group-mode-label {
    flex-shrink: 0;
    font: 500 12px var(--font-ui);
    color: var(--muted-2);
}

.group-mode {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-sm);
    background: var(--blue-tint);
}

.group-mode__btn {
    appearance: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 6px;
    background: none;
    padding: 5px 13px;
    font: 600 12.5px var(--font-display);
    color: var(--muted-2);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
}

.group-mode__btn:not(:disabled):hover {
    color: var(--ink-soft);
}

/* Yellow is the active marker across the whole panel. */
.group-mode__btn.is-active {
    background: var(--surface);
    border-bottom-color: var(--yellow);
    color: var(--ink);
}
```

- [ ] **Step 5: Run the assertion — confirm PASS**

Hard-reload first. Expected: `PASS`

- [ ] **Step 6: Confirm the toggle still switches modes**

```js
(() => {
  const btns = [...document.querySelectorAll('.group-mode__btn')];
  btns[1].click();
  const ok = btns[1].classList.contains('is-active')
    && btns[1].getAttribute('aria-pressed') === 'true'
    && btns[0].getAttribute('aria-pressed') === 'false';
  btns[0].click();
  return ok ? 'PASS' : 'FAIL — mode switch broken';
})()
```

Expected: `PASS`

- [ ] **Step 7: Commit**

```bash
git add index.html custom.css
git commit -m "Turn the grouping toggle into a segmented control"
```

---

### Task 4: Replace the three-stat row with a contextual summary line

**Files:**
- Modify: `index.html:72-87` (`.sidebar-stats`), and move `#fit-map` here
- Modify: `custom.css:170-200` (`.sidebar-stats`, `.stat*`), `custom.css:608-637` (`is-data-unavailable`)
- Modify: `custom.js:191-196` (`setCountsUnknown`), `custom.js:393-396` (element refs), `custom.js:542-551` (`updateGroupStats`), `custom.js:851` (counter write)

**Interfaces:**
- Consumes: sits below the segmented control from Task 3.
- Produces: `renderSummary(matchCount, hasQuery)` — writes `#list-summary`, reading `activeGroup` and `visibleIds` for the rest of its context. Called at the end of `renderList()`. Also produces the helpers `groupNoun()`, `formatCount(value)`, `activeGroupSize()`, and `countMatchedGroups()`. The ids `count-points`, `count-groups`, `count-groups-label`, `count-visible` no longer exist.

- [ ] **Step 1: Write the failing assertion**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const sum = document.getElementById('list-summary');
  if (!document.querySelector('#list-data')) return 'NOT_READY — reload and retry';
  check('#list-summary exists', !!sum);
  check('old stat ids are gone',
    !document.getElementById('count-points') &&
    !document.getElementById('count-groups') &&
    !document.getElementById('count-visible'));
  check('reads "230 titik · 12 pengusul"',
    sum && sum.textContent.trim() === '230 titik · 12 pengusul');
  const fit = document.getElementById('fit-map');
  check('#fit-map shares the summary row',
    fit && sum && Math.abs(fit.getBoundingClientRect().top - sum.getBoundingClientRect().top) < 24);
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

- [ ] **Step 2: Run it — confirm FAIL**

Expected: `FAIL: #list-summary exists | old stat ids are gone | ...`

- [ ] **Step 3: Replace the markup**

In `index.html`, delete the entire `<div class="sidebar-stats">…</div>` block. Then, immediately after the `.group-mode-field` block, add:

```html
          <div class="summary-row">
            <p class="list-summary" id="list-summary">230 titik</p>
            <button id="fit-map" class="link-action" type="button">
              Lihat semua
            </button>
          </div>
```

- [ ] **Step 4: Replace the CSS**

Delete `.sidebar-stats`, `.stat`, `.stat strong`, `.stat--lead strong`, `.stat span` (lines 170-200). Add in their place:

```css
.summary-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
}

.list-summary {
    margin: 0;
    min-width: 0;
    font: 400 12.5px var(--font-ui);
    color: var(--muted);
}

.link-action {
    flex-shrink: 0;
    appearance: none;
    border: none;
    background: none;
    padding: 0;
    font: 600 12.5px var(--font-display);
    color: var(--blue);
    cursor: pointer;
}

.link-action:not(:disabled):hover {
    color: var(--blue-deep);
    text-decoration: underline;
}

.link-action:disabled {
    color: var(--muted-2);
    cursor: default;
}
```

Then repoint the unavailable-data rules (lines 623-637). Delete the `body.is-data-unavailable .sidebar-stats`, `.stat--lead strong`, and `.stat strong` rules and replace with:

```css
/* Unknown counts must not look like a claim of zero. */
body.is-data-unavailable .list-summary {
    color: var(--muted-2);
    font-style: italic;
}
```

- [ ] **Step 5: Rewrite the JS counters**

In `custom.js`, replace `setCountsUnknown()` (lines 191-196) with:

```js
  // Counts are unknown until the data lands. "0" is a claim; this is not.
  function setCountsUnknown() {
    setTextContent("list-summary", "Data titik belum tersedia");
  }
```

Delete the four element refs at lines 393-396 (`countPoints`, `countGroups`, `countGroupsLabel`, `countVisible`) and add one:

```js
    var listSummary = document.getElementById("list-summary");
```

Replace `updateGroupStats()` (lines 542-548) and the two calls beneath it (lines 550-551) with:

```js
    function groupNoun() {
      return groupMode === "kabupaten" ? "kabupaten" : "pengusul";
    }

    function formatCount(value) {
      return value.toLocaleString("id-ID");
    }

    // One line that changes with the situation, instead of three numbers that
    // are usually identical and therefore unreadable.
    function renderSummary(matchCount, hasQuery) {
      if (!listSummary) {
        return;
      }
      var text;
      if (activeGroup) {
        text = hasQuery
          ? formatCount(matchCount) + " dari " + formatCount(activeGroupSize()) +
            " titik · peta difilter ke grup ini"
          : formatCount(matchCount) + " titik · peta difilter ke grup ini";
      } else if (hasQuery) {
        text = matchCount
          ? formatCount(matchCount) + " titik cocok di " +
            formatCount(countMatchedGroups()) + " " + groupNoun()
          : "Tidak ada titik yang cocok";
      } else {
        text = formatCount(items.length) + " titik · " +
          formatCount(groupedItems.length) + " " + groupNoun();
      }
      listSummary.textContent = text;
    }

    function activeGroupSize() {
      for (var i = 0; i < groupedItems.length; i++) {
        if (groupedItems[i].name === activeGroup) {
          return groupedItems[i].items.length;
        }
      }
      return 0;
    }

    // How many groups contributed at least one row to the current result set.
    function countMatchedGroups() {
      var seen = 0;
      groupedItems.forEach(function (group) {
        for (var i = 0; i < group.items.length; i++) {
          if (visibleIds.has(group.items[i].id)) {
            seen += 1;
            return;
          }
        }
      });
      return seen;
    }
```

`renderSummary` reads `visibleIds` and `activeGroup`, both declared at line 558-559 — below where `updateGroupStats` used to sit. That is fine: these are function declarations, hoisted, and only *called* from `renderList()`.

- [ ] **Step 6: Call it from renderList**

In `custom.js`, replace line 851 (`countVisible.textContent = visibleCount.toLocaleString("id-ID");`) with:

```js
      renderSummary(visibleCount, Boolean(normalizedQuery));
```

Then in `applyGroupMode()` (line 1055), replace `updateGroupStats();` with nothing — `renderList()` at the end of that function already refreshes the summary.

- [ ] **Step 7: Verify the disabled-controls wiring still resolves**

`setDataControlsDisabled()` (line 176) targets `#list-search`, `#fit-map`, and `.group-mode__btn`. Tasks 2-4 preserved all three selectors, so this function needs **no edit**. Read it and confirm all three still exist in the markup, then move on. Do not add `aria-live` to `#list-summary`: `#list-data` already carries it (spec §10), and a second live region would double-announce every render.

- [ ] **Step 8: Run the assertion — confirm PASS**

Hard-reload first. Expected: `PASS`

- [ ] **Step 9: Check the summary reacts to state**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const sum = document.getElementById('list-summary');
  check('idle', sum.textContent.trim() === '230 titik · 12 pengusul');
  document.querySelectorAll('.group-mode__btn')[1].click();
  check('kabupaten noun', /kabupaten$/.test(sum.textContent.trim()));
  document.querySelectorAll('.group-mode__btn')[0].click();
  check('back to pengusul', /pengusul$/.test(sum.textContent.trim()));
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

Expected: `PASS`

- [ ] **Step 10: Commit**

```bash
git add index.html custom.css custom.js
git commit -m "Replace the three-stat row with one contextual summary line"
```

---

### Task 5: Drill-down navigation

This is the core change. It rewrites list rendering, deletes the accordion, and deletes the active-filter chip in the same commit — leaving the chip behind would put dead UI on screen.

**Files:**
- Modify: `index.html:104-120` (delete `#active-filter`)
- Modify: `custom.css:305-390` (accordion rules), `custom.css:493-548` (`.active-filter*`)
- Modify: `custom.js:687-867` (`renderList`), `custom.js:964-990` (`setActiveGroup`, `renderActiveFilter`), `custom.js:1028-1033` (chip listener)

**Interfaces:**
- Consumes: `renderSummary(matchCount, hasQuery)` and `groupNoun()` from Task 4.
- Produces: `renderGroupScreen(fragment, normalizedQuery)` and `renderItemScreen(fragment, normalizedQuery)` (both return the visible row count), plus `buildGroupRow(group)`, `buildItemRow(item, needsCoordHint, groupName)`, and `renderPanelNav()`. All are called from `renderList()`. `.group-row` replaces `.group-toggle`. `.panel-back` is the screen-2 back button. `.sidebar-header.is-detail` marks screen 2. Task 6 adds focus management on top.

- [ ] **Step 1: Write the failing assertion**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  if (!document.querySelector('#list-data')) return 'NOT_READY — reload and retry';
  const rows = [...document.querySelectorAll('.group-row')];
  check('12 group rows on screen 1', rows.length === 12);
  check('no items rendered on screen 1', document.querySelectorAll('#list-data .item').length === 0);
  check('no accordion toggles remain', document.querySelectorAll('.group-toggle').length === 0);
  check('active-filter chip is gone from the DOM', !document.getElementById('active-filter'));
  check('count is a bare number', rows[0] && /^\d+$/.test(rows[0].querySelector('.group-row__count').textContent.trim()));
  const target = rows.find(r => r.textContent.includes('Buya Syaparudin'));
  target.click();
  const back = document.querySelector('.panel-back');
  check('back button appears on screen 2', !!back);
  check('back label names the mode', back && back.textContent.includes('Semua pengusul'));
  check('screen 2 title is the group name',
    document.querySelector('.panel-context__title').textContent.trim() === 'Buya Syaparudin');
  check('screen 2 lists 25 items', document.querySelectorAll('#list-data .item').length === 25);
  check('no group rows on screen 2', document.querySelectorAll('.group-row').length === 0);
  check('grouping control is hidden on screen 2',
    getComputedStyle(document.querySelector('.group-mode-field')).display === 'none');
  check('"Lihat semua" is hidden on screen 2', document.getElementById('fit-map').hidden === true);
  const ctxBottom = document.querySelector('.panel-context').getBoundingClientRect().bottom;
  const sumTop = document.getElementById('list-summary').getBoundingClientRect().top;
  const searchTop = document.getElementById('list-search').getBoundingClientRect().top;
  check('screen 2 order is context → summary → search', ctxBottom <= sumTop && sumTop < searchTop);
  if (back) back.click();
  check('back returns to screen 1', document.querySelectorAll('.group-row').length === 12);
  check('grouping control returns on screen 1',
    getComputedStyle(document.querySelector('.group-mode-field')).display !== 'none');
  const s1search = document.getElementById('list-search').getBoundingClientRect().top;
  const s1sum = document.getElementById('list-summary').getBoundingClientRect().top;
  check('screen 1 order is search → summary', s1search < s1sum);
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

- [ ] **Step 2: Run it — confirm FAIL**

Expected: `FAIL: 12 group rows on screen 1 | no items rendered on screen 1 | ...`

- [ ] **Step 3: Delete the chip markup**

In `index.html`, delete the whole `<div id="active-filter" class="active-filter" role="status" hidden>…</div>` block.

- [ ] **Step 4: Split renderList**

In `custom.js`, replace the whole of `renderList` (lines 687-867) with:

```js
    function renderList(query) {
      var normalizedQuery = getNormalizedText(query);
      var fragment = document.createDocumentFragment();

      visibleIds.clear();
      listContainer.innerHTML = "";

      var visibleCount = activeGroup
        ? renderItemScreen(fragment, normalizedQuery)
        : renderGroupScreen(fragment, normalizedQuery);

      renderPanelNav();
      searchInput.placeholder = activeGroup
        ? "Cari di grup ini..."
        : "Cari nomor, pengusul, alamat...";

      listContainer.appendChild(fragment);
      renderSummary(visibleCount, Boolean(normalizedQuery));
      window.lyr_260331_4.changed();
      updateHighlight(activeItemId);
    }

    // Screen 1. With no query: one row per group, no points. With a query:
    // matching points across every group, flat — search is the shortcut past
    // the drill-down, so it must not make you pick a group first.
    function renderGroupScreen(fragment, normalizedQuery) {
      var visibleCount = 0;

      if (normalizedQuery) {
        groupedItems.forEach(function (group) {
          group.items.forEach(function (item) {
            if (item.searchText.indexOf(normalizedQuery) === -1) {
              return;
            }
            visibleIds.add(item.id);
            visibleCount += 1;
          });
        });

        var matched = [];
        groupedItems.forEach(function (group) {
          group.items.forEach(function (item) {
            if (visibleIds.has(item.id)) {
              matched.push({ item: item, groupName: group.name });
            }
          });
        });

        var needsCoordHint = markDuplicates(matched.map(function (entry) {
          return entry.item;
        }));

        matched.forEach(function (entry) {
          fragment.appendChild(
            buildItemRow(entry.item, needsCoordHint, entry.groupName)
          );
        });

        if (!visibleCount) {
          fragment.appendChild(buildEmptyState(true));
        }
        return visibleCount;
      }

      groupedItems.forEach(function (group) {
        group.items.forEach(function (item) {
          visibleIds.add(item.id);
          visibleCount += 1;
        });
        fragment.appendChild(buildGroupRow(group));
      });

      if (!groupedItems.length) {
        fragment.appendChild(buildEmptyState(false));
      }
      return visibleCount;
    }

    // Screen 2. Only the active group contributes rows.
    function renderItemScreen(fragment, normalizedQuery) {
      var group = null;
      for (var i = 0; i < groupedItems.length; i++) {
        if (groupedItems[i].name === activeGroup) {
          group = groupedItems[i];
          break;
        }
      }
      if (!group) {
        activeGroup = null;
        return renderGroupScreen(fragment, normalizedQuery);
      }

      var matchedItems = group.items.filter(function (item) {
        return !normalizedQuery || item.searchText.indexOf(normalizedQuery) !== -1;
      });

      matchedItems.forEach(function (item) {
        visibleIds.add(item.id);
      });

      var needsCoordHint = markDuplicates(matchedItems);
      matchedItems.forEach(function (item) {
        fragment.appendChild(buildItemRow(item, needsCoordHint, null));
      });

      if (!matchedItems.length) {
        fragment.appendChild(buildEmptyState(Boolean(normalizedQuery)));
      }
      return matchedItems.length;
    }
```

- [ ] **Step 5: Add the row builders**

Add these three functions directly beneath `renderItemScreen`:

```js
    function buildGroupRow(group) {
      var row = document.createElement("button");
      var title = document.createElement("span");
      var count = document.createElement("span");
      var chevron = document.createElement("span");

      row.type = "button";
      row.className = "group-row";
      row.dataset.groupName = group.name;
      // The visible count is a bare number so the column lines up; the
      // accessible name still spells out what it counts.
      row.setAttribute(
        "aria-label",
        group.name + ", " + group.items.length + " titik, buka daftar"
      );

      title.className = "group-row__title";
      title.textContent = group.name;

      count.className = "group-row__count";
      count.textContent = String(group.items.length);

      chevron.className = "group-row__chevron";
      chevron.setAttribute("aria-hidden", "true");

      row.appendChild(title);
      row.appendChild(count);
      row.appendChild(chevron);

      row.addEventListener("click", function () {
        setActiveGroup(group.name);
      });

      return row;
    }

    // groupName is passed only on screen 1 search results, where the row has
    // to say which group it came from.
    function buildItemRow(item, needsCoordHint, groupName) {
      var button = document.createElement("button");
      var code = document.createElement("span");
      var copy = document.createElement("span");
      var headline = document.createElement("span");
      var label = document.createElement("span");
      var subline = document.createElement("span");

      button.type = "button";
      button.className = "item";
      button.dataset.itemId = item.id;
      button.title = item.nomor;
      button.setAttribute(
        "aria-label",
        [
          "Titik " + item.display.code,
          item.display.primary,
          item.display.secondary,
          item.nama
        ]
          .filter(Boolean)
          .join(". ")
      );

      code.className = "item-code";
      code.textContent = item.display.code;

      copy.className = "item-copy";
      headline.className = "item-headline";

      label.className = "item-label";
      label.textContent = item.display.primary;
      headline.appendChild(label);

      if (needsCoordHint(item)) {
        var coord = document.createElement("span");
        coord.className = "item-coord";
        coord.textContent = item.koordinatSingkat;
        headline.appendChild(coord);
      }

      subline.className = "item-subline";
      subline.textContent = groupName
        ? item.display.secondary + " · " + groupName
        : item.display.secondary;

      copy.appendChild(headline);
      copy.appendChild(subline);
      button.appendChild(code);
      button.appendChild(copy);

      if (item.id === activeItemId) {
        button.classList.add("is-active");
      }

      button.addEventListener("click", function () {
        focusItem(item, { closePanel: true, zoom: 17 });
      });

      return button;
    }

    // The context header above the list: back button + group name, on screen 2
    // only. Screen 1 has none.
    function renderPanelNav() {
      var header = document.querySelector(".sidebar-header");
      var existing = document.querySelector(".panel-context");
      if (existing) {
        existing.remove();
      }

      // Screen 2 hides two controls: the grouping toggle, because changing how
      // points are grouped from inside one group has no coherent meaning; and
      // "Lihat semua", because the back button already does that job and says
      // so more plainly.
      header.classList.toggle("is-detail", Boolean(activeGroup));
      var fitBtn = document.getElementById("fit-map");
      if (fitBtn) {
        fitBtn.hidden = Boolean(activeGroup);
      }

      if (!activeGroup) {
        return;
      }

      var wrap = document.createElement("div");
      var back = document.createElement("button");
      var title = document.createElement("p");

      wrap.className = "panel-context";

      back.type = "button";
      back.className = "panel-back";
      back.textContent = "Semua " + groupNoun();
      back.addEventListener("click", function () {
        setActiveGroup(null);
      });

      title.className = "panel-context__title";
      title.textContent = activeGroup;

      wrap.appendChild(back);
      wrap.appendChild(title);
      header.insertBefore(wrap, header.firstChild);
    }
```

- [ ] **Step 6: Simplify setActiveGroup and delete the chip logic**

Replace `setActiveGroup` and `renderActiveFilter` (lines 964-990) with:

```js
    function setActiveGroup(name, options) {
      var config = options || {};
      activeGroup = name || null;
      // A query typed on one screen must not leak onto the other.
      searchInput.value = "";
      clearSelection();
      renderList("");
      if (config.fit !== false) {
        fitToVisible({ maxZoom: activeGroup ? 14 : 15 });
      }
    }
```

Delete the `filterClear` listener block (lines 1028-1033) entirely.

Also delete `findGroupToggle()` (lines 869-877) and the `restoreFocusGroup` restore block at the end of the old `renderList` — both are gone with the rewrite. Task 6 adds the replacement focus handling. Leave the `var restoreFocusGroup = null;` declaration at line 560 in place for now; Task 6 uses it.

- [ ] **Step 7: Replace the accordion CSS**

Delete `custom.css:305-390` (`.group`, `.group-toggle`, `.group-chevron`, `.group-title`, `.group-meta`, `.is-filtering`, `.is-muted`, `.group-items`) and `custom.css:493-548` (all `.active-filter*` rules). Add in place of the accordion block:

```css
/* ---------- Screen 1: group rows ---------- */

.group-row {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 10px;
    border: none;
    border-radius: 9px;
    background: none;
    cursor: pointer;
    font: inherit;
    text-align: left;
}

.group-row + .group-row {
    box-shadow: inset 0 1px 0 var(--divider);
}

.group-row:hover,
.group-row:focus-visible {
    background: var(--blue-tint);
    box-shadow: none;
}

.group-row__title {
    flex: 1;
    min-width: 0;
    font: 500 13.5px var(--font-ui);
    color: var(--ink);
}

.group-row__count {
    flex-shrink: 0;
    font: 600 12.5px var(--font-display);
    font-variant-numeric: tabular-nums;
    color: var(--muted);
}

/* Chevron points right: this row takes you somewhere, it does not unfold. */
.group-row__chevron {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    margin-right: 2px;
    border-top: 2px solid var(--blue);
    border-right: 2px solid var(--blue);
    transform: rotate(45deg);
}

/* ---------- Screen 2: context header ---------- */

.panel-context {
    display: grid;
    gap: 2px;
    margin: -18px -18px 0;
    padding: 14px 18px 12px;
    background: var(--blue-tint);
    border-bottom: 1px solid var(--hairline);
}

.panel-back {
    justify-self: start;
    min-height: 24px;
    appearance: none;
    border: none;
    background: none;
    padding: 0 0 0 13px;
    position: relative;
    font: 600 12px var(--font-display);
    color: var(--blue);
    cursor: pointer;
}

.panel-back::before {
    content: "";
    position: absolute;
    left: 1px;
    top: 50%;
    width: 6px;
    height: 6px;
    margin-top: -3px;
    border-left: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg);
}

.panel-back:hover {
    color: var(--blue-deep);
}

.panel-context__title {
    margin: 0;
    font: 700 16px var(--font-display);
    line-height: 1.25;
    color: var(--ink);
}

/* Screen 2 reorders its zones: context header, then the summary that explains
   the filter, then a search box now scoped to this group. The grouping toggle
   has no coherent meaning from inside a single group, so it steps out. */
.sidebar-header.is-detail .group-mode-field {
    display: none;
}

.sidebar-header.is-detail .panel-context {
    order: 1;
}

.sidebar-header.is-detail .summary-row {
    order: 2;
}

.sidebar-header.is-detail .search-field {
    order: 3;
}
```

Two things worth knowing about this block:

- `.sidebar-header` is `display: grid` (line 165). `order` works on grid items exactly as it does on flex items, so no layout mode change is needed to reorder the zones.
- The negative margin on `.panel-context` lets the tinted header bleed to the panel's edges while the element still lives inside `.sidebar-header`'s 18px padding. It relies on `.panel-context` rendering first, which `order: 1` guarantees.

- [ ] **Step 8: Run the assertion — confirm PASS**

Hard-reload first. Expected: `PASS`

- [ ] **Step 9: Confirm the map actually filters**

```js
(() => {
  const rows = [...document.querySelectorAll('.group-row')];
  rows.find(r => r.textContent.includes('Buya Syaparudin')).click();
  const n = document.querySelectorAll('#list-data .item').length;
  const sum = document.getElementById('list-summary').textContent.trim();
  document.querySelector('.panel-back').click();
  return n === 25 && sum === '25 titik · peta difilter ke grup ini'
    ? 'PASS' : 'FAIL — items=' + n + ' summary="' + sum + '"';
})()
```

Expected: `PASS`

- [ ] **Step 10: Screenshot both screens**

Screenshot screen 1. Then click into "Buya Syaparudin", wait ~1.4s, screenshot screen 2. Compare against the approved design: right-pointing chevrons on screen 1, tinted context header on screen 2.

- [ ] **Step 11: Commit**

```bash
git add index.html custom.css custom.js
git commit -m "Replace the sidebar accordion with two-screen drill-down"
```

---

### Task 6: Search scoping and focus management

**Files:**
- Modify: `custom.js` — `setActiveGroup`, `renderList`, `buildEmptyState`

**Interfaces:**
- Consumes: `renderGroupScreen` / `renderItemScreen` / `buildGroupRow` from Task 5, `restoreFocusGroup` (line 560).
- Produces: nothing new. This task completes Task 5's behaviour.

- [ ] **Step 1: Write the failing assertion**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const rows = [...document.querySelectorAll('.group-row')];
  if (!rows.length) return 'NOT_READY — reload and retry';
  rows.find(r => r.textContent.includes('Buya Syaparudin')).click();
  check('focus moves to the back button',
    document.activeElement === document.querySelector('.panel-back'));
  check('placeholder scoped to the group',
    document.getElementById('list-search').placeholder === 'Cari di grup ini...');
  document.querySelector('.panel-back').click();
  const restored = document.activeElement;
  check('focus returns to the originating row',
    restored && restored.classList.contains('group-row') &&
    restored.textContent.includes('Buya Syaparudin'));
  check('placeholder restored',
    document.getElementById('list-search').placeholder === 'Cari nomor, pengusul, alamat...');
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

- [ ] **Step 2: Run it — confirm FAIL**

Expected: `FAIL: focus moves to the back button | focus returns to the originating row`

- [ ] **Step 3: Record where the user came from**

In `custom.js`, update `setActiveGroup` to remember the origin group before changing screens:

```js
    function setActiveGroup(name, options) {
      var config = options || {};
      // Remember the row we are leaving so Back can hand focus straight back
      // to it — innerHTML wiping destroys the node the user just activated.
      restoreFocusGroup = name ? null : activeGroup;
      activeGroup = name || null;
      searchInput.value = "";
      clearSelection();
      renderList("");
      moveFocusForScreen();
      if (config.fit !== false) {
        fitToVisible({ maxZoom: activeGroup ? 14 : 15 });
      }
    }

    function moveFocusForScreen() {
      if (activeGroup) {
        var back = document.querySelector(".panel-back");
        if (back) {
          back.focus();
        }
        return;
      }
      if (!restoreFocusGroup) {
        return;
      }
      var rows = listContainer.querySelectorAll(".group-row");
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].dataset.groupName === restoreFocusGroup) {
          rows[i].focus();
          break;
        }
      }
      restoreFocusGroup = null;
    }
```

- [ ] **Step 4: Fix the empty-state escape hatch**

`buildEmptyState` still calls `setActiveGroup(null, { fit: false })`, which now also clears the search box — that would throw away the query the user is trying to widen. Replace the `hasQuery && activeGroup` branch (lines 887-897) with:

```js
      if (hasQuery && activeGroup) {
        copy.textContent =
          "Tidak ada titik yang cocok di dalam " + activeGroup + ".";
        var widen = document.createElement("button");
        widen.type = "button";
        widen.className = "secondary-action";
        widen.textContent = "Cari di semua titik";
        widen.addEventListener("click", function () {
          // Keep the query: the point of this button is to widen the same
          // search, not to start over.
          var carried = searchInput.value;
          activeGroup = null;
          restoreFocusGroup = null;
          clearSelection();
          searchInput.value = carried;
          renderList(carried);
          fitToVisible({ maxZoom: 16, duration: 500 });
        });
        wrap.appendChild(widen);
      } else if (hasQuery) {
```

- [ ] **Step 5: Run the assertion — confirm PASS**

Hard-reload first. Expected: `PASS`

- [ ] **Step 6: Verify search scoping in both directions**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const input = document.getElementById('list-search');
  const type = v => { input.value = v; input.dispatchEvent(new Event('input', {bubbles:true})); };
  const rows = () => document.querySelectorAll('#list-data .item').length;
  type('limbur');
  return new Promise(r => setTimeout(() => {
    const wide = rows();
    check('screen 1 search returns flat item rows', wide > 0);
    check('screen 1 search shows no group rows',
      document.querySelectorAll('.group-row').length === 0);
    check('screen 1 result rows name their group',
      document.querySelector('.item-subline').textContent.includes('·'));
    type('');
    setTimeout(() => {
      document.querySelectorAll('.group-row')[2].click();
      const inGroup = rows();
      check('drilling in resets the query', input.value === '');
      check('group screen shows its own items', inGroup > 0 && inGroup < wide + 1);
      document.querySelector('.panel-back').click();
      r(fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS');
    }, 400);
  }, 400));
})()
```

Expected: `PASS`. If the tool will not await promises, run each phase as a separate call with a pause between.

- [ ] **Step 7: Commit**

```bash
git add custom.js
git commit -m "Scope panel search per screen and hand focus across the drill-down"
```

---

### Task 7: Mobile bottom sheet

**Files:**
- Modify: `custom.css:1151-1408` (the `@media (max-width: 959px)` block)

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: nothing new. Sheet mechanics (`--sheet-peek`, `#sheet-handle`, `is-panel-open`, `is-popup-open`, the `translate3d` animation) are unchanged.

- [ ] **Step 1: Write the failing assertion**

Resize to 390x844 and reload first.

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const rows = [...document.querySelectorAll('.group-row')];
  if (!rows.length) return 'NOT_READY — reload and retry';
  check('group rows are at least 44px tall', rows[0].getBoundingClientRect().height >= 44);
  const sheet = document.getElementById('sidebar');
  const peek = sheet.getBoundingClientRect().top;
  const search = document.getElementById('list-search').getBoundingClientRect();
  const mode = document.querySelector('.group-mode').getBoundingClientRect();
  check('search is inside the peek area', search.bottom < window.innerHeight);
  check('grouping control is inside the peek area', mode.bottom < window.innerHeight);
  check('at least part of the first row peeks', rows[0].getBoundingClientRect().top < window.innerHeight);
  rows[0].click();
  const back = document.querySelector('.panel-back');
  check('drill-down works on mobile', !!back);
  check('back button is 44px tall', back && back.getBoundingClientRect().height >= 44);
  if (back) back.click();
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

- [ ] **Step 2: Run it — confirm FAIL**

Expected at minimum: `FAIL: back button is 44px tall`

- [ ] **Step 3: Add the mobile rules**

Inside `@media (max-width: 959px) { … }`, alongside the existing `.panel-brand { display: none; }` from Task 1, add:

```css
    /* Peek shows search + grouping + a sliver of the first row, which is more
       use than the stat row that used to sit here. */
    .sidebar-header {
        gap: 11px;
        padding: 4px 16px 0;
    }

    .group-row {
        min-height: 48px;
        padding: 13px 10px;
    }

    .panel-back {
        min-height: 44px;
        display: flex;
        align-items: center;
    }

    .panel-context {
        margin: -4px -16px 0;
        padding: 10px 16px 12px;
    }

    .summary-row {
        gap: 12px;
    }

    .item {
        min-height: 48px;
        padding: 11px 10px;
    }
```

- [ ] **Step 4: Run the assertion — confirm PASS**

Reload at 390x844. Expected: `PASS`

- [ ] **Step 5: Verify the sheet still opens, closes, and yields to the popup**

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  document.getElementById('sheet-handle').click();
  check('sheet opens', document.body.classList.contains('is-panel-open'));
  document.querySelectorAll('.group-row')[0].click();
  check('still open after drilling in', document.body.classList.contains('is-panel-open'));
  document.querySelectorAll('#list-data .item')[0].click();
  check('picking a point closes the sheet', !document.body.classList.contains('is-panel-open'));
  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

Expected: `PASS`

- [ ] **Step 6: Screenshot**

Wait ~1.4s after the item click (map fly-to races the screenshot), then capture. Confirm: masthead bar still on top of the map, popup docked, sheet down.

- [ ] **Step 7: Commit**

```bash
git add custom.css
git commit -m "Fit the drill-down panel to the mobile bottom sheet"
```

---

### Task 8: Cache-bust and full acceptance pass

**Files:**
- Modify: `index.html` (every `?v=` token)

**Interfaces:**
- Consumes: everything.
- Produces: shippable state.

- [ ] **Step 1: Bump every asset version token**

`index.html` carries `?v=202607291314` on every stylesheet, script, and the favicon. Replace all of them with a single new token:

```bash
cd /Users/dany/WEB-DEV/surveypjuts
python3 - <<'PY'
import re, pathlib
p = pathlib.Path("index.html")
s = p.read_text()
s2, n = re.subn(r"\?v=\d{10,12}[a-z]?", "?v=202607291500", s)
p.write_text(s2)
print("replaced", n, "tokens")
PY
```

Expected output: `replaced 24 tokens` (verify the number is non-zero and that no `?v=` of the old value survives).

- [ ] **Step 2: Confirm no stale tokens remain**

```bash
grep -c '202607291314' index.html || echo "0 stale tokens — good"
```

Expected: `0 stale tokens — good`

- [ ] **Step 3: Also add the version to the new brand image**

Task 1 added `./assets/lambang-jambi.svg` with no version token. Give it one so it matches the convention:

```bash
python3 - <<'PY'
import pathlib
p = pathlib.Path("index.html")
s = p.read_text()
s = s.replace('src="./assets/lambang-jambi.svg"', 'src="./assets/lambang-jambi.svg?v=202607291500"')
p.write_text(s)
print("brand image versioned")
PY
```

- [ ] **Step 4: Run the full acceptance suite (spec §13, criteria 1-7 and 9-10)**

Desktop 1280x800, hard-reload, then:

```js
(() => {
  const fails = [];
  const check = (name, cond) => { if (!cond) fails.push(name); };
  const sum = () => document.getElementById('list-summary').textContent.trim();
  const rows = () => [...document.querySelectorAll('.group-row')];
  const items = () => document.querySelectorAll('#list-data .item').length;
  if (!rows().length) return 'NOT_READY — reload and retry';

  check('1. 12 group rows', rows().length === 12);
  check('1. chevrons present', !!document.querySelector('.group-row__chevron'));
  check('1. summary', sum() === '230 titik · 12 pengusul');

  rows().find(r => r.textContent.includes('Buya Syaparudin')).click();
  check('2. screen 2 title', document.querySelector('.panel-context__title').textContent.trim() === 'Buya Syaparudin');
  check('2. 25 items', items() === 25);
  check('2. summary', sum() === '25 titik · peta difilter ke grup ini');

  document.querySelector('.panel-back').click();
  check('3. back to 12 rows', rows().length === 12);
  check('3. focus restored', document.activeElement.textContent.includes('Buya Syaparudin'));

  check('6. mode switch resets to screen 1', (() => {
    rows()[0].click();
    document.querySelectorAll('.group-mode__btn')[1].click();
    const ok = document.querySelectorAll('.group-row').length > 0
      && !document.querySelector('.panel-context');
    document.querySelectorAll('.group-mode__btn')[0].click();
    return ok;
  })());

  const inp = document.getElementById('list-search');
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + getComputedStyle(inp).font;
  probe.textContent = inp.placeholder;
  document.body.appendChild(probe);
  check('7. placeholder not truncated', probe.getBoundingClientRect().width < inp.clientWidth - 44);
  probe.remove();

  return fails.length ? 'FAIL: ' + fails.join(' | ') : 'PASS';
})()
```

Expected: `PASS`

- [ ] **Step 5: Criteria 4 and 5 — search on both screens**

```js
(() => {
  const inp = document.getElementById('list-search');
  inp.value = 'limbur';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return new Promise(r => setTimeout(() => {
    const s = document.getElementById('list-summary').textContent.trim();
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    r(/^\d+ titik cocok di \d+ pengusul$/.test(s) ? 'PASS — ' + s : 'FAIL — "' + s + '"');
  }, 500));
})()
```

Expected: `PASS — N titik cocok di M pengusul`

- [ ] **Step 6: Criterion 9 — console clean**

Read console messages with `onlyErrors: true`. Expected: no errors. Tile-loading warnings from Google's basemap are pre-existing and not a failure.

- [ ] **Step 7: Criterion 8 — mobile pass**

Resize to 390x844, reload, and re-run the Task 7 Step 1 and Step 5 assertions. Both must return `PASS`.

- [ ] **Step 8: Criterion 10 — keyboard walk**

With the desktop viewport, click the panel and press Tab repeatedly. Confirm by observation that focus reaches: search input → both grouping buttons → "Lihat semua" → each group row, and that Enter on a group row drills in and lands focus on the back button.

```js
(() => {
  const order = [...document.querySelectorAll('#sidebar button, #sidebar input')]
    .filter(el => !el.disabled && el.offsetParent !== null)
    .map(el => el.id || el.className);
  return order.join(' → ');
})()
```

Record the output in the commit message if anything looks out of order.

- [ ] **Step 9: Final screenshots**

Desktop screen 1, desktop screen 2, mobile peek, mobile expanded.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "Bump asset version tokens for the sidebar redesign"
```

---

## Rollback

Every task is one commit and the site is static — no migrations, no state. To back out a single task, `git revert <sha>`. To back out the whole redesign, revert the range from the Task 1 commit to the Task 8 commit. The spec commit (`a029add`) is documentation only and can stay.

## Dead code to check at the end

These become unreferenced during the work. Confirm with a search before deleting, and do it in the Task 8 commit if found:

- `.group`, `.group-toggle`, `.group-chevron`, `.group-title`, `.group-meta`, `.group-items` — removed in Task 5.
- `.active-filter`, `.active-filter__label`, `.active-filter__value`, `.active-filter__clear` — removed in Task 5.
- `.sidebar-stats`, `.stat`, `.stat--lead` — removed in Task 4.
- `.secondary-action` — still used by `buildEmptyState` and `showDataLoadError`. **Keep it.**
- `resources/fontawesome-all.min.css` and `webfonts/` — already dead before this work started (Font Awesome was removed in an earlier session). Out of scope; leave them.

Search with `python3`, not `grep -r` — recursive grep trips ENOSPC in this environment, and `head` is shadowed by an unrelated HTTP tool.
