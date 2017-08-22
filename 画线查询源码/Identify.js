var map, identifyTask, identifyParams;
var pointSym, lineSym, polygonSym;
var layer2results, layer1results, layer0results;

require(["dojo/parser", "dijit/registry", "esri/map", "esri/layers/ArcGISDynamicMapServiceLayer", "esri/toolbars/draw",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/Color",
    "esri/tasks/IdentifyTask", "esri/tasks/IdentifyParameters", "esri/geometry/screenUtils",
    "dijit/form/Button", "dijit/layout/TabContainer", "dijit/layout/ContentPane", "dojo/domReady!"],
    function (parser, registry, Map, ArcGISDynamicMapServiceLayer, Draw,
        SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color,
        IdentifyTask, IdentifyParameters, screenUtils) {

        parser.parse();

        map = new Map("mapDiv");
        var url = "http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Specialty/ESRI_StatesCitiesRivers_USA/MapServer";
        var agoLayer = new ArcGISDynamicMapServiceLayer(url);
        map.addLayer(agoLayer);
        map.on("load", initIdentify);

        var redColor = new Color([255, 0, 0]);
        var halfFillYellow = new Color([255, 255, 0, 0.5]);
        pointSym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 10,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, redColor, 1),
                    halfFillYellow);
        lineSym = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, redColor, 2);
        polygonSym = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, redColor, 2),
                    halfFillYellow);        

        map.infoWindow.on("show", function () {
            registry.byId("tabs").resize();
        });

        var tb = new Draw(map);
        tb.on("draw-end", doIdentify);

        registry.forEach(function (d) {
            if (d.declaredClass === "dijit.form.Button") {
                d.on("click", activateTool);
            }
        });

        function activateTool() {
            var tool = null;
            switch (this.label) {
                case "点":
                    tool = "POINT";
                    break;
                case "线":
                    tool = "POLYLINE";
                    break;
                case "多边形":
                    tool = "POLYGON";
                    break;
            }
            tb.activate(Draw[tool]);
            map.hideZoomSlider();
        }

        function initIdentify(evt) {
            // 实例化IdentifyTask
            identifyTask = new IdentifyTask(url);
            // IdentifyTask参数设置
            identifyParams = new IdentifyParameters();
            // 冗余范围
            identifyParams.tolerance = 3;
            // 返回地理元素
            identifyParams.returnGeometry = true;
            // 进行Identify的图层
            identifyParams.layerIds = [2, 1, 0];
            // 进行Identify的图层为全部
            identifyParams.layerOption = IdentifyParameters.LAYER_OPTION_ALL;

            // 设置infoWindow的大小
            evt.map.infoWindow.resize(415, 200);
            // 设置infoWindow的标题头
            evt.map.infoWindow.setTitle("Identify结果");
            evt.map.infoWindow.setContent(registry.byId("tabs").domNode);
        }

        // 进行Identify
        function doIdentify(evt) {
            // 清除上一次的高亮显示
            map.graphics.clear();
            // Identify的geometry
            identifyParams.geometry = evt.geometry;
            // Identify范围
            identifyParams.mapExtent = map.extent;
            identifyTask.execute(identifyParams, function (idResults) {
                addToMap(idResults, evt.geometry);
            });
        }

        // 在infoWindow中显示Identify结果
        function addToMap(idResults, geometry) {
            layer2results = { displayFieldName: null, features: [] };
            layer1results = { displayFieldName: null, features: [] };
            layer0results = { displayFieldName: null, features: [] };
            for (var i = 0, il = idResults.length; i < il; i++) {
                var idResult = idResults[i];
                if (idResult.layerId === 2) {
                    if (!layer2results.displayFieldName) {
                        layer2results.displayFieldName = idResult.displayFieldName;
                    }
                    layer2results.features.push(idResult.feature);
                } else if (idResult.layerId === 1) {
                    if (!layer1results.displayFieldName) {
                        layer1results.displayFieldName = idResult.displayFieldName;
                    }
                    layer1results.features.push(idResult.feature);
                } else if (idResult.layerId === 0) {
                    if (!layer0results.displayFieldName) {
                        layer0results.displayFieldName = idResult.displayFieldName;
                    }
                    layer0results.features.push(idResult.feature);
                }
            }
            registry.byId("layer2Tab").setContent(layerTabContent(layer2results, "layer2results"));
            registry.byId("layer1Tab").setContent(layerTabContent(layer1results, "layer1results"));
            registry.byId("layer0Tab").setContent(layerTabContent(layer0results, "layer0results"));

            // 设置infoWindow显示
            var firstPt;
            if (geometry.type == "point")
                firstPt = geometry;
            else
                firstPt = geometry.getPoint(0, 0);
            var screenPoint = screenUtils.toScreenPoint(map.extent, map.width, map.height, firstPt);
            map.infoWindow.show(screenPoint, map.getInfoWindowAnchor(screenPoint));
        }

        function layerTabContent(layerResults, layerName) {
            var content = "<i>选中要素数目为：" + layerResults.features.length + "</i>";
            switch (layerName) {
                case "layer2results":
                    content += "<table border='1'><tr><th>ID</th><th>州名</th><th>面积</th></tr>";
                    for (var i = 0, il = layerResults.features.length; i < il; i++) {
                        content += "<tr><td>" + layerResults.features[i].attributes['FID'] + " <a href='#' onclick='showFeature(" + layerName + ".features[" + i + "]); return false;'>(显示)</a></td>";
                        content += "<td>" + layerResults.features[i].attributes['STATE_NAME'] + "</td>";
                        content += "<td>" + layerResults.features[i].attributes['AREA'] + "</td>";
                    }
                    content += "</tr></table>";
                    break;
                case "layer1results":
                    content += "<table border='1'><tr><th>ID</th><th>名称</th></tr>";
                    for (var i = 0, il = layerResults.features.length; i < il; i++) {
                        content += "<tr><td>" + layerResults.features[i].attributes['FID'] + " <a href='#' onclick='showFeature(" + layerName + ".features[" + i + "]); return false;'>(显示)</a></td>";
                        content += "<td>" + layerResults.features[i].attributes['NAME'] + "</td>";
                    }
                    content += "</tr></table>";
                    break;
                case "layer0results":
                    content += "<table border='1'><tr><th>ID</th><th>名称</th><th>州名</th><th>人口</th></tr>";
                    for (var i = 0, il = layerResults.features.length; i < il; i++) {
                        content += "<tr><td>" + layerResults.features[i].attributes['FID'] + " <a href='#' onclick='showFeature(" + layerName + ".features[" + i + "]); return false;'>(显示)</a></td>";
                        content += "<td>" + layerResults.features[i].attributes['CITY_NAME'] + "</td>";
                        content += "<td>" + layerResults.features[i].attributes['STATE_NAME'] + "</td>";
                        content += "<td>" + layerResults.features[i].attributes['POP1990'] + "</td>";
                    }
                    content += "</tr></table>";
                    break;
            }
            return content;
        }
});

// 高亮显示选中元素
function showFeature(feature) {
    map.graphics.clear();
    var symbol;
    // 将几何对象加入到地图中
    switch (feature.geometry.type) {
        case "point":
            symbol = pointSym;
            break;
        case "polyline":
            symbol = lineSym;
            break;
        case "polygon":
            symbol = polygonSym;
            break;
    }

    feature.setSymbol(symbol);
    map.graphics.add(feature);
}
