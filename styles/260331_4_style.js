var size = 0;
var placement = 'point';

var pinSvg_260331_4 =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 36 48">' +
        '<filter id="p"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.35"/></filter>' +
        '<path filter="url(%23p)" d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="%23e63946" stroke="%23b21f2d" stroke-width="1.5"/>' +
        '<circle cx="18" cy="18" r="6.5" fill="%23ffffff"/>' +
    '</svg>';
var pinIcon_260331_4 = new ol.style.Icon({
    src: 'data:image/svg+xml,' + pinSvg_260331_4,
    anchor: [0.5, 1],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
    scale: 1
});

var style_260331_4 = function(feature, resolution){
    var context = {
        feature: feature,
        variables: {}
    };

    var labelText = "";
    var value = feature.get("");
    var labelFont = "10px, sans-serif";
    var labelFill = "#000000";
    var bufferColor = "";
    var bufferWidth = 0;
    var textAlign = "left";
    var offsetX = 0;
    var offsetY = 0;
    var placement = 'point';
    if ("" !== null) {
        labelText = String("");
    }
    var style = [ new ol.style.Style({
        image: pinIcon_260331_4,
        text: createTextStyle(feature, resolution, labelText, labelFont,
                              labelFill, placement, bufferColor,
                              bufferWidth)
    })];

    return style;
};
