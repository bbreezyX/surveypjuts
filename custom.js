(function () {
  function getNormalizedText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toDisplayCase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  // Degree suffixes that must stay uppercase when title-casing names
  // ("PUTRA ABSOR HASIBUAN, SH" -> "Putra Absor Hasibuan, SH").
  var NAME_SUFFIXES = ["sh", "se", "st", "sp", "mm", "mh", "msi", "mpd", "spd", "skom", "ssos", "amd", "shut"];

  function toDisplayName(value) {
    return String(value || "")
      .trim()
      .split(/\s+/)
      .map(function (word) {
        var letters = word.replace(/[^a-z]/gi, "").toLowerCase();
        if (NAME_SUFFIXES.indexOf(letters) !== -1) {
          return word.toUpperCase();
        }
        return toDisplayCase(word);
      })
      .join(" ");
  }

  function sanitizeMediaPath(value) {
    return String(value || "").replace(/[\\/:]/g, "_").trim();
  }

  function getCollator() {
    return new Intl.Collator("id", {
      numeric: true,
      sensitivity: "base",
    });
  }

  // Keterangan doubles as the row's title, but some rows carry survey
  // bookkeeping in brackets — "(Foto pertama yang dikirim pak agung)",
  // "(Tanpa Foto (Tempat Pemandian 1,2,3))". That says nothing about the place
  // and wraps the label onto five lines, so it goes. Brackets that qualify the
  // landmark itself are kept: "Depan Rumah Pak Hambali (Dewan)" survives.
  //
  // The lookahead only fires when the bracket's own text mentions the photo
  // workflow; everything from that bracket to the end is then dropped, which
  // also disposes of nested brackets in one pass.
  var SURVEY_NOTE = /\s*\((?=[^)]*(?:foto|dikirim))[\s\S]*$/i;

  // One Kerinci surveyor pasted their GPS app's log in wholesale — "Titik (1)
  // — Survey Pemasangan PUTS; alamat GPS: Kemantan Darat; Jumat, 19 Juni 2026
  // 09:26; elevasi 812.1 m". Only the "alamat GPS" segment names a place; the
  // rest is a timestamp and an altimeter reading already covered by the
  // Dokumentasi and Koordinat rows. Logs without that segment name nothing at
  // all, so they collapse to "" and let the desa take the title.
  var GPS_LOG = /survey pemasangan|alamat gps:|elevasi\s/i;
  var GPS_ADDRESS = /alamat gps:\s*([^;]+)/i;
  // Some addresses lead with a plus code: "3922+RMF Desa Talang Tinggi".
  var PLUS_CODE = /^[a-z0-9]{4}\+[a-z0-9]{2,3}[\s,]*/i;

  // Spellings that reached the sheet as the surveyor typed them. Whole-word so
  // "Smp" becomes "SMP" without touching a name that merely contains it.
  var SPELLING_FIXES = [
    [/\bmadrash\b/gi, "Madrasah"],
    [/\balternatip\b/gi, "Alternatif"],
    [/\brmh\b/gi, "Rumah"],
    [/\bsmp\b/gi, "SMP"],
    [/\bJl\.(?=\S)/g, "Jl. "]
  ];

  function cleanKeterangan(value) {
    var text = String(value || "").replace(SURVEY_NOTE, "").trim();
    if (GPS_LOG.test(text)) {
      var address = text.match(GPS_ADDRESS);
      text = address ? address[1].trim().replace(PLUS_CODE, "") : "";
    }
    for (var i = 0; i < SPELLING_FIXES.length; i++) {
      text = text.replace(SPELLING_FIXES[i][0], SPELLING_FIXES[i][1]);
    }
    return text.replace(/\s{2,}/g, " ").trim();
  }

  // "RT 11" / "Rt.05" is an address detail, not a place: 54 rows carry one as
  // their entire Keterangan and ten collide on "RT 12" alone. It stays in the
  // Keterangan row — where it reads correctly — but the desa takes the title.
  var BARE_RT = /^rt[\s.]*\d+$/i;

  function isUsableTitle(text) {
    return Boolean(text) && !BARE_RT.test(text);
  }

  // Nomor is "KABUPATEN-KECAMATAN-DESA-NNN". The desa repeats across most of a
  // group's points (223/230 rows would be identical on desa alone), so the
  // survey landmark in Keterangan is the primary label whenever it exists and
  // the desa drops to context. Rows that still collide get a coordinate hint
  // appended at render time — see markDuplicates().
  function buildDisplayParts(nomor, keterangan) {
    var parts = String(nomor || "")
      .split("-")
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
    var lastPart = parts[parts.length - 1] || "";
    var code = /^\d+$/.test(lastPart) ? lastPart : "";

    if (code) {
      parts.pop();
    }

    var desa = parts.length ? toDisplayCase(parts[parts.length - 1]) : "";
    var kecamatan = parts.length > 1 ? toDisplayCase(parts[parts.length - 2]) : "";
    var landmark = cleanKeterangan(keterangan);

    var primary;
    var secondary;

    if (isUsableTitle(landmark)) {
      primary = landmark;
      secondary = [desa, kecamatan].filter(Boolean).join(" · ");
    } else {
      primary = desa || String(nomor || "Titik");
      secondary = kecamatan;
    }

    return {
      code: code || "—",
      primary: primary,
      secondary: secondary || "Lokasi survey lapangan",
    };
  }

  // Within a rendered group, flag every row whose primary label is shared with
  // another row so it can carry a coordinate tiebreaker. Clean rows stay clean.
  function markDuplicates(list) {
    var tally = Object.create(null);
    list.forEach(function (item) {
      var key = item.display.primary;
      tally[key] = (tally[key] || 0) + 1;
    });
    return function (item) {
      return tally[item.display.primary] > 1;
    };
  }

  function buildPopupHtml(item) {
    var rows = [];
    var photoPath = item.photo ? sanitizeMediaPath(item.photo) : "";

    var fieldIcons = {
      nama: '<i class="fas fa-user-check"></i>',
      alamat: '<i class="fas fa-map-marker-alt"></i>',
      koordinat: '<i class="fas fa-crosshairs"></i>',
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
    if (item.koordinat) {
      rows.push(metaRow(fieldIcons.koordinat, "Koordinat", item.koordinat));
    }
    if (item.tanggal) {
      rows.push(metaRow(fieldIcons.tanggal, "Dokumentasi", item.tanggal));
    }
    // The landmark is now the popup's own title, so repeating it as a meta row
    // would just say the same thing twice.
    if (item.keterangan && item.keterangan !== item.display.primary) {
      rows.push(metaRow(fieldIcons.keterangan, "Keterangan", item.keterangan));
    }

    var kicker =
      "Titik " + escapeHtml(item.display.code) +
      (item.kabupaten ? " · " + escapeHtml(item.kabupaten) : "");

    return (
      '<div class="feature-popup">' +
      // No loading="lazy" here: the card is only built at the moment it opens,
      // so the photo is always already in view and lazy only defers the fetch
      // behind a visibility check it is guaranteed to pass. decoding="async"
      // does the useful work instead — source photos run to 1600x1200 and the
      // slot is 312px wide, so a synchronous decode would stall the frame.
      (photoPath
        ? '<div class="feature-popup__media">' +
          '<img src="images/' + encodeURI(photoPath) + '" alt="Foto lokasi ' + escapeHtml(item.nomor) + '" decoding="async" />' +
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

  function hidePopup() {
    var popup = document.getElementById("popup");
    var popupContent = document.getElementById("popup-content");

    if (popup) {
      popup.style.display = "none";
    }
    document.body.classList.remove("is-popup-open");
    if (popupContent) {
      popupContent.innerHTML = "";
    }
    if (window.overlayPopup && typeof window.overlayPopup.setPosition === "function") {
      window.overlayPopup.setPosition(undefined);
    }
    if (typeof window.stopMediaInPopup === "function") {
      window.stopMediaInPopup();
    }
  }

  function setTextContent(id, value) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function setDataControlsDisabled(isDisabled) {
    ["list-search", "fit-map"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.disabled = isDisabled;
      }
    });
    // The grouping tabs only get their listeners inside init(), so before data
    // lands they are decoration — disable them too rather than leave dead
    // controls that look live.
    document.querySelectorAll(".group-mode__btn").forEach(function (node) {
      node.disabled = isDisabled;
    });
    document.body.classList.toggle("is-data-unavailable", isDisabled);
  }

  // Counts are unknown until the data lands. "0" is a claim; this is not.
  function setCountsUnknown() {
    setTextContent("list-summary", "Data titik belum tersedia");
  }

  function showDataLoading() {
    var listContainer = document.getElementById("list-data");

    setCountsUnknown();
    setDataControlsDisabled(true);

    if (!listContainer) {
      return;
    }

    var wrap = document.createElement("div");
    wrap.className = "data-loading";

    var note = document.createElement("p");
    note.className = "data-loading__note";
    note.textContent = "Memuat titik survey…";
    wrap.appendChild(note);

    // Skeleton rows mirror the real row shape so nothing jumps when they are
    // replaced by data.
    for (var i = 0; i < 6; i++) {
      var row = document.createElement("div");
      row.className = "skeleton-row";
      var code = document.createElement("span");
      code.className = "skeleton skeleton--code";
      var copy = document.createElement("span");
      copy.className = "skeleton-row__copy";
      var label = document.createElement("span");
      label.className = "skeleton skeleton--label";
      var sub = document.createElement("span");
      sub.className = "skeleton skeleton--sub";
      copy.appendChild(label);
      copy.appendChild(sub);
      row.appendChild(code);
      row.appendChild(copy);
      wrap.appendChild(row);
    }

    listContainer.replaceChildren(wrap);
  }

  function showDataLoadError(message, onRetry) {
    var listContainer = document.getElementById("list-data");

    setCountsUnknown();
    setDataControlsDisabled(true);
    hidePopup();

    if (!listContainer) {
      return;
    }

    var errorNode = document.createElement("div");
    var title = document.createElement("p");
    var copy = document.createElement("p");
    var action = document.createElement("button");

    errorNode.className = "data-error";
    errorNode.setAttribute("role", "alert");

    title.className = "data-error__title";
    title.textContent = "Data titik belum bisa dimuat";

    copy.className = "data-error__copy";
    copy.textContent = message ||
      "Periksa koneksi dan file data/points.geojson, lalu coba lagi.";

    action.type = "button";
    action.className = "secondary-action data-error__action";
    action.textContent = onRetry ? "Coba lagi" : "Muat ulang halaman";
    action.addEventListener("click", function () {
      if (onRetry) {
        onRetry();
      } else {
        window.location.reload();
      }
    });

    errorNode.appendChild(title);
    errorNode.appendChild(copy);
    errorNode.appendChild(action);
    listContainer.replaceChildren(errorNode);
  }

  function isMobileViewport() {
    return window.innerWidth < 960;
  }

  function setPanelOpen(isOpen) {
    if (isOpen && isMobileViewport()) {
      hidePopup();
    }
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

  function configurePopupOverlayForViewport() {
    if (!window.overlayPopup) {
      return;
    }
    // Mobile popup is position:fixed and we pan manually — OL autoPan fights
    // that animation and makes the bottom sheet feel stuck.
    window.overlayPopup.autoPan = isMobileViewport()
      ? false
      : { animation: { duration: 300 }, margin: 60 };
  }

  // ---------- Map control chrome ----------

  var LAYER_ICON =
    '<svg class="ctl-layers" xmlns="http://www.w3.org/2000/svg" ' +
    'viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path class="ctl-layers__top" d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>' +
    '<path class="ctl-layers__mid" d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>' +
    '<path class="ctl-layers__bottom" d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>' +
    "</svg>";

  // Native title tooltips are slow, unstyleable, and would sit next to ours.
  // The layer switcher re-adds its own on every panel toggle
  // (ol-layerswitcher.js:203,208), so strip on the way in, not once at setup.
  function stripNativeTitle(node) {
    node.removeAttribute("title");
    node.addEventListener("pointerenter", function () {
      if (node.hasAttribute("title")) {
        node.removeAttribute("title");
      }
    });
  }

  // "Alive when the cursor heads over there." A CSS-only version means
  // widening a pseudo-element to catch the pointer early, which also steals
  // pan and drag from the map inside that band — and 14px of reach would not
  // read as approach anyway. 90px does.
  function initControlProximity(targets) {
    if (!targets.length || !window.matchMedia) {
      return;
    }
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    var NEAR = 90;
    var rects = [];
    var stale = true;
    var queued = false;
    var pointerX = 0;
    var pointerY = 0;

    function apply() {
      queued = false;
      // Cached, because measuring on every frame forces a layout flush on
      // top of whatever the map is already painting.
      if (stale) {
        rects = targets.map(function (node) {
          return node.getBoundingClientRect();
        });
        stale = false;
      }
      for (var i = 0; i < targets.length; i++) {
        var rect = rects[i];
        if (!rect || !rect.width) {
          continue;
        }
        var dx = Math.max(rect.left - pointerX, 0, pointerX - rect.right);
        var dy = Math.max(rect.top - pointerY, 0, pointerY - rect.bottom);
        targets[i].classList.toggle("is-near", dx * dx + dy * dy <= NEAR * NEAR);
      }
    }

    function invalidate() {
      stale = true;
    }

    window.addEventListener(
      "pointermove",
      function (event) {
        if (event.pointerType && event.pointerType !== "mouse") {
          return;
        }
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (queued) {
          return;
        }
        queued = true;
        requestAnimationFrame(apply);
      },
      { passive: true }
    );

    // The controls only move on resize and when the sidebar collapse
    // animation repositions the panel toggle.
    window.addEventListener("resize", invalidate);
    targets.forEach(function (node) {
      node.addEventListener("transitionend", invalidate);
    });

    document.addEventListener("pointerleave", function () {
      targets.forEach(function (node) {
        node.classList.remove("is-near");
      });
    });
  }

  function enhanceMapControls() {
    var shell = document.querySelector(".app-shell");
    var zoom = document.querySelector(".ol-zoom");
    var scale = document.querySelector(".ol-scale-line");
    var attribution = document.querySelector(".bottom-attribution");
    var switcher = document.querySelector(".layer-switcher");

    // qgis2web docks zoom, scale and attribution as three separate fixed
    // boxes held in line by hand-tuned offsets. Re-parent them under one
    // anchor: the rail keeps full chrome, the metadata drops to a flat strip.
    if (shell && (zoom || scale || attribution)) {
      var meta = document.createElement("div");
      meta.className = "map-meta";
      var info = document.createElement("div");
      info.className = "map-meta__info";
      if (zoom) {
        meta.appendChild(zoom);
      }
      if (scale) {
        info.appendChild(scale);
      }
      if (attribution) {
        info.appendChild(attribution);
      }
      if (info.childNodes.length) {
        meta.appendChild(info);
      }
      shell.appendChild(meta);
    }

    if (zoom) {
      // The vendor renders bare "+"/"−" text nodes. Wrap them so the glyph
      // can be scaled without scaling the button box along with it.
      [
        { selector: ".ol-zoom-in", label: "Perbesar" },
        { selector: ".ol-zoom-out", label: "Perkecil" }
      ].forEach(function (entry) {
        var button = zoom.querySelector(entry.selector);
        if (!button) {
          return;
        }
        var glyph = document.createElement("span");
        glyph.className = "ctl-glyph";
        glyph.setAttribute("aria-hidden", "true");
        glyph.textContent = button.textContent;
        button.textContent = "";
        button.appendChild(glyph);
        // Replaces the vendor's English title, which was the only label a
        // screen reader had beyond the bare "+" glyph.
        button.setAttribute("aria-label", entry.label);
        button.setAttribute("data-tooltip", entry.label);
        stripNativeTitle(button);
      });
    }

    if (switcher) {
      var switcherButton = switcher.querySelector(":scope > button");
      if (switcherButton) {
        switcherButton.setAttribute("data-tooltip", "Layer peta");
        // aria-label is left alone here — the vendor keeps it in sync with
        // the open/closed state and its tipLabels are already Indonesian.
        stripNativeTitle(switcherButton);
        var slot = document.createElement("span");
        slot.className = "ctl-layers-slot";
        slot.setAttribute("aria-hidden", "true");
        slot.innerHTML = LAYER_ICON;
        switcherButton.insertAdjacentElement("afterend", slot);
      }
    }

    initControlProximity(
      [zoom, switcher, document.getElementById("panel-toggle")].filter(Boolean)
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    var hasInitialised = false;
    var loadWatchdog = null;

    if (!window.map || !window.lyr_260331_4) {
      // Nothing to retry against — the map itself never came up.
      showDataLoadError("Peta atau layer titik tidak berhasil diinisialisasi.");
      return;
    }

    // Control chrome does not depend on the point data, so it runs here
    // rather than in init() — which only fires once the GeoJSON lands.
    enhanceMapControls();

    var pointSource = window.lyr_260331_4.getSource();

    function retryDataLoad() {
      showDataLoading();
      armWatchdog();
      pointSource.refresh();
    }

    function failDataLoad(message) {
      if (hasInitialised) {
        return;
      }
      disarmWatchdog();
      showDataLoadError(message, retryDataLoad);
    }

    // OpenLayers only runs a vector source's loader while the layer is being
    // rendered, and a hidden tab never renders. Counting wall-clock time would
    // therefore "time out" a page that is merely sitting in a background tab
    // with a perfectly healthy network — so the watchdog only runs while the
    // document is actually visible.
    function armWatchdog() {
      if (hasInitialised || loadWatchdog !== null || document.hidden) {
        return;
      }
      loadWatchdog = window.setTimeout(function () {
        loadWatchdog = null;
        if (!hasInitialised && !pointSource.getFeatures().length) {
          failDataLoad(
            "File data/points.geojson belum selesai dimuat setelah 20 detik."
          );
        }
      }, 20000);
    }

    function disarmWatchdog() {
      if (loadWatchdog !== null) {
        window.clearTimeout(loadWatchdog);
        loadWatchdog = null;
      }
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        disarmWatchdog();
        return;
      }
      if (hasInitialised) {
        return;
      }
      // Back in view: the layer will render and the loader will finally run.
      // Give it a fresh window, and pick up data that arrived meanwhile.
      runInit();
      armWatchdog();
    });

    if (typeof window.onSingleClickFeatures === "function") {
      window.map.un("singleclick", window.onSingleClickFeatures);
    }
    if (typeof window.onSingleClickWMS === "function") {
      window.map.un("singleclick", window.onSingleClickWMS);
    }

    function init() {
    var collator = getCollator();
    var allFeatures = pointSource.getFeatures().slice();
    var listContainer = document.getElementById("list-data");
    var searchInput = document.getElementById("list-search");
    var fitButton = document.getElementById("fit-map");
    var panelToggle = document.getElementById("panel-toggle");
    var panelClose = document.getElementById("sidebar-close");
    var listSummary = document.getElementById("list-summary");
    var popup = document.getElementById("popup");
    var popupContent = document.getElementById("popup-content");

    var activeItemId = null;

    // Selected pin: enlarged with a white ring, drawn on the feature overlay
    // above the layer's yellow pin.
    var selectedPinSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="43" viewBox="-2 -4 40 52">' +
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

    // Resolve each point's kabupaten/kota by which boundary polygon contains it
    // (authoritative — avoids the messy Nomor prefix). Falls back to the Nomor
    // prefix, then "Lainnya".
    var kabupatenPolygons = window.lyr_BatasKabupaten2011_1
      ? window.lyr_BatasKabupaten2011_1.getSource().getFeatures()
      : [];

    function resolveKabupaten(feature) {
      var geom = feature.getGeometry();
      if (!geom) {
        return "Lainnya";
      }
      var ext = geom.getExtent();
      var coord = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
      for (var i = 0; i < kabupatenPolygons.length; i++) {
        var pg = kabupatenPolygons[i].getGeometry();
        if (pg && pg.intersectsCoordinate(coord)) {
          return toDisplayCase(String(kabupatenPolygons[i].get("KABUPATEN_") || ""));
        }
      }
      // Outside every polygon (a point sitting just off the boundary): snap to
      // the nearest kabupaten so it never forms a stray single-point group.
      var nearest = null;
      var nearestDist = Infinity;
      for (var j = 0; j < kabupatenPolygons.length; j++) {
        var pg2 = kabupatenPolygons[j].getGeometry();
        if (!pg2) {
          continue;
        }
        var cp = pg2.getClosestPoint(coord);
        var dx = cp[0] - coord[0];
        var dy = cp[1] - coord[1];
        var d = dx * dx + dy * dy;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = kabupatenPolygons[j];
        }
      }
      if (nearest) {
        return toDisplayCase(String(nearest.get("KABUPATEN_") || ""));
      }
      var prefix = String(feature.get("Nomor") || "").split("-")[0].trim();
      return prefix ? toDisplayCase(prefix) : "Lainnya";
    }

    var items = allFeatures
      .map(function (feature, index) {
        var nomor = String(feature.get("Nomor") || "-").trim();
        var nama = toDisplayName(feature.get("Nama Anggota")) || "Tanpa Nama";
        var alamat = String(feature.get("Alamat") || "").trim();
        // Cleaned at the source, not just at the title: buildPopupHtml shows
        // Keterangan as its own meta row whenever it differs from the title,
        // so cleaning only the title would push the survey note down the popup
        // instead of removing it.
        var keterangan = cleanKeterangan(feature.get("Keterangan"));
        var tanggal = String(feature.get("Tanggal Dokumentasi") || "").trim();
        var photo = String(feature.get("Foto Survey Awal") || "").trim();
        var kabupaten = resolveKabupaten(feature);
        feature.set("kabupaten", kabupaten);

        // Koordinat: pakai field survey; kalau kosong, turunkan dari geometri
        var lon = feature.get("Longitude");
        var lat = feature.get("Latitude");
        if (lat === null || lat === undefined || lat === "" ||
            lon === null || lon === undefined || lon === "") {
          var ge = feature.getGeometry().getExtent();
          var ll = ol.proj.toLonLat([(ge[0] + ge[2]) / 2, (ge[1] + ge[3]) / 2]);
          lon = ll[0].toFixed(5);
          lat = ll[1].toFixed(5);
        }
        var koordinat = lat + ", " + lon;
        var koordinatSingkat =
          Number(lat).toFixed(4) + ", " + Number(lon).toFixed(4);

        return {
          id: String(index),
          feature: feature,
          nomor: nomor,
          nama: nama,
          alamat: alamat,
          keterangan: keterangan,
          tanggal: tanggal,
          photo: photo,
          kabupaten: kabupaten,
          koordinat: koordinat,
          koordinatSingkat: koordinatSingkat,
          display: buildDisplayParts(nomor, keterangan),
          searchText: getNormalizedText(
            [nomor, nama, alamat, keterangan, tanggal].join(" ")
          ),
        };
      })
      .sort(function (left, right) {
        return collator.compare(left.nomor, right.nomor);
      });

    var featureLookup = new Map();
    items.forEach(function (item) {
      featureLookup.set(item.feature, item);
    });

    function buildGroupedItems(mode) {
      var keyFn =
        mode === "kabupaten"
          ? function (item) { return item.kabupaten; }
          : function (item) { return item.nama; };
      var groups = items.reduce(function (result, item) {
        var key = keyFn(item) || "Lainnya";
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(item);
        return result;
      }, {});
      return Object.keys(groups)
        .sort(function (left, right) {
          return collator.compare(left, right);
        })
        .map(function (name) {
          return { name: name, items: groups[name] };
        });
    }

    var groupMode = "nama";
    var groupedItems = buildGroupedItems(groupMode);

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

    // ---- Single source of truth for "what is on the map right now" ----------
    // Both grouping modes behave identically: opening a group filters the map
    // to that group and zooms to it. Search narrows further, inside the active
    // group when there is one. The map layer, the list and the "tampil" counter
    // all read from visibleIds, so they can never disagree.
    var activeGroup = null;
    var visibleIds = new Set(items.map(function (item) { return item.id; }));
    var restoreFocusGroup = null;

    function updateHighlight(itemId) {
      var previous = listContainer.querySelector(".item.is-active");
      if (previous) {
        previous.classList.remove("is-active");
      }

      if (!itemId) {
        return;
      }

      var next = listContainer.querySelector('[data-item-id="' + itemId + '"]');
      if (next) {
        next.classList.add("is-active");
        // block:"nearest" scoped to the list pane — scrollIntoView would
        // also scroll body/html and shift the fixed shell upward.
        var scroller = document.querySelector(".sidebar-scroll");
        if (scroller) {
          var scrollerRect = scroller.getBoundingClientRect();
          var itemRect = next.getBoundingClientRect();
          if (itemRect.top < scrollerRect.top) {
            scroller.scrollTop += itemRect.top - scrollerRect.top;
          } else if (itemRect.bottom > scrollerRect.bottom) {
            scroller.scrollTop += itemRect.bottom - scrollerRect.bottom;
          }
        }
      }
    }

    // Returns the card's laid-out height, which the caller needs to work out
    // where to pan the pin to.
    function openPopupForItem(item, coordinate) {
      if (!popup || !popupContent) {
        return 0;
      }

      var ext = item.feature.getGeometry().getExtent();
      var defaultCoord = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
      var coord = coordinate || defaultCoord;

      popupContent.innerHTML = buildPopupHtml(item);
      popup.style.display = "block";

      // Position before measuring. OpenLayers owns the wrapper it puts around
      // this element and holds that wrapper at display:none for as long as the
      // overlay has no position, so reading offsetHeight any earlier came back
      // 0 out of an unrendered subtree -- but only on the first open after a
      // close, which is why the card landed correctly about half the time. The
      // 0 fell through to the 300px guess in getFocusTargetCenter, so any card
      // taller than that got framed ~200px too high and clipped off the map.
      if (window.overlayPopup && typeof window.overlayPopup.setPosition === "function") {
        window.overlayPopup.setPosition(coord);
      }

      // Flush layout so the browser registers the popup's pre-transition state:
      // going from display:none to display:block and gaining the class in one
      // frame gives the transition no starting point, so it would not animate.
      //
      // This reads the offset synchronously instead of deferring the class by
      // two requestAnimationFrames. That deferral was a real bug on mobile:
      // is-popup-open also tells the bottom sheet to drop out of the way, so
      // whenever those frames were throttled or dropped the class never landed
      // and the sheet stayed at its peek height, covering the popup it was
      // supposed to make room for.
      //
      // The height comes off this same flush. Measuring it after the class
      // instead would buy a second full layout for an identical number:
      // is-popup-open only animates transform and opacity, and outside the
      // mobile breakpoint it does not touch .ol-popup at all.
      var popupHeight = popup.offsetHeight;
      document.body.classList.add("is-popup-open");

      return popupHeight;
    }

    function clearSelection() {
      activeItemId = null;
      updateHighlight(activeItemId);

      if (window.collection && typeof window.collection.clear === "function") {
        window.collection.clear();
      }

      if (window.featureOverlay) {
        window.featureOverlay.setStyle(null);
      }

      hidePopup();
    }

    var FOCUS_EASING = ol.easing.inAndOut;
    var mapFocusAnimUntil = 0;

    function markMapFocusAnimation(duration) {
      mapFocusAnimUntil = Date.now() + duration + 180;
    }

    function getMastheadBottomOffset() {
      var masthead = document.querySelector(".masthead");
      var mapEl = document.getElementById("map");
      if (!masthead || !mapEl) {
        return 80;
      }
      var mapRect = mapEl.getBoundingClientRect();
      var mastheadRect = masthead.getBoundingClientRect();
      return Math.max(0, Math.ceil(mastheadRect.bottom - mapRect.top));
    }

    function getFocusTargetCenter(view, featureCenter, targetZoom, popupHeight) {
      var animateCenter = featureCenter.slice();
      var size = window.map.getSize();
      if (!size || !size[1]) {
        return animateCenter;
      }

      var targetResolution = view.getResolutionForZoom(targetZoom);
      var pinTargetY;

      if (isMobileViewport()) {
        // Mobile: the card docks under the masthead, so the pin belongs in the
        // strip below it. The gap has to clear the marker itself — it anchors
        // at its tip and draws upward, so anything under ~40px tucks the pin's
        // head behind the card. Tall cards on short screens run out of room;
        // the floor keeps the pin on screen and lets the overlap happen there.
        var cardTop = 70;
        var markerGap = 56;
        var pinFloor = size[1] - 40;
        pinTargetY = Math.min(cardTop + (popupHeight || 300) + markerGap, pinFloor);
      } else {
        // Desktop: popup docks above the pin (bottom: 48px). Guarantee the
        // card top clears the masthead at every desktop height.
        var mastheadBottom = getMastheadBottomOffset();
        var topPadding = 8;
        var pinGap = 48;
        var bottomMargin = 56;
        var popupH = popupHeight || 300;
        var minPinY = mastheadBottom + topPadding + pinGap + popupH;
        var maxPinY = size[1] - bottomMargin;
        var preferredPinY = minPinY + 16;

        if (minPinY > maxPinY) {
          // Cramped viewport: keep the popup top visible even if the pin
          // sits lower than the ideal bottom margin.
          pinTargetY = minPinY;
        } else {
          pinTargetY = Math.min(preferredPinY, maxPinY);
        }
      }

      var offsetPxDown = pinTargetY - size[1] / 2;
      animateCenter[1] = featureCenter[1] + offsetPxDown * targetResolution;
      return animateCenter;
    }

    function getFocusAnimationDuration(view, featureCenter, targetZoom) {
      var currentZoom = view.getZoom() || 0;
      var zoomDelta = Math.abs(targetZoom - currentZoom);
      var currentCenter = view.getCenter();
      var panPixels = 0;

      if (currentCenter) {
        var startPixel = window.map.getPixelFromCoordinate(currentCenter);
        var endPixel = window.map.getPixelFromCoordinate(featureCenter);
        if (startPixel && endPixel) {
          panPixels = Math.hypot(
            endPixel[0] - startPixel[0],
            endPixel[1] - startPixel[1]
          );
        }
      }

      var base = isMobileViewport() ? 560 : 760;
      var zoomBoost = Math.min(zoomDelta * 42, 360);
      var panBoost = Math.min(panPixels * 0.22, 260);
      return Math.round(Math.max(base, Math.min(base + zoomBoost + panBoost, 1180)));
    }

    function animateMapFocus(view, featureCenter, targetZoom, popupHeight) {
      if (view.getAnimating()) {
        view.cancelAnimations();
      }

      var targetCenter = getFocusTargetCenter(
        view,
        featureCenter,
        targetZoom,
        popupHeight
      );
      var duration = getFocusAnimationDuration(view, featureCenter, targetZoom);
      var currentZoom = view.getZoom() || 0;
      var zoomDelta = Math.abs(targetZoom - currentZoom);

      markMapFocusAnimation(duration);

      function finishFocusAnimation() {
        mapFocusAnimUntil = Date.now() + 120;
      }

      if (zoomDelta <= 2.5) {
        view.animate(
          {
            center: targetCenter,
            zoom: targetZoom,
            duration: duration,
            easing: FOCUS_EASING,
          },
          finishFocusAnimation
        );
        return;
      }

      var isZoomingIn = targetZoom > currentZoom;
      var bridgeZoom = isZoomingIn
        ? Math.min(currentZoom + zoomDelta * 0.58, targetZoom - 0.4)
        : Math.max(currentZoom - zoomDelta * 0.58, targetZoom + 0.4);
      var phaseOne = Math.round(duration * 0.44);
      var phaseTwo = duration - phaseOne;

      view.animate(
        {
          center: targetCenter,
          zoom: bridgeZoom,
          duration: phaseOne,
          easing: FOCUS_EASING,
        },
        {
          center: targetCenter,
          zoom: targetZoom,
          duration: phaseTwo,
          easing: FOCUS_EASING,
        },
        finishFocusAnimation
      );
    }

    function focusItem(item, options) {
      var config = options || {};
      var ext = item.feature.getGeometry().getExtent();
      var featureCenter = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];

      activeItemId = item.id;
      updateHighlight(activeItemId);

      if (window.collection && typeof window.collection.clear === "function") {
        window.collection.clear();
        window.collection.push(item.feature);
      }

      if (window.featureOverlay) {
        window.featureOverlay.setStyle(pinStyle);
      }

      if (isMobileViewport()) {
        setPanelOpen(false);
      } else if (config.closePanel) {
        setPanelOpen(false);
      }

      // Always use the feature's actual center for everything to avoid shifting
      var popupHeight = openPopupForItem(item, featureCenter);

      // 17 is a floor, not a setpoint: it exists to get close enough to read a
      // pin, and once the view is already closer that job is done. Treating it
      // as a setpoint pulled the camera back out on every click, which broke
      // the one case that needs the zoom most -- points a few metres apart,
      // where you zoom in to tell them apart and clicking the second one undid
      // the zoom that made it clickable in the first place.
      var view = window.map.getView();
      var targetZoom = Math.max(config.zoom || 17, view.getZoom() || 0);
      animateMapFocus(view, featureCenter, targetZoom, popupHeight);
    }

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
        : "Cari nomor, nama, alamat...";

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
        var matched = [];
        groupedItems.forEach(function (group) {
          group.items.forEach(function (item) {
            if (item.searchText.indexOf(normalizedQuery) === -1) {
              return;
            }
            visibleIds.add(item.id);
            visibleCount += 1;
            matched.push({ item: item, groupName: group.name });
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

    function buildEmptyState(hasQuery) {
      var wrap = document.createElement("div");
      wrap.className = "empty-state";

      var copy = document.createElement("p");
      copy.className = "empty-state__copy";
      wrap.appendChild(copy);

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
        copy.textContent =
          "Tidak ada titik yang cocok dengan pencarian. Coba nomor titik, nama pengusul, patokan lokasi, atau nama desa.";
      } else {
        copy.textContent = "Belum ada titik untuk ditampilkan.";
      }

      return wrap;
    }

    // ---- Map <-> list synchronisation --------------------------------------
    // The layer renders exactly the ids the list is showing, so the "tampil"
    // counter is true by construction.
    window.lyr_260331_4.setStyle(function (feature, resolution) {
      var item = featureLookup.get(feature);
      if (item && !visibleIds.has(item.id)) {
        return null;
      }
      return style_260331_4(feature, resolution);
    });

    function fitToVisible(options) {
      var config = options || {};
      var extent = null;

      items.forEach(function (item) {
        if (!visibleIds.has(item.id)) {
          return;
        }
        var e = item.feature.getGeometry().getExtent();
        extent = extent
          ? [
              Math.min(extent[0], e[0]),
              Math.min(extent[1], e[1]),
              Math.max(extent[2], e[2]),
              Math.max(extent[3], e[3])
            ]
          : e.slice();
      });

      if (!extent) {
        return;
      }

      window.map.getView().fit(extent, {
        // Reserve the panel's real footprint, otherwise the westernmost points
        // land underneath it.
        padding: [40, 32, 40, panelInset() + 24],
        maxZoom: config.maxZoom || 15,
        duration: config.duration || 700
      });
    }

    // Horizontal space the data panel steals from the map (0 when it is a
    // bottom sheet or collapsed).
    function panelInset() {
      if (window.innerWidth < 960) {
        return 0;
      }
      if (document.body.classList.contains("is-sidebar-collapsed")) {
        return 0;
      }
      var panel = document.getElementById("sidebar");
      return panel ? Math.round(panel.getBoundingClientRect().right) : 0;
    }

    function setActiveGroup(name, options) {
      var config = options || {};
      // Remember the row we are leaving so Back can hand focus straight back
      // to it — innerHTML wiping destroys the node the user just activated.
      restoreFocusGroup = name ? null : activeGroup;
      activeGroup = name || null;
      // A query typed on one screen must not leak onto the other.
      searchInput.value = "";
      clearSelection();
      renderList("");
      moveFocusForScreen();
      if (config.fit !== false) {
        fitToVisible({ maxZoom: activeGroup ? 14 : 15 });
      }
    }

    // preventScroll is load-bearing on mobile, not a nicety. The focused
    // control lives inside the bottom sheet; when a point is picked the sheet
    // translates fully off-screen, and a plain focus() makes the browser scroll
    // the document to chase it — dragging the hidden sheet back over the popup.
    function focusWithoutScroll(node) {
      if (!node) {
        return;
      }
      try {
        node.focus({ preventScroll: true });
      } catch (err) {
        node.focus();
      }
    }

    function moveFocusForScreen() {
      if (activeGroup) {
        focusWithoutScroll(document.querySelector(".panel-back"));
        return;
      }
      if (!restoreFocusGroup) {
        return;
      }
      var rows = listContainer.querySelectorAll(".group-row");
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].dataset.groupName === restoreFocusGroup) {
          focusWithoutScroll(rows[i]);
          break;
        }
      }
      restoreFocusGroup = null;
    }

    function fitToAllPoints() {
      clearSelection();
      fitToVisible({ maxZoom: 15 });
    }

    function handleMapClick(event) {
      // The switcher lives inside the map viewport, so its own clicks also
      // arrive here — don't treat them as map clicks (it would re-close the
      // panel the button just opened, and clear the selection).
      var domTarget = event.originalEvent && event.originalEvent.target;
      if (domTarget && domTarget.closest && domTarget.closest(".layer-switcher")) {
        return;
      }
      // Click-activated layer panel has no auto-close of its own.
      if (window.layerSwitcher) {
        window.layerSwitcher.hidePanel();
      }
      var clickedFeature = window.map.forEachFeatureAtPixel(
        event.pixel,
        function (feature, layer) {
          if (layer === window.lyr_260331_4) {
            return feature;
          }
          return null;
        }
      );

      if (!clickedFeature) {
        clearSelection();
        return;
      }

      var item = featureLookup.get(clickedFeature);
      if (!item) {
        return;
      }

      focusItem(item, { closePanel: true, zoom: 17, coordinate: event.coordinate });
    }

    var searchDebounce;
    searchInput.addEventListener("input", function (event) {
      var value = event.target.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function () {
        renderList(value);
        // Search now narrows the map too, so bring the survivors into view
        // instead of leaving the user staring at an empty viewport.
        fitToVisible({ maxZoom: 16, duration: 500 });
      }, 250);
    });

    var searchClear = document.getElementById("list-search-clear");
    if (searchClear) {
      searchClear.addEventListener("click", function () {
        // Kill the pending debounce first: without this a clear that lands
        // within 250ms of the last keystroke gets overwritten by the stale
        // term the timer is still holding.
        clearTimeout(searchDebounce);
        searchInput.value = "";
        searchInput.focus();
        renderList("");
        fitToVisible({ maxZoom: 16, duration: 500 });
      });
    }

    fitButton.addEventListener("click", function () {
      searchInput.value = "";
      setActiveGroup(null);
      if (window.innerWidth < 960) {
        setPanelOpen(false);
      }
    });

    // Grouping toggle: Pengusul (default) <-> Kabupaten/Kota
    var groupModeButtons = Array.prototype.slice.call(
      document.querySelectorAll(".group-mode__btn")
    );

    function applyGroupMode(mode) {
      if (mode === groupMode) {
        return;
      }
      groupMode = mode;
      groupedItems = buildGroupedItems(groupMode);
      activeGroup = null;
      groupModeButtons.forEach(function (btn) {
        var on = btn.getAttribute("data-mode") === mode;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      renderList(searchInput.value);
    }

    groupModeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyGroupMode(btn.getAttribute("data-mode"));
      });
    });

    // Keep the OpenLayers canvas filling its container while the sidebar
    // slides in/out (the map needs updateSize() after the box resizes).
    function refreshMapSizeDuring(duration) {
      var start = null;
      function step(timestamp) {
        if (window.map && typeof window.map.updateSize === "function") {
          window.map.updateSize();
        }
        if (start === null) {
          start = timestamp;
        }
        if (timestamp - start < duration) {
          requestAnimationFrame(step);
        }
      }
      requestAnimationFrame(step);
    }

    // Desktop: collapse the sidebar to a full-width map (mobile keeps its modal).
    function setSidebarCollapsed(collapsed) {
      document.body.classList.toggle("is-sidebar-collapsed", collapsed);
      if (panelToggle) {
        panelToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        panelToggle.setAttribute(
          "data-tooltip",
          collapsed ? "Tampilkan panel" : "Sembunyikan panel"
        );
      }
      refreshMapSizeDuring(380);
    }

    if (panelToggle) {
      panelToggle.addEventListener("click", function () {
        if (window.innerWidth >= 960) {
          setSidebarCollapsed(
            !document.body.classList.contains("is-sidebar-collapsed")
          );
        } else {
          setPanelOpen(!document.body.classList.contains("is-panel-open"));
        }
      });

      // On desktop the sidebar starts open, so reflect that on the toggle.
      if (window.innerWidth >= 960) {
        panelToggle.setAttribute("aria-expanded", "true");
      }
    }

    if (panelClose) {
      panelClose.addEventListener("click", function () {
        setPanelOpen(false);
      });
    }

    // The mobile sheet is dragged, not tapped: it tracks the finger and snaps
    // on release. Click stays bound because Enter/Space on the handle
    // synthesises one — without it the sheet is unreachable by keyboard.
    var sheetHandle = document.getElementById("sheet-handle");
    var sheet = document.getElementById("sidebar");
    if (sheetHandle && sheet) {
      var TAP_SLOP = 6; // px of travel before a press counts as a drag
      var COMMIT_RATIO = 0.25; // share of the travel that commits the new state
      var FLING = 0.4; // px/ms that commits regardless of distance
      var drag = null;
      var suppressClick = false;

      // Measured live: --sheet-peek drops to 122px in landscape.
      function sheetTravel() {
        var peek = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--sheet-peek"
          )
        );
        return Math.max(sheet.offsetHeight - (peek || 0), 1);
      }

      function endDrag(commit) {
        if (!drag) {
          return;
        }
        var open = drag.wasOpen;
        if (commit) {
          var moved = drag.y - drag.from;
          if (Math.abs(drag.velocity) > FLING) {
            open = drag.velocity < 0;
          } else if (Math.abs(moved) > drag.travel * COMMIT_RATIO) {
            open = moved < 0;
          }
        }
        drag = null;
        // Order matters: the transition has to be back before the inline
        // transform clears, or the sheet jumps to its resting spot.
        document.body.classList.remove("is-sheet-dragging");
        sheet.style.transform = "";
        setPanelOpen(open);
      }

      sheetHandle.addEventListener("pointerdown", function (event) {
        if (!event.isPrimary) {
          return;
        }
        var travel = sheetTravel();
        var wasOpen = document.body.classList.contains("is-panel-open");
        drag = {
          id: event.pointerId,
          startY: event.clientY,
          lastY: event.clientY,
          lastT: event.timeStamp,
          velocity: 0,
          travel: travel,
          wasOpen: wasOpen,
          from: wasOpen ? 0 : travel,
          y: wasOpen ? 0 : travel,
          moved: false
        };
        sheetHandle.setPointerCapture(event.pointerId);
      });

      sheetHandle.addEventListener("pointermove", function (event) {
        if (!drag || event.pointerId !== drag.id) {
          return;
        }
        var dy = event.clientY - drag.startY;
        if (!drag.moved) {
          if (Math.abs(dy) < TAP_SLOP) {
            return;
          }
          drag.moved = true;
          document.body.classList.add("is-sheet-dragging");
        }
        var dt = event.timeStamp - drag.lastT;
        if (dt > 0) {
          drag.velocity = (event.clientY - drag.lastY) / dt;
        }
        drag.lastY = event.clientY;
        drag.lastT = event.timeStamp;
        drag.y = Math.min(Math.max(drag.from + dy, 0), drag.travel);
        sheet.style.transform = "translate3d(0, " + drag.y + "px, 0)";
      });

      sheetHandle.addEventListener("pointerup", function (event) {
        if (!drag || event.pointerId !== drag.id) {
          return;
        }
        // Touch fires a click after the drag; that must not re-toggle.
        suppressClick = drag.moved;
        endDrag(suppressClick);
      });

      sheetHandle.addEventListener("pointercancel", function (event) {
        if (drag && event.pointerId === drag.id) {
          endDrag(false);
        }
      });

      sheetHandle.addEventListener("click", function () {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        setPanelOpen(!document.body.classList.contains("is-panel-open"));
      });
    }

    // Focusing search from the peek sheet expands it so results are visible.
    searchInput.addEventListener("focus", function () {
      if (window.innerWidth < 960) {
        setPanelOpen(true);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") {
        return;
      }
      if (window.layerSwitcher) {
        window.layerSwitcher.hidePanel();
      }
      if (document.body.classList.contains("is-popup-open")) {
        clearSelection();
      } else {
        setPanelOpen(false);
      }
    });

    window.addEventListener("resize", function () {
      configurePopupOverlayForViewport();
      if (window.innerWidth >= 960) {
        setPanelOpen(false);
      } else {
        document.body.classList.remove("is-sidebar-collapsed");
      }
    });

    configurePopupOverlayForViewport();

    // Override qgis2web's closer so it also clears the map selection & sidebar highlight
    var popupCloser = document.getElementById("popup-closer");
    if (popupCloser) {
      popupCloser.onclick = function (e) {
        e.preventDefault();
        clearSelection();
        popupCloser.blur();
        return false;
      };
    }

    // Bind to "click", not "singleclick": OpenLayers defers singleclick behind a
    // hardcoded 250ms timeout so it can tell a single tap from a double one, and
    // since the popup is the only visible response to tapping a pin, that wait
    // was the entire interaction latency (INP 248ms, of which 245ms was the
    // timeout doing nothing). Both events are dispatched from the same
    // emulateClick_ path under the same !dragging_ guard, so panning the map
    // still won't open a popup.
    //
    // The trade is that a double-click now runs this twice and would also zoom,
    // so DoubleClickZoom has to go. Nothing here listens for dblclick, and
    // scroll, pinch, and the zoom buttons all still zoom.
    window.map
      .getInteractions()
      .getArray()
      .slice()
      .forEach(function (interaction) {
        if (interaction instanceof ol.interaction.DoubleClickZoom) {
          window.map.removeInteraction(interaction);
        }
      });

    window.map.on("click", handleMapClick);

    // Keep popup in view after user zooms/pans — re-trigger autoPan
    // (skip on mobile: popup is position:fixed and no longer anchored to
    // the feature, so panIntoView would fight our intentional offset)
    var panGuard = false;
    window.map.on("moveend", function () {
      if (panGuard) {
        panGuard = false;
        return;
      }
      if (Date.now() < mapFocusAnimUntil) {
        return;
      }
      if (isMobileViewport()) {
        return;
      }
      if (window.overlayPopup && window.overlayPopup.getPosition()) {
        panGuard = true;
        window.overlayPopup.panIntoView({
          animation: { duration: 300 },
          margin: 60
        });
      }
    });

    renderList("");
    }

    // Data titik dimuat async dari data/points.geojson — jalankan init
    // begitu fitur selesai dimuat (atau langsung kalau sudah ada).
    function runInit() {
      if (hasInitialised) {
        return;
      }
      if (!pointSource.getFeatures().length) {
        return;
      }
      hasInitialised = true;
      disarmWatchdog();
      setDataControlsDisabled(false);
      init();
    }

    pointSource.on("featuresloaderror", function () {
      failDataLoad(
        "File data/points.geojson gagal dimuat. Periksa path, format GeoJSON, dan koneksi server."
      );
    });

    // featuresloadend can fire more than once (a retry re-runs the loader), so
    // listen continuously rather than once — a late success must still be able
    // to replace a previously shown error.
    pointSource.on("featuresloadend", runInit);

    showDataLoading();
    armWatchdog();
    runInit();
  });
})();
