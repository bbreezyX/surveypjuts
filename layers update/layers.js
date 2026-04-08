var wms_layers = [];


        var lyr_GoogleSatellite_0 = new ol.layer.Tile({
            'title': 'Google Satellite',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            })
        });
var format_BatasKabupaten2011_1 = new ol.format.GeoJSON();
var features_BatasKabupaten2011_1 = format_BatasKabupaten2011_1.readFeatures(json_BatasKabupaten2011_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_BatasKabupaten2011_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_BatasKabupaten2011_1.addFeatures(features_BatasKabupaten2011_1);
var lyr_BatasKabupaten2011_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_BatasKabupaten2011_1, 
                style: style_BatasKabupaten2011_1,
                popuplayertitle: 'Batas Kabupaten 2011',
                interactive: false,
                title: 'Batas Kabupaten 2011'
            });
var format_Dissolved_2 = new ol.format.GeoJSON();
var features_Dissolved_2 = format_Dissolved_2.readFeatures(json_Dissolved_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Dissolved_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Dissolved_2.addFeatures(features_Dissolved_2);
var lyr_Dissolved_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Dissolved_2, 
                style: style_Dissolved_2,
                popuplayertitle: 'Dissolved',
                interactive: false,
                title: 'Dissolved'
            });
var format_Lines_3 = new ol.format.GeoJSON();
var features_Lines_3 = format_Lines_3.readFeatures(json_Lines_3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Lines_3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Lines_3.addFeatures(features_Lines_3);
var lyr_Lines_3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Lines_3, 
                style: style_Lines_3,
                popuplayertitle: 'Lines',
                interactive: false,
                title: '<img src="styles/legend/Lines_3.png" /> Lines'
            });
var format_260408_4 = new ol.format.GeoJSON();
var features_260408_4 = format_260408_4.readFeatures(json_260408_4, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_260408_4 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_260408_4.addFeatures(features_260408_4);
var lyr_260408_4 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_260408_4, 
                style: style_260408_4,
                popuplayertitle: '260408',
                interactive: true,
                title: '<img src="styles/legend/260408_4.png" /> 260408'
            });
var group_TitiktitikKoordinat = new ol.layer.Group({
                                layers: [lyr_260408_4,],
                                fold: 'open',
                                title: 'Titik-titik Koordinat'});

lyr_GoogleSatellite_0.setVisible(true);lyr_BatasKabupaten2011_1.setVisible(true);lyr_Dissolved_2.setVisible(true);lyr_Lines_3.setVisible(true);lyr_260408_4.setVisible(true);
var layersList = [lyr_GoogleSatellite_0,lyr_BatasKabupaten2011_1,lyr_Dissolved_2,lyr_Lines_3,group_TitiktitikKoordinat];
lyr_BatasKabupaten2011_1.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_Dissolved_2.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_Lines_3.set('fieldAliases', {'FIRST_NEG_': 'FIRST_NEG_', 'FIRST_PRO_': 'FIRST_PRO_', 'KABUPATEN_': 'KABUPATEN_', 'SHAPE_LENG': 'SHAPE_LENG', 'SHAPE_AREA': 'SHAPE_AREA', 'AREA': 'AREA', 'PERIMETER': 'PERIMETER', 'ACRES': 'ACRES', 'HECTARES': 'HECTARES', });
lyr_260408_4.set('fieldAliases', {'fid': 'fid', 'Nomor': 'Nomor', 'Nama Anggota': 'Nama Anggota', 'Alamat': 'Alamat', 'Longitude': 'Longitude', 'Latitude': 'Latitude', 'Tanggal Dokumentasi': 'Tanggal Dokumentasi', 'Keterangan': 'Keterangan', 'Foto Survei Awal': 'Survei Pendahuluan', });
lyr_BatasKabupaten2011_1.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_Dissolved_2.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_Lines_3.set('fieldImages', {'FIRST_NEG_': '', 'FIRST_PRO_': '', 'KABUPATEN_': '', 'SHAPE_LENG': '', 'SHAPE_AREA': '', 'AREA': '', 'PERIMETER': '', 'ACRES': '', 'HECTARES': '', });
lyr_260408_4.set('fieldImages', {'fid': 'TextEdit', 'Nomor': 'TextEdit', 'Nama Anggota': 'TextEdit', 'Alamat': 'TextEdit', 'Longitude': 'TextEdit', 'Latitude': 'TextEdit', 'Tanggal Dokumentasi': 'TextEdit', 'Keterangan': 'TextEdit', 'Foto Survei Awal': 'ExternalResource', });
lyr_BatasKabupaten2011_1.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'no label', 'KABUPATEN_': 'header label - always visible', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_Dissolved_2.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'no label', 'KABUPATEN_': 'no label', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_Lines_3.set('fieldLabels', {'FIRST_NEG_': 'no label', 'FIRST_PRO_': 'inline label - always visible', 'KABUPATEN_': 'no label', 'SHAPE_LENG': 'no label', 'SHAPE_AREA': 'no label', 'AREA': 'no label', 'PERIMETER': 'no label', 'ACRES': 'no label', 'HECTARES': 'no label', });
lyr_260408_4.set('fieldLabels', {'fid': 'hidden field', 'Nomor': 'inline label - visible with data', 'Nama Anggota': 'inline label - visible with data', 'Alamat': 'inline label - visible with data', 'Longitude': 'hidden field', 'Latitude': 'hidden field', 'Tanggal Dokumentasi': 'inline label - visible with data', 'Keterangan': 'inline label - visible with data', 'Foto Survei Awal': 'header label - visible with data', });
lyr_260408_4.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});