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

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.map || !window.lyr_260331_4) {
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
    var panelBackdrop = document.getElementById("panel-backdrop");
    var countPoints = document.getElementById("count-points");
    var countGroups = document.getElementById("count-groups");
    var countGroupsLabel = document.getElementById("count-groups-label");
    var countVisible = document.getElementById("count-visible");
    var popup = document.getElementById("popup");
    var popupContent = document.getElementById("popup-content");

    var activeItemId = null;

    // Selection overlay disabled — the layer's red pin is the only marker
    var pinStyle = null;

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
      document.body.classList.add("is-popup-open");

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

      // Always use the feature's actual center for everything to avoid shifting
      openPopupForItem(item, featureCenter);

      var targetZoom = config.zoom || 17;
      var view = window.map.getView();

      if (view.getAnimating()) {
        view.cancelAnimations();
      }

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

      view.animate({
        center: animateCenter,
        zoom: targetZoom,
        duration: 800
      });

      if (config.closePanel && window.innerWidth < 960) {
        setPanelOpen(false);
      }
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

    if (panelBackdrop) {
      panelBackdrop.addEventListener("click", function () {
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
      if (window.innerWidth >= 960) {
        setPanelOpen(false);
      } else {
        document.body.classList.remove("is-sidebar-collapsed");
      }
    });

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

    // Sync body.is-popup-open with popup visibility so mobile CSS can react
    var popupObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.attributeName === "style") {
          var isVisible = popup.style.display !== "none" && popup.style.display !== "";
          document.body.classList.toggle("is-popup-open", isVisible);
        }
      });
    });
    if (popup) {
      popupObserver.observe(popup, { attributes: true, attributeFilter: ["style"] });
    }

    // Keep popup in view after user zooms/pans — re-trigger autoPan
    // (skip on mobile: popup is position:fixed and no longer anchored to
    // the feature, so panIntoView would fight our intentional offset)
    var panGuard = false;
    window.map.on("moveend", function () {
      if (panGuard) {
        panGuard = false;
        return;
      }
      if (window.innerWidth < 960) {
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
    if (pointSource.getFeatures().length) {
      init();
    } else {
      pointSource.once("featuresloadend", init);
    }
  });
})();