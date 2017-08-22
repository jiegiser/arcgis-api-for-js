require(["dojo/parser", "esri/map", "esri/geometry/Extent", "esri/SpatialReference", "esri/layers/ArcGISTiledMapServiceLayer",
    "esri/graphic", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/Color",
    "esri/tasks/Geoprocessor", "esri/tasks/LinearUnit", "esri/tasks/FeatureSet", "dojo/domReady!"],
    function (parser, Map, Extent, SpatialReference, ArcGISTiledMapServiceLayer,
        Graphic, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color,
        Geoprocessor, LinearUnit, FeatureSet) {
        parser.parse();

        var extent = new Extent(-122.7268, 37.4557, -122.1775, 37.8649, new SpatialReference({ wkid: 4326 }))
        var map = new esri.Map("map", {
            extent: extent
        });

        var streetMap = new ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer");
        map.addLayer(streetMap);

        var gp = new Geoprocessor("http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Elevation/ESRI_Elevation_World/GPServer/Viewshed");
        gp.setOutputSpatialReference({ wkid: 102100 });

        map.on("click", computeViewShed);

        function computeViewShed(evt) {
            map.graphics.clear();
            var pointSymbol = new SimpleMarkerSymbol();
            pointSymbol.setSize(15);
            pointSymbol.setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1));
            pointSymbol.setColor(new dojo.Color([0, 255, 0, 0.25]));

            var graphic = new Graphic(evt.mapPoint, pointSymbol);
            map.graphics.add(graphic);

            var features = [];
            features.push(graphic);
            var featureSet = new FeatureSet();
            featureSet.features = features;
            var vsDistance = new LinearUnit();
            vsDistance.distance = 15000;
            vsDistance.units = "esriMeters";
            var params = { "Input_Observation_Point": featureSet, "Viewshed_Distance": vsDistance };
            gp.execute(params, drawViewshed);
        }

        function drawViewshed(results, messages) {
            var polySymbol = new SimpleFillSymbol();
            polySymbol.setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 0, 0.5]), 1));
            polySymbol.setColor(new Color([255, 127, 0, 0.7]));
            var features = results[0].value.features;
            for (var f = 0, fl = features.length; f < fl; f++) {
                var feature = features[f];
                feature.setSymbol(polySymbol);
                map.graphics.add(feature);
            }
        }
});