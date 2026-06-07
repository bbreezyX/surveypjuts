var size = 0;
var placement = 'point';

var style_Dissolved_2 = function(feature, resolution){
    var context = {
        feature: feature,
        variables: {}
    };
    
    var style = [ new ol.style.Style({
        fill: new ol.style.Fill({color: 'rgba(245, 158, 11, 0.10)'}),
        stroke: new ol.style.Stroke({color: 'rgba(245, 158, 11, 0.6)', width: 1.5, lineDash: [6, 4]})
    })];

    return style;
};
