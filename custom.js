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

  function sanitizeMediaPath(value) {
    return String(value || "").replace(/[\\/:]/g, "_").trim();
  }

  function getCollator() {
    return new Intl.Collator("id", {
      numeric: true,
      sensitivity: "base",
    });
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
    var landmark = String(keterangan || "").trim();

    var primary;
    var secondary;

    if (landmark) {
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

  document.addEventListener("DOMContentLoaded", function () {
    var hasInitialised = false;
    var loadWatchdog = null;

    if (!window.map || !window.lyr_260331_4) {
      // Nothing to retry against — the map itself never came up.
      showDataLoadError("Peta atau layer titik tidak berhasil diinisialisasi.");
      return;
    }

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
        var nama = String(feature.get("Nama Anggota") || "Tanpa Nama").trim();
        var alamat = String(feature.get("Alamat") || "").trim();
        var keterangan = String(feature.get("Keterangan") || "").trim();
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
        next.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      }
    }

    function openPopupForItem(item, coordinate) {
      if (!popup || !popupContent) {
        return;
      }

      var ext = item.feature.getGeometry().getExtent();
      var defaultCoord = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
      var coord = coordinate || defaultCoord;

      popupContent.innerHTML = buildPopupHtml(item);
      popup.style.display = "block";

      var popupWasOpen = document.body.classList.contains("is-popup-open");
      if (isMobileViewport() && !popupWasOpen) {
        document.body.classList.remove("is-popup-open");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            document.body.classList.add("is-popup-open");
          });
        });
      } else {
        document.body.classList.add("is-popup-open");
      }

      if (window.overlayPopup && typeof window.overlayPopup.setPosition === "function") {
        window.overlayPopup.setPosition(coord);
      }
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

    function focusItem(item, options) {
      var config = options || {};
      var currentZoom = window.map.getView().getZoom() || 0;
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
      openPopupForItem(item, featureCenter);

      var targetZoom = config.zoom || 17;
      var view = window.map.getView();

      if (view.getAnimating()) {
        view.cancelAnimations();
      }

      // Mobile: the popup card sits centered on screen (top edge ~24% on
      // the tallest cards), so pan the pin into the strip between the
      // masthead and the card.
      var animateCenter = featureCenter;
      var mapDuration = 800;
      if (isMobileViewport()) {
        mapDuration = 520;
        var size = window.map.getSize();
        if (size && size[1]) {
          var targetResolution = view.getResolutionForZoom(targetZoom);
          var pinTargetY = size[1] * 0.16;
          var offsetPxDown = pinTargetY - size[1] / 2;
          animateCenter = [
            featureCenter[0],
            featureCenter[1] + offsetPxDown * targetResolution
          ];
        }
      }

      view.animate({
        center: animateCenter,
        zoom: targetZoom,
        duration: mapDuration,
        easing: ol.easing.easeOut
      });
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
          setActiveGroup(null, { fit: false });
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
      activeGroup = name || null;
      // A query typed on one screen must not leak onto the other.
      searchInput.value = "";
      clearSelection();
      renderList("");
      if (config.fit !== false) {
        fitToVisible({ maxZoom: activeGroup ? 14 : 15 });
      }
    }

    function fitToAllPoints() {
      clearSelection();
      fitToVisible({ maxZoom: 15 });
    }

    function handleMapSingleClick(event) {
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

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
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

    window.map.on("singleclick", handleMapSingleClick);

    // Keep popup in view after user zooms/pans — re-trigger autoPan
    // (skip on mobile: popup is position:fixed and no longer anchored to
    // the feature, so panIntoView would fight our intentional offset)
    var panGuard = false;
    window.map.on("moveend", function () {
      if (panGuard) {
        panGuard = false;
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
