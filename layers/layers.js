var wms_layers = [];


        var lyr_GoogleSatellite_0 = new ol.layer.Tile({
            'title': 'Citra Satelit',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: 'Tiles &copy; Esri',
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
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
                popuplayertitle: 'Batas Kabupaten',
                interactive: false,
                title: 'Batas Kabupaten'
            });
var format_Dissolved_2 = new ol.format.GeoJSON();
var features_Dissolved_2 = format_Dissolved_2.readFeatures(json_Dissolved_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Dissolved_2 = new ol.source.Vector({
    attributions: [],
});
jsonSource_Dissolved_2.addFeatures(features_Dissolved_2);
var lyr_Dissolved_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Dissolved_2, 
                style: style_Dissolved_2,
                popuplayertitle: 'Area Cakupan',
                interactive: false,
                title: 'Area Cakupan'
            });
var format_Lines_3 = new ol.format.GeoJSON();
var features_Lines_3 = format_Lines_3.readFeatures(json_Lines_3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Lines_3 = new ol.source.Vector({
    attributions: [],
});
jsonSource_Lines_3.addFeatures(features_Lines_3);
var lyr_Lines_3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Lines_3, 
                style: style_Lines_3,
                popuplayertitle: 'Ruas Jalan',
                interactive: false,
                title: '<img src="styles/legend/Lines_3.png" /> Ruas Jalan'
            });
var format_260331_4 = new ol.format.GeoJSON();
var features_260331_4 = format_260331_4.readFeatures(json_260331_4, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_260331_4 = new ol.source.Vector({
    attributions: [],
});
jsonSource_260331_4.addFeatures(features_260331_4);
var lyr_260331_4 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_260331_4, 
                style: style_260331_4,
                popuplayertitle: 'Titik PJUTS',
                interactive: true,
                title: '<img src=\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="0 0 36 48"><path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="%23e63946" stroke="%23b21f2d" stroke-width="1.5"/><circle cx="18" cy="18" r="6.5" fill="%23ffffff"/></svg>\' /> Titik PJUTS'
            });
var group_RAW = new ol.layer.Group({
                                layers: [lyr_260331_4,],
                                fold: 'open',
                                title: 'Data Lapangan'});

lyr_GoogleSatellite_0.setVisible(true);lyr_BatasKabupaten2011_1.setVisible(true);lyr_Dissolved_2.setVisible(true);lyr_Lines_3.setVisible(true);lyr_260331_4.setVisible(true);
var layersList = [lyr_GoogleSatellite_0,lyr_BatasKabupaten2011_1,lyr_Dissolved_2,lyr_Lines_3,group_RAW];
lyr_BatasKabupaten2011_1.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_Dissolved_2.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_Lines_3.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_260331_4.set('fieldAliases', {'fid': 'ID', 'Nomor': 'Nomor Titik', 'Nama Anggota': 'Petugas Survey', 'Alamat': 'Alamat', 'Longitude': 'Longitude', 'Latitude': 'Latitude', 'Tanggal Dokumentasi': 'Tanggal Dokumentasi', 'Keterangan': 'Keterangan', 'layer': 'Layer', 'Foto Survey Awal': 'Foto Lokasi', 'Toleransi': 'Toleransi', });
lyr_BatasKabupaten2011_1.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_Dissolved_2.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_Lines_3.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_260331_4.set('fieldImages', {'fid': 'TextEdit', 'Nomor': 'TextEdit', 'Nama Anggota': 'TextEdit', 'Alamat': 'TextEdit', 'Longitude': 'TextEdit', 'Latitude': 'TextEdit', 'Tanggal Dokumentasi': 'TextEdit', 'Keterangan': 'TextEdit', 'layer': 'TextEdit', 'Foto Survey Awal': 'ExternalResource', 'Toleransi': '', });
lyr_BatasKabupaten2011_1.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'no label', 'KABUPATEN_': 'header label - always visible', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_Dissolved_2.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'no label', 'KABUPATEN_': 'no label', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_Lines_3.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'inline label - always visible', 'KABUPATEN_': 'no label', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_260331_4.set('fieldLabels', {'fid': 'hidden field', 'Nomor': 'inline label - always visible', 'Nama Anggota': 'inline label - visible with data', 'Alamat': 'inline label - visible with data', 'Longitude': 'hidden field', 'Latitude': 'hidden field', 'Tanggal Dokumentasi': 'inline label - visible with data', 'Keterangan': 'inline label - visible with data', 'layer': 'hidden field', 'Foto Survey Awal': 'inline label - visible with data', 'Toleransi': 'hidden field', });
lyr_260331_4.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});