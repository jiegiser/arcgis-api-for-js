require(["dojo/parser", "dijit/registry", 'dojo/on', "esri/map", "esri/geometry/Extent", "esri/SpatialReference", "esri/InfoTemplate", "esri/layers/ArcGISTiledMapServiceLayer", "esri/graphic", "esri/toolbars/draw",
    "esri/symbols/PictureMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/Color",
    "esri/tasks/QueryTask", "esri/tasks/query", "dojo/_base/array", "dojo/data/ItemFileReadStore", "dojox/grid/DataGrid",
    "dijit/form/Button", "dojo/domReady!"],
    function (parser, registry, on, Map, Extent, SpatialReference, InfoTemplate, ArcGISTiledMapServiceLayer, Graphic, Draw,
        PictureMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color,
        QueryTask, Query, array, ItemFileReadStore) {

        parser.parse();

        var extent = new Extent(-95.271, 38.933, -95.228, 38.976, new SpatialReference({ wkid: 4326 }))
        var map = new esri.Map("map", {
            extent: extent
        });

        var tb = new Draw(map);
        tb.on("draw-end", addGraphic);

        //Create a new street map layer
        var streetMap = new ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/ESRI_StreetMap_World_2D/MapServer");
        map.addLayer(streetMap);

        registry.forEach(function (d) {
            if (d.declaredClass === "dijit.form.Button") {
                d.on("click", activateTool);
            }
        });

        //Listen for row clicks in the dojo table
        gridWidget.on("RowClick", onTableRowClick);

        //Populate table with headers
        setGridHeader();

        //info template for points returned
        var resultTemplate = new InfoTemplate();
        resultTemplate.setTitle("详细信息：");
        resultTemplate.setContent("街区： ${BLOCK},<br/>户数： ${HOUSEHOLDS},<br/>人口： ${POP2000}");

        var symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.5]));
        var pntSym1 = new PictureMarkerSymbol("images/CircleBlue16.png", 16, 16);
        var pntSym2 = new PictureMarkerSymbol("images/CircleBlue24.png", 24, 24);
        var pntSym3 = new PictureMarkerSymbol("images/CircleRed32.png", 32, 32);

        // 初始化查询任务与查询参数   
        var queryTask = new QueryTask("http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Demographics/ESRI_Census_USA/MapServer/0");
        queryTask.on("complete", showResult);
        var query = new Query();
        query.returnGeometry = true;
        query.outFields = ["ObjectID", "POP2000", "HOUSEHOLDS", "BLOCK"];

        function activateTool() {
            var tool = null;
            if (this.label == "删除选择结果") {
                remove();
            } else {
                switch (this.label) {
                    case "多边形":
                        tool = "POLYGON";
                        break;
                    case "徒手多边形":
                        tool = "FREEHAND_POLYGON";
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


        //Draw a dojox table using an array as input
        function drawTable(features) {
            var items = []; //all items to be stored in data store

            //items = dojo.map(features, function(feature) {return feature.attributes});
            items = array.map(features, "return item.attributes");

            //Create data object to be used in store
            var data = {
                identifier: "ObjectID",  //This field needs to have unique values
                label: "ObjectID", //Name field for display. Not pertinent to a grid but may be used elsewhere.
                items: items
            };
            var store = new ItemFileReadStore({ data: data });

            gridWidget.setStore(store);
            gridWidget.setQuery({ BLOCK: '*' });
        }

        //Set drawing properties and add polygon to map
        function addGraphic(geometry) {
            var handgraphic = new Graphic(geometry, symbol);
            map.graphics.add(handgraphic);

            // 改变信息窗口的大小
            map.infoWindow.resize(160, 95);

            // 将用户绘制的几何对象传入查询参数
            query.geometry = handgraphic.geometry;
            queryTask.execute(query);
        }

        function showResult(evt) {
            var resultFeatures = evt.featureSet.features;
            for (var i = 0, il = resultFeatures.length; i < il; i++) {
                var graphic = resultFeatures[i];

                //Assign a symbol sized based on populuation
                setTheSymbol(graphic);

                graphic.setInfoTemplate(resultTemplate);
                map.graphics.add(graphic);
            }

            var totalPopulation = sumPopulation(evt.featureSet);
            var r = "<i>" + totalPopulation + "</i>";
            document.getElementById('totalPopulation').innerHTML = r;

            document.getElementById("numberOfBlocks").innerHTML = resultFeatures.length;

            drawTable(resultFeatures);

            tb.deactivate();
        }

        //Set the symbol based on population
        function setTheSymbol(graphic) {
            if (graphic.attributes['POP2000'] < 50) {
                return graphic.setSymbol(pntSym1);
            }
            else if (graphic.attributes['POP2000'] < 100) {
                return graphic.setSymbol(pntSym2);
            }
            else {
                return graphic.setSymbol(pntSym3);
            }
        }

        //calculate the total population using a featureSet
        function sumPopulation(fset) {
            var features = fset.features;
            var popTotal = 0;
            var intHolder = 0;
            for (var x = 0; x < features.length; x++) {
                popTotal = popTotal + features[x].attributes['POP2000'];
            }
            return popTotal;
        }

        //On row click
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

        function remove() {
            //clear all graphics from map
            map.graphics.clear();
            map.infoWindow.hide();

            //Reset the divs to display 0
            var r = "0";
            dojo.byId('numberOfBlocks').innerHTML = r;
            dojo.byId('totalPopulation').innerHTML = r;

            drawTable();
        }
});