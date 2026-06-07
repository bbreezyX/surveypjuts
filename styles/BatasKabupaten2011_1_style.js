var size = 0;
var placement = 'point';

var style_BatasKabupaten2011_1 = function(feature, resolution){
    var context = {
        feature: feature,
        variables: {}
    };
    
    var labelText = "";
    var value = feature.get("''");
    var labelFont = "700 13px \'Source Sans 3\', sans-serif";
    var labelFill = "#ffffff";
    var bufferColor = "rgba(11, 41, 66, 0.9)";
    var bufferWidth = 3.0;
    var textAlign = "left";
    var offsetX = 0;
    var offsetY = 0;
    var placement = 'point';
    if (feature.get("KABUPATEN_") !== null) {
        labelText = String(feature.get("KABUPATEN_"));
    }

    var style = [ new ol.style.Style({
        stroke: new ol.style.Stroke({color: 'rgba(255, 255, 255, 0.85)', width: 1.6}),
        text: createTextStyle(feature, resolution, labelText, labelFont,
                              labelFill, placement, bufferColor, bufferWidth)
    })];;

    return style;
};
