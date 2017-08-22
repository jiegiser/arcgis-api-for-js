var map;
require(["dojo/parser", "dojo/on", "esri/map", "esri/geometry/Extent",
    "esri/SpatialReference", "esri/layers/ArcGISTiledMapServiceLayer", "esri/layers/ArcGISDynamicMapServiceLayer", "esri/geometry/Point", 
    "esri/tasks/FindTask", "esri/tasks/FindParameters", "esri/InfoTemplate",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/Color",
    "dijit/layout/BorderContainer", "dijit/layout/ContentPane", "dojo/domReady!"],
    function (parser, on, Map, Extent,
        SpatialReference, ArcGISTiledMapServiceLayer, ArcGISDynamicMapServiceLayer, Point,
        FindTask, FindParameters, InfoTemplate,
        SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color) {
        parser.parse();

        var startExtent = new Extent(-127.968857954995, 25.5778580720472, -65.0742781827045, 51.2983251993735, new SpatialReference({ wkid: 4326 }));
        map = new Map("mapDiv", {
            extent: startExtent
        });
        var agoServiceURL = "http://server.arcgisonline.com/ArcGIS/rest/services/ESRI_Imagery_World_2D/MapServer";
        var agoLayer = new ArcGISTiledMapServiceLayer(agoServiceURL);
        map.addLayer(agoLayer);

        // 动态图
        var usaBase = new ArcGISDynamicMapServiceLayer("http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Specialty/ESRI_StatesCitiesRivers_USA/MapServer");
        // 设置要显示的图层
        usaBase.setVisibleLayers([2, 1, 0]);
        // 设置图层透明度
        usaBase.setOpacity(0.8);
        map.addLayer(usaBase);

        // 实例化FindTask
        var findTask = new FindTask("http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Specialty/ESRI_StatesCitiesRivers_USA/MapServer");
        // FindTask的参数
        var findParams = new FindParameters();
        // 返回Geometry
        findParams.returnGeometry = true;
        // 查询的图层id
        findParams.layerIds = [0, 1, 2];
        // 查询字段
        findParams.searchFields = ["CITY_NAME", "NAME", "SYSTEM", "STATE_ABBR", "STATE_NAME"];

        var ptSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 10, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1), new Color([0, 255, 0, 0.25]));
        var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color([255, 0, 0]), 1);
        var polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NONE, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.25]));

        on(document.getElementById("findBtn"), "click", function () {
            execute(document.getElementById('searchText').value);
        });

        // 根据输入的关键字进行findTask操作
        function execute(searchText) {
            findParams.searchText = searchText;
            findTask.execute(findParams, showResults);
        }

        // 显示findTask的结果
        function showResults(results) {
            // 清除上一次的高亮显示
            map.graphics.clear();

            var innerHtml = "";
            var symbol;
            for (var i = 0; i < results.length; i++) {
                var curFeature = results[i];
                var graphic = curFeature.feature;
                var infoTemplate = null;

                // 根据类型设置显示样式
                switch (graphic.geometry.type) {
                    case "point":
                        symbol = ptSymbol;
                        infoTemplate = new InfoTemplate("${CITY_NAME}", "${*}");
                        break;
                    case "polyline":
                        var symbol = lineSymbol;
                        break;
                    case "polygon":
                        var symbol = polygonSymbol;
                        break;
                }
                // 设置显示样式
                graphic.setSymbol(symbol);
                graphic.setInfoTemplate(infoTemplate);
                // 添加到graphics进行高亮显示
                map.graphics.add(graphic);

                if (curFeature.layerId === 0) {
                    innerHtml += "<a href='javascript:positionFeature(" + graphic.attributes.FID + ")'>" + graphic.attributes.CITY_NAME + "</a><br>";
                }
                else if (curFeature.layerId === 1) {
                    innerHtml += "<a href='javascript:positionFeature(" + graphic.attributes.FID + ")'>" + graphic.attributes.NAME + "</a><br>";
                }
                else {
                    innerHtml += "<a href='javascript:positionFeature(" + graphic.attributes.FID + ")'>" + graphic.attributes.STATE_NAME + "</a><br>";
                }
            }

            document.getElementById("contentsContainer").innerHTML = innerHtml;
        }
        
        window.positionFeature = function (id) {
            var sGrapphic;
            //遍历地图的图形查找FID和点击行的FID相同的图形
            for (var i = 0; i < map.graphics.graphics.length; i++) {
                var cGrapphic = map.graphics.graphics[i];
                if ((cGrapphic.attributes) && cGrapphic.attributes.FID == id) {
                    sGrapphic = cGrapphic;
                    break;
                }
            }

            var sGeometry = sGrapphic.geometry;
            // 当点击的名称对应的图形为点类型时进行地图中心定位显示
            if (sGeometry.type == "point") {
                var cPoint = new Point();
                cPoint.x = sGeometry.x;
                cPoint.y = sGeometry.y;
                map.centerAt(cPoint);

                var p = map.toScreen(sGrapphic.geometry);
                var iw = map.infoWindow;
                iw.setTitle(sGrapphic.getTitle());
                iw.setContent(sGrapphic.getContent());
                iw.show(p, map.getInfoWindowAnchor(p));
            }
                //当点击的名称对应的图形为线或面类型时获取其范围进行放大显示
            else {
                var sExtent = sGeometry.getExtent();
                sExtent = sExtent.expand(2);
                map.setExtent(sExtent);
            }
        };
});
/*
function positionFeature(id) {
    require(["esri/geometry/Point"], function (Point) {
        var sGrapphic;
        //遍历地图的图形查找FID和点击行的FID相同的图形
        for (var i = 0; i < map.graphics.graphics.length; i++) {
            var cGrapphic = map.graphics.graphics[i];
            if ((cGrapphic.attributes) && cGrapphic.attributes.FID == id) {
                sGrapphic = cGrapphic;
                break;
            }
        }

        var sGeometry = sGrapphic.geometry;
        // 当点击的名称对应的图形为点类型时进行地图中心定位显示
        if (sGeometry.type == "point") {
            var cPoint = new Point();
            cPoint.x = sGeometry.x;
            cPoint.y = sGeometry.y;
            map.centerAt(cPoint);

            var p = map.toScreen(sGrapphic.geometry);
            var iw = map.infoWindow;
            iw.setTitle(sGrapphic.getTitle());
            iw.setContent(sGrapphic.getContent());
            iw.show(p, map.getInfoWindowAnchor(p));
        }
            //当点击的名称对应的图形为线或面类型时获取其范围进行放大显示
        else {
            var sExtent = sGeometry.getExtent();
            sExtent = sExtent.expand(2);
            map.setExtent(sExtent);
        }
    });    
}*/