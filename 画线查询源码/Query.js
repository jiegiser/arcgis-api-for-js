var map, tb, statesTask, riversTask, citiesTask, query;
var statesInfoTemplate, riversInfoTemplate, citiesInfoTemplate;
var pointSym, lineSym, polygonSym;

require(["dojo/parser", "dijit/registry", "esri/map", "esri/layers/ArcGISDynamicMapServiceLayer", "esri/toolbars/draw",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/Color",
    "esri/tasks/QueryTask", "esri/tasks/query", 
    "dijit/form/Button", "dojo/domReady!"],
    function (parser, registry, Map, ArcGISDynamicMapServiceLayer, Draw,
        SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color,
        QueryTask, Query) {

        parser.parse();

        map = new Map("mapDiv");
        var url = "http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Specialty/ESRI_StatesCitiesRivers_USA/MapServer";
        var agoLayer = new ArcGISDynamicMapServiceLayer(url);
        map.addLayer(agoLayer);

        var tb = new Draw(map);
        tb.on("draw-end", doQuery);

        registry.forEach(function (d) {
            if (d.declaredClass === "dijit.form.Button") {
                d.on("click", activateTool);
            }
        });

        // 实例化查询任务类
        statesTask = new esri.tasks.QueryTask(url + "/2");
        riversTask = new esri.tasks.QueryTask(url + "/1");
        citiesTask = new esri.tasks.QueryTask(url + "/0");

        // 实例化查询参数类
        query = new esri.tasks.Query();
        query.returnGeometry = true;

        // 实例化信息模板类
        statesInfoTemplate = new esri.InfoTemplate("${STATE_NAME}", "州名： ${STATE_NAME}<br/> <br />面积：${AREA}");
        riversInfoTemplate = new esri.InfoTemplate("${NAME}", "河流名称：${NAME}<br/><br/>流域名：${SYSTEM}");
        citiesInfoTemplate = new esri.InfoTemplate("${CITY_NAME}", "城市名：${CITY_NAME}<br/> 州名： ${STATE_NAME}<br />人口：${POP1990}");

        // 实例化符号类
        var redColor = new Color([255, 0, 0]);
        var halfFillYellow = new Color([255, 255, 0, 0.5]);
        pointSym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 10,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, redColor, 1),
                    halfFillYellow);
        lineSym = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, redColor, 2);
        polygonSym = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, redColor, 2),
                    halfFillYellow);

        function activateTool() {
            var tool = null;
            if (this.label == "取消查询") {
                tb.deactivate();
            } else {
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
        }

        function doQuery(evt) {
            query.geometry = evt.geometry;

            var taskName = document.getElementById("task").value;
            var queryTask;
            if (taskName === "statesTask") {
                queryTask = statesTask;
                query.outFields = ["STATE_NAME", "AREA"];
            }
            else if (taskName === "riversTask") {
                queryTask = riversTask;
                query.outFields = ["NAME", "SYSTEM"];
            }
            else {
                queryTask = citiesTask;
                query.outFields = ["CITY_NAME", "STATE_NAME", "POP1990"];
            }
            queryTask.execute(query, showResults);
        }

        function showResults(featureSet) {
            // 清除上一次的高亮显示
            map.graphics.clear();

            var symbol, infoTemplate;
            var taskName = document.getElementById("task").value;
            switch (taskName) {
                case "citiesTask":
                    symbol = pointSym;
                    infoTemplate = citiesInfoTemplate;
                    infoTemplate
                    break;
                case "riversTask":
                    symbol = lineSym;
                    infoTemplate = riversInfoTemplate;
                    break;
                case "statesTask":
                    symbol = polygonSym;
                    infoTemplate = statesInfoTemplate;
                    break;
            }

            var resultFeatures = featureSet.features;
            for (var i = 0, il = resultFeatures.length; i < il; i++) {
                // 从featureSet中得到当前地理特征
                // 地理特征就是一图形对象
                var graphic = resultFeatures[i];
                graphic.setSymbol(symbol);

                // 设置信息模板
                graphic.setInfoTemplate(infoTemplate);

                // 在地图的图形图层中增加图形
                map.graphics.add(graphic);
            }
        }
});
