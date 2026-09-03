var wms_layers = [];


        var lyr_GoogleSatellite_0 = new ol.layer.Tile({
            'title': 'Citra Satelit',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: 'Tiles &copy; Google',
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                maxZoom: 21
            })
        });
var format_BatasKabupaten2011_1 = new ol.format.GeoJSON();
var features_BatasKabupaten2011_1 = format_BatasKabupaten2011_1.readFeatures(json_BatasKabupaten2011_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_BatasKabupaten2011_1 = new ol.source.Vector({
    attributions: [],
});
jsonSource_BatasKabupaten2011_1.addFeatures(features_BatasKabupaten2011_1);
var lyr_BatasKabupaten2011_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_BatasKabupaten2011_1,
                style: style_BatasKabupaten2011_1,
                popuplayertitle: 'Batas Kabupaten/Kota',
                interactive: false,
                title: 'Batas Kabupaten/Kota'
            });
// Area Cakupan starts hidden (see setVisible below), so its geometry is fetched
// by URL instead of being inlined as a <script>. OpenLayers only runs a vector
// source's loader once the layer actually renders, so the polygon now costs
// nothing until someone switches the layer on. Inlined it was 124KB of the
// critical path on every visit, for something nobody had asked to see.
var jsonSource_Dissolved_2 = new ol.source.Vector({
    attributions: [],
    // No ?v= token on data files: Caddy already serves /data/* as
    // "no-cache, must-revalidate", so a token buys nothing — and it would break
    // the <link rel=preload> in index.html, because bump-version.sh rewrites
    // every ?v= there but never touches this file. Mismatched URLs = two fetches.
    url: './data/dissolved.geojson',
    format: new ol.format.GeoJSON()
});
var lyr_Dissolved_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Dissolved_2, 
                style: style_Dissolved_2,
                popuplayertitle: 'Area Cakupan',
                interactive: false,
                title: 'Area Cakupan'
            });
var jsonSource_260331_4 = new ol.source.Vector({
    attributions: [],
    url: './data/points.geojson',
    format: new ol.format.GeoJSON()
});
// declutter stays OFF. It was tried as a way to cut the ~14ms the 471 pins add
// to every panned frame, and it worked, but it drops any icon overlapping one
// already drawn: at the default province zoom that hid 94 of the 414 points in
// view (22%), and 28% at zoom 9. This is a coverage map — the pattern of dots is
// the finding, so thinning it silently misreports how much of Jambi was surveyed.
// Never trade completeness of this layer for frame rate.
var lyr_260331_4 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_260331_4,
                style: style_260331_4,
                popuplayertitle: 'Titik PUTS',
                interactive: true,
                title: '<img src=\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="0 0 36 48"><path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="%23fee50f" stroke="%23293d50" stroke-width="2"/><circle cx="18" cy="18" r="6.5" fill="%23293d50"/></svg>\' /> Titik PUTS'
            });
// Titik Cadangan: the surplus survey rows (Status "Cadangan") live in the same
// geojson as the SK points, so this layer shares jsonSource_260331_4 — one
// download, two layers. custom.js gives each layer a style function that only
// draws its own half of the source, so the two switcher checkboxes work
// independently. Hidden by default: cadangan is a reserve list, not the
// finding, and showing it unasked made the coverage look larger than it is.
// style: null renders nothing until custom.js installs the real style.
var lyr_Cadangan_5 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_260331_4,
                style: null,
                popuplayertitle: 'Titik Cadangan',
                interactive: true,
                title: '<img src=\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="0 0 36 48"><defs><pattern id="h" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="%23e3e8ed"/><rect width="1.6" height="4" fill="%23293d50" fill-opacity="0.45"/></pattern></defs><path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="url(%23h)" stroke="%23293d50" stroke-width="2"/><circle cx="18" cy="18" r="6.5" fill="%23ffffff" stroke="%23293d50" stroke-width="1.2"/></svg>\' /> Titik Cadangan'
            });
// The switcher lists a group's layers top-down in reverse array order, so
// Cadangan goes first to sit under Titik PUTS in the panel (and under the
// SK pins on the map).
var group_RAW = new ol.layer.Group({
                                layers: [lyr_Cadangan_5, lyr_260331_4,],
                                fold: 'open',
                                title: 'Data Lapangan'});

lyr_GoogleSatellite_0.setVisible(true);lyr_BatasKabupaten2011_1.setVisible(true);lyr_Dissolved_2.setVisible(false);lyr_260331_4.setVisible(true);lyr_Cadangan_5.setVisible(false);
// "Ruas Jalan" is intentionally not loaded; it duplicated the kabupaten
// boundary, which is drawn (outline + label) by lyr_BatasKabupaten2011_1.
// Area Cakupan (Dissolved) sits below the boundary so its fill never hides the line.
var layersList = [lyr_GoogleSatellite_0,lyr_Dissolved_2,lyr_BatasKabupaten2011_1,group_RAW];
lyr_BatasKabupaten2011_1.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_Dissolved_2.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_260331_4.set('fieldAliases', {'fid': 'ID', 'Nomor': 'Nomor Titik', 'Nama Anggota': 'Petugas Survey', 'Alamat': 'Alamat', 'Longitude': 'Longitude', 'Latitude': 'Latitude', 'Tanggal Dokumentasi': 'Tanggal Dokumentasi', 'Keterangan': 'Keterangan', 'layer': 'Layer', 'Foto Survey Awal': 'Foto Lokasi', 'Toleransi': 'Toleransi', });
lyr_BatasKabupaten2011_1.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_Dissolved_2.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_260331_4.set('fieldImages', {'fid': 'TextEdit', 'Nomor': 'TextEdit', 'Nama Anggota': 'TextEdit', 'Alamat': 'TextEdit', 'Longitude': 'TextEdit', 'Latitude': 'TextEdit', 'Tanggal Dokumentasi': 'TextEdit', 'Keterangan': 'TextEdit', 'layer': 'TextEdit', 'Foto Survey Awal': 'ExternalResource', 'Toleransi': '', });
lyr_BatasKabupaten2011_1.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'no label', 'KABUPATEN_': 'header label - always visible', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_Dissolved_2.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'no label', 'KABUPATEN_': 'no label', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_260331_4.set('fieldLabels', {'fid': 'hidden field', 'Nomor': 'inline label - always visible', 'Nama Anggota': 'inline label - visible with data', 'Alamat': 'inline label - visible with data', 'Longitude': 'hidden field', 'Latitude': 'hidden field', 'Tanggal Dokumentasi': 'inline label - visible with data', 'Keterangan': 'inline label - visible with data', 'layer': 'hidden field', 'Foto Survey Awal': 'inline label - visible with data', 'Toleransi': 'hidden field', });
// Same attributes, same field metadata: qgis2web's popup helpers read these
// off whichever layer the feature was hit on.
lyr_Cadangan_5.set('fieldAliases', lyr_260331_4.get('fieldAliases'));
lyr_Cadangan_5.set('fieldImages', lyr_260331_4.get('fieldImages'));
lyr_Cadangan_5.set('fieldLabels', lyr_260331_4.get('fieldLabels'));
lyr_260331_4.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});
