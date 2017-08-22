require(["dojo/parser", "dijit/registry", 'dojo/on', "esri/map", "esri/geometry/Extent", "esri/SpatialReference", "esri/InfoTemplate", "esri/layers/ArcGISTiledMapServiceLayer", "esri/graphic", "esri/toolbars/draw",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/Color",
    "esri/tasks/QueryTask", "esri/tasks/query", "esri/tasks/GeometryService", "esri/tasks/BufferParameters", "dojo/_base/array", "dojo/data/ItemFileReadStore", "dojox/grid/DataGrid",
    "dijit/form/Button", "dojo/domReady!"],
    function (parser, registry, on, Map, Extent, SpatialReference, InfoTemplate, ArcGISTiledMapServiceLayer, Graphic, Draw,
        SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color,
        QueryTask, Query, GeometryService, BufferParameters, array, ItemFileReadStore) {

        parser.parse();

        var extent = new Extent(-95.271, 38.933, -95.228, 38.976, new SpatialReference({ wkid: 4326 }))
        var map = new esri.Map("map", {
            extent: extent
        });

        var streetMap = new ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer");
        map.addLayer(streetMap);

        registry.forEach(function (d) {
            if (d.declaredClass === "dijit.form.Button") {
                d.on("click", activateTool);
            }
        });        

        // 信息模板
        var infoTemplate = new InfoTemplate();
        infoTemplate.setTitle("详细信息：");
        infoTemplate.setContent("街区： ${BLOCK},<br/>户数： ${HOUSEHOLDS},<br/>人口： ${POP2000}");

        esriConfig.defaults.io.proxyUrl = "proxy.ashx";
        esriConfig.defaults.io.alwaysUseProxy = false;

        var gsvc = new esri.tasks.GeometryService("http://sampleserver1.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer");

        // 初始化查询任务与查询参数   
        var queryTask = new QueryTask("http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Demographics/ESRI_Census_USA/MapServer/0");
        var query = new Query();
        query.returnGeometry = true;
        query.outFields = ["ObjectID", "POP2000", "HOUSEHOLDS", "BLOCK"];

        var tb = new Draw(map);
        tb.on("draw-end", doBuffer);

        // 监听表格中行点击事件
        gridWidget.on("RowClick", onTableRowClick);

        // 设置表格结构
        setGridHeader();

        function activateTool() {
            var tool = null;
            if (this.label == "删除选择结果") {
                remove();
            } else {
                switch (this.label) {
                    case "多边形":
                        tool = "POLYGON";
                        break;
                    case "线":
                        tool = "POLYLINE";
                        break;
                    case "点":
                        tool = "POINT";
                        break;
                }
                tb.activate(Draw[tool]);
                map.hideZoomSlider();
            }
        }

        function setGridHeader() {
            var layout = [
                 { field: 'BLOCK', name: '街区号', width: "100px", headerStyles: "text-align:center;" },
                 { field: 'HOUSEHOLDS', name: '户数', width: "100px", headerStyles: "text-align:center;" },
                 { field: 'POP2000', name: '人口', width: "100px", headerStyles: "text-align:center;" }
            ];

            gridWidget.setStructure(layout);
        }

        function doBuffer(evt) {
            map.graphics.clear();

            var params = new BufferParameters();
            params.geometries = [evt.geometry];
            params.distances = [document.getElementById('bufferDistance').value];
            params.unit = GeometryService.UNIT_KILOMETER;
            params.outSpatialReference = map.spatialReference;
            params.bufferSpatialReference = new SpatialReference({ wkid: 102113 });
            gsvc.buffer(params, doQuery);
        }

        function doQuery(polygon) {
            var symbol = new SimpleFillSymbol("none",
                new SimpleLineSymbol("dashdot", new Color([255, 0, 0]), 2),
                new Color([255, 255, 0, 0.25]));
            var graphic = new Graphic(polygon[0], symbol);
            map.graphics.add(graphic);

            query.geometry = graphic.geometry;
            queryTask.execute(query, showResult);
        }

        function showResult(fset) {
            var symbol = new SimpleMarkerSymbol();
            symbol.style = SimpleMarkerSymbol.STYLE_SQUARE;
            symbol.setSize(8);
            symbol.setColor(new Color([255, 255, 0, 0.5]));

            var resultFeatures = fset.features;
            for (var i = 0, il = resultFeatures.length; i < il; i++) {
                var graphic = resultFeatures[i];
                graphic.setSymbol(symbol);
                graphic.setInfoTemplate(infoTemplate);
                map.graphics.add(graphic);
            }

            // 将属性信息显示在Grid中
            drawTable(resultFeatures);

            var totalPopulation = sumPopulation(fset);
            var r = "";
            r = "<i>" + totalPopulation + "</i>";
            document.getElementById('totalPopulation').innerHTML = r;

            document.getElementById("numberOfBlocks").innerHTML = resultFeatures.length;

            tb.deactivate();
        }

        function drawTable(features) {
            // 创建需要加入到Store中的数据
            var items = [];
            if (features !== undefined) {
                for (var i = 0, il = features.length; i < il; i++) {
                    var attr = features[i].attributes;
                    items.push(attr);
                }
            }

            // 将数据转换为可用于store的格式
            var data = {
                identifier: "ObjectID",  // 唯一标识字段
                label: "ObjectID",
                items: items
            };

            var store = new ItemFileReadStore({ data: data });
            gridWidget.setStore(store);
            gridWidget.setQuery({ BLOCK: '*' });
        }

        function sumPopulation(fset) {
            var features = fset.features;
            var popTotal = 0;
            for (var x = 0; x < features.length; x++) {
                popTotal = popTotal + parseInt(features[x].attributes['POP2000'], 10);
            }
            return popTotal;
        }

        function onTableRowClick(evt) {
            var clickedId = gridWidget.getItem(evt.rowIndex).ObjectID;
            var graphic;
            for (var i = 0, il = map.graphics.graphics.length; i < il; i++) {
                var currentGraphic = map.graphics.graphics[i];
                if ((currentGraphic.attributes) && currentGraphic.attributes.ObjectID == clickedId) {
                    graphic = currentGraphic;
                    break;
                }
            }

            var p = map.toScreen(graphic.geometry);
            var iw = map.infoWindow;
            iw.setTitle(graphic.getTitle());
            iw.setContent(graphic.getContent());
            iw.show(p, map.getInfoWindowAnchor(p));
        }
});
