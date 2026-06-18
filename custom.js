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

  function buildDisplayParts(nomor) {
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

    var primary = parts.length ? toDisplayCase(parts[parts.length - 1]) : String(nomor || "Titik");
    var secondary = parts.length > 1
      ? parts
          .slice(0, -1)
          .map(toDisplayCase)
          .join(" • ")
      : "Lokasi survey lapangan";

    return {
      code: code || "Titik",
      primary: primary,
      secondary: secondary,
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
  }

  function showDataLoadError(message) {
    var listContainer = document.getElementById("list-data");

    setTextContent("count-points", "0");
    setTextContent("count-groups", "0");
    setTextContent("count-visible", "0");
    setDataControlsDisabled(true);
    hidePopup();

    if (listContainer) {
      var errorNode = document.createElement("div");
      var title = document.createElement("h2");
      var copy = document.createElement("p");
      var action = document.createElement("button");

      errorNode.className = "data-error";
      errorNode.setAttribute("role", "alert");

      title.className = "data-error__title";
      title.textContent = "Data titik belum bisa dimuat";

      copy.className = "data-error__copy";
      copy.textContent = message ||
        "Periksa koneksi dan file data/points.geojson, lalu muat ulang halaman.";

      action.type = "button";
      action.className = "secondary-action data-error__action";
      action.textContent = "Muat ulang";
      action.addEventListener("click", function () {
        window.location.reload();
      });

      errorNode.appendChild(title);
      errorNode.appendChild(copy);
      errorNode.appendChild(action);
      listContainer.replaceChildren(errorNode);
    }
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
    var hasResolvedDataLoad = false;
    var loadWatchdog;

    function failDataLoad(message) {
      if (hasResolvedDataLoad) {
        return;
      }
      hasResolvedDataLoad = true;
      if (loadWatchdog) {
        window.clearTimeout(loadWatchdog);
      }
      showDataLoadError(message);
    }

    if (!window.map || !window.lyr_260331_4) {
      failDataLoad("Peta atau layer titik tidak berhasil diinisialisasi.");
      return;
    }

    if (typeof window.onSingleClickFeatures === "function") {
      window.map.un("singleclick", window.onSingleClickFeatures);
    }
    if (typeof window.onSingleClickWMS === "function") {
      window.map.un("singleclick", window.onSingleClickWMS);
    }

    var pointSource = window.lyr_260331_4.getSource();

    function init() {
    var collator = getCollator();
    var allFeatures = pointSource.getFeatures().slice();
    var listContainer = document.getElementById("list-data");
    var searchInput = document.getElementById("list-search");
    var fitButton = document.getElementById("fit-map");
    var panelToggle = document.getElementById("panel-toggle");
    var panelClose = document.getElementById("sidebar-close");
    var countPoints = document.getElementById("count-points");
    var countGroups = document.getElementById("count-groups");
    var countGroupsLabel = document.getElementById("count-groups-label");
    var countVisible = document.getElementById("count-visible");
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
          display: buildDisplayParts(nomor),
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

    function updateGroupStats() {
      countGroups.textContent = groupedItems.length.toLocaleString("id-ID");
      if (countGroupsLabel) {
        countGroupsLabel.textContent =
          groupMode === "kabupaten" ? "wilayah" : "pengusul";
      }
    }

    countPoints.textContent = items.length.toLocaleString("id-ID");
    updateGroupStats();

    var expandedGroups = new Set();

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

    var FOCUS_EASING = ol.easing.inAndOut;
    var mapFocusAnimUntil = 0;

    function markMapFocusAnimation(duration) {
      mapFocusAnimUntil = Date.now() + duration + 180;
    }

    function measurePopupHeight() {
      var popup = document.getElementById("popup");
      if (!popup || popup.style.display === "none") {
        return 300;
      }
      return popup.offsetHeight || popup.scrollHeight || 300;
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
        // Mobile: the popup card sits centered on screen (top edge ~24% on
        // the tallest cards), so pan the pin into the strip between the
        // masthead and the card.
        pinTargetY = size[1] * 0.16;
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
      openPopupForItem(item, featureCenter);

      var targetZoom = config.zoom || 17;
      var popupHeight = measurePopupHeight();
      animateMapFocus(window.map.getView(), featureCenter, targetZoom, popupHeight);
    }

    function renderList(query) {
      var normalizedQuery = getNormalizedText(query);
      var fragment = document.createDocumentFragment();
      var visibleCount = 0;

      listContainer.innerHTML = "";

      groupedItems.forEach(function (group, groupIndex) {
        var matchedItems = group.items.filter(function (item) {
          return !normalizedQuery || item.searchText.indexOf(normalizedQuery) !== -1;
        });

        if (!matchedItems.length) {
          return;
        }

        visibleCount += matchedItems.length;

        var isExpanded = normalizedQuery
          ? true
          : expandedGroups.has(group.name);
        var itemsId = "group-items-" + groupIndex;

        var groupNode = document.createElement("section");
        groupNode.className = "group";

        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "group-toggle";
        toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        toggle.setAttribute("aria-controls", itemsId);

        var chevron = document.createElement("span");
        chevron.className = "group-chevron";
        chevron.setAttribute("aria-hidden", "true");

        var title = document.createElement("h2");
        title.className = "group-title";
        title.textContent = group.name;

        var meta = document.createElement("p");
        meta.className = "group-meta";
        meta.textContent = matchedItems.length + " titik";

        toggle.appendChild(chevron);
        toggle.appendChild(title);
        toggle.appendChild(meta);

        toggle.addEventListener("click", function () {
          var wasExpanded = expandedGroups.has(group.name);
          if (groupMode === "kabupaten") {
            // Single-open: selecting a kabupaten focuses the map on it.
            expandedGroups.clear();
            if (wasExpanded) {
              setMapKabupaten(null);
              fitToAllPoints();
            } else {
              expandedGroups.add(group.name);
              setMapKabupaten(group.name);
              fitToKabupaten(group.name);
            }
          } else if (wasExpanded) {
            expandedGroups.delete(group.name);
          } else {
            expandedGroups.add(group.name);
          }
          renderList(searchInput.value);
        });

        var itemsWrap = document.createElement("div");
        itemsWrap.className = "group-items";
        itemsWrap.id = itemsId;
        if (!isExpanded) {
          itemsWrap.hidden = true;
        }

        matchedItems.forEach(function (item) {
          var button = document.createElement("button");
          var code = document.createElement("span");
          var copy = document.createElement("span");
          var label = document.createElement("span");
          var subline = document.createElement("span");

          button.type = "button";
          button.className = "item";
          button.dataset.itemId = item.id;
          button.title = item.nomor;
          button.setAttribute(
            "aria-label",
            ["Titik " + item.nomor, item.nama, item.alamat]
              .filter(Boolean)
              .join(". ")
          );

          code.className = "item-code";
          code.textContent = item.display.code;

          copy.className = "item-copy";

          label.className = "item-label";
          label.textContent = item.display.primary;

          subline.className = "item-subline";
          subline.textContent = item.display.secondary;

          copy.appendChild(label);
          copy.appendChild(subline);
          button.appendChild(code);
          button.appendChild(copy);

          if (item.id === activeItemId) {
            button.classList.add("is-active");
          }

          button.addEventListener("click", function () {
            focusItem(item, { closePanel: true, zoom: 17 });
          });

          itemsWrap.appendChild(button);
        });

        groupNode.appendChild(toggle);
        groupNode.appendChild(itemsWrap);
        fragment.appendChild(groupNode);
      });

      if (!visibleCount) {
        var emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.textContent =
          "Tidak ada titik yang cocok dengan pencarian. Coba gunakan nomor titik, nama pengusul, atau potongan alamat.";
        fragment.appendChild(emptyState);
      }

      listContainer.appendChild(fragment);
      countVisible.textContent = visibleCount.toLocaleString("id-ID");
      updateHighlight(activeItemId);
    }

    function fitToAllPoints() {
      var leftPadding = window.innerWidth >= 960 ? 48 : 20;

      clearSelection();

      window.map.getView().fit(window.lyr_260331_4.getSource().getExtent(), {
        padding: [32, 28, 32, leftPadding],
        maxZoom: 15,
        duration: 700,
      });
    }

    // Map filter: show only the selected kabupaten's pins (null = show all).
    var selectedKabupaten = null;
    window.lyr_260331_4.setStyle(function (feature, resolution) {
      if (selectedKabupaten && feature.get("kabupaten") !== selectedKabupaten) {
        return null;
      }
      return style_260331_4(feature, resolution);
    });

    function setMapKabupaten(kab) {
      selectedKabupaten = kab || null;
      window.lyr_260331_4.changed();
    }

    function fitToKabupaten(kab) {
      var feats = window.lyr_260331_4
        .getSource()
        .getFeatures()
        .filter(function (f) {
          return f.get("kabupaten") === kab;
        });
      if (!feats.length) {
        return;
      }
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      feats.forEach(function (f) {
        var e = f.getGeometry().getExtent();
        if (e[0] < minX) minX = e[0];
        if (e[1] < minY) minY = e[1];
        if (e[2] > maxX) maxX = e[2];
        if (e[3] > maxY) maxY = e[3];
      });
      var leftPadding = window.innerWidth >= 960 ? 56 : 24;
      window.map.getView().fit([minX, minY, maxX, maxY], {
        padding: [48, 40, 48, leftPadding],
        maxZoom: 14,
        duration: 700,
      });
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
      }, 150);
    });

    fitButton.addEventListener("click", function () {
      if (groupMode === "kabupaten") {
        expandedGroups.clear();
        setMapKabupaten(null);
        renderList(searchInput.value);
      }
      fitToAllPoints();
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
      expandedGroups.clear();
      setMapKabupaten(null);
      updateGroupStats();
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
      if (hasResolvedDataLoad) {
        return;
      }
      hasResolvedDataLoad = true;
      if (loadWatchdog) {
        window.clearTimeout(loadWatchdog);
      }
      setDataControlsDisabled(false);
      init();
    }

    pointSource.once("featuresloaderror", function () {
      failDataLoad("File data/points.geojson gagal dimuat. Periksa path, format GeoJSON, dan koneksi server.");
    });

    loadWatchdog = window.setTimeout(function () {
      if (!hasResolvedDataLoad && !pointSource.getFeatures().length) {
        failDataLoad("File data/points.geojson belum selesai dimuat setelah 20 detik.");
      }
    }, 20000);

    if (pointSource.getFeatures().length) {
      runInit();
    } else {
      pointSource.once("featuresloadend", runInit);
    }
  });
})();
