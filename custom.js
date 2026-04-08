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

    if (item.nama) {
      rows.push(
        '<div class="feature-popup__meta-row">' +
          '<div class="meta-icon">' + fieldIcons.nama + '</div>' +
          '<div><dt>Nama Pengusul</dt><dd>' + escapeHtml(item.nama) + "</dd></div>" +
        "</div>"
      );
    }

    if (item.alamat) {
      rows.push(
        '<div class="feature-popup__meta-row">' +
          '<div class="meta-icon">' + fieldIcons.alamat + '</div>' +
          '<div><dt>Alamat</dt><dd>' + escapeHtml(item.alamat) + "</dd></div>" +
        "</div>"
      );
    }

    if (item.tanggal) {
      rows.push(
        '<div class="feature-popup__meta-row">' +
          '<div class="meta-icon">' + fieldIcons.tanggal + '</div>' +
          '<div><dt>Dokumentasi</dt><dd>' + escapeHtml(item.tanggal) + "</dd></div>" +
        "</div>"
      );
    }

    if (item.keterangan) {
      rows.push(
        '<div class="feature-popup__meta-row">' +
          '<div class="meta-icon">' + fieldIcons.keterangan + '</div>' +
          '<div><dt>Keterangan</dt><dd>' + escapeHtml(item.keterangan) + "</dd></div>" +
        "</div>"
      );
    }

    return (
      '<div class="feature-popup">' +
      '<p class="feature-popup__eyebrow">Informasi Titik PJUTS</p>' +
      '<div class="feature-popup__head">' +
      '<div>' +
      '<h3 class="feature-popup__title">' + escapeHtml(item.display.primary) + "</h3>" +
      '<p class="feature-popup__subtitle">' + escapeHtml(item.display.secondary) + "</p>" +
      "</div>" +
      '<span class="feature-popup__badge">' + escapeHtml(item.display.code) + "</span>" +
      "</div>" +
      (photoPath
        ? '<div class="feature-popup__media">' +
          '<img src="images/' + encodeURI(photoPath) + '" alt="Foto lokasi ' + escapeHtml(item.nomor) + '" loading="lazy" />' +
          '<div class="media-overlay"></div>' +
          "</div>"
        : "") +
      '<dl class="feature-popup__meta">' + rows.join("") + "</dl>" +
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

    var collator = getCollator();
    var allFeatures = window.lyr_260331_4.getSource().getFeatures().slice();
    var listContainer = document.getElementById("list-data");
    var searchInput = document.getElementById("list-search");
    var fitButton = document.getElementById("fit-map");
    var panelToggle = document.getElementById("panel-toggle");
    var panelClose = document.getElementById("sidebar-close");
    var panelBackdrop = document.getElementById("panel-backdrop");
    var countPoints = document.getElementById("count-points");
    var countGroups = document.getElementById("count-groups");
    var countVisible = document.getElementById("count-visible");
    var popup = document.getElementById("popup");
    var popupContent = document.getElementById("popup-content");

    var activeItemId = null;

    // SVG pin marker for selected feature
    var pinSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">' +
        '<filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/></filter>' +
        '<path filter="url(%23s)" d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="%23003049"/>' +
        '<circle cx="18" cy="18" r="8" fill="%23fff"/>' +
      '</svg>';
    var pinSrc = "data:image/svg+xml," + pinSvg;

    var pinStyle = new ol.style.Style({
      image: new ol.style.Icon({
        src: pinSrc,
        anchor: [0.5, 1],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        scale: 1
      })
    });

    var items = allFeatures
      .map(function (feature, index) {
        var nomor = String(feature.get("Nomor") || "-").trim();
        var nama = String(feature.get("Nama Anggota") || "Tanpa Nama").trim();
        var alamat = String(feature.get("Alamat") || "").trim();
        var keterangan = String(feature.get("Keterangan") || "").trim();
        var tanggal = String(feature.get("Tanggal Dokumentasi") || "").trim();
        var photo = String(feature.get("Foto Survey Awal") || "").trim();

        return {
          id: String(index),
          feature: feature,
          nomor: nomor,
          nama: nama,
          alamat: alamat,
          keterangan: keterangan,
          tanggal: tanggal,
          photo: photo,
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

    var groups = items.reduce(function (result, item) {
      if (!result[item.nama]) {
        result[item.nama] = [];
      }
      result[item.nama].push(item);
      return result;
    }, {});

    var groupedItems = Object.keys(groups)
      .sort(function (left, right) {
        return collator.compare(left, right);
      })
      .map(function (name) {
        return {
          name: name,
          items: groups[name],
        };
      });

    countPoints.textContent = items.length.toLocaleString("id-ID");
    countGroups.textContent = groupedItems.length.toLocaleString("id-ID");

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

      view.animate({
        center: featureCenter,
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

      groupedItems.forEach(function (group) {
        var matchedItems = group.items.filter(function (item) {
          return !normalizedQuery || item.searchText.indexOf(normalizedQuery) !== -1;
        });

        if (!matchedItems.length) {
          return;
        }

        visibleCount += matchedItems.length;

        var groupNode = document.createElement("section");
        groupNode.className = "group";

        var titleRow = document.createElement("div");
        titleRow.className = "group-title-row";

        var title = document.createElement("h2");
        title.className = "group-title";
        title.textContent = group.name;

        var meta = document.createElement("p");
        meta.className = "group-meta";
        meta.textContent = matchedItems.length + " titik";

        titleRow.appendChild(title);
        titleRow.appendChild(meta);

        var itemsWrap = document.createElement("div");
        itemsWrap.className = "group-items";

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

        groupNode.appendChild(titleRow);
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

    searchInput.addEventListener("input", function (event) {
      renderList(event.target.value);
    });

    fitButton.addEventListener("click", function () {
      fitToAllPoints();
      if (window.innerWidth < 960) {
        setPanelOpen(false);
      }
    });

    if (panelToggle) {
      panelToggle.addEventListener("click", function () {
        setPanelOpen(!document.body.classList.contains("is-panel-open"));
      });
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

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 960) {
        setPanelOpen(false);
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
    var panGuard = false;
    window.map.on("moveend", function () {
      if (panGuard) {
        panGuard = false;
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
  });
})();