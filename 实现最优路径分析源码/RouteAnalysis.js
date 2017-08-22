var map, routeTask, routeParams, routes = [];
var stopSymbol, barrierSymbol, routeSymbol;
var mapOnClick_addStops_connect = null, mapOnClick_addBarriers_connect = null;
require(["esri/map", "esri/geometry/Extent", "esri/SpatialReference", "esri/layers/ArcGISTiledMapServiceLayer",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/Color",
    "esri/tasks/RouteTask", "esri/tasks/RouteParameters", "esri/tasks/FeatureSet", "dojo/domReady!"],
    function (Map, Extent, SpatialReference, ArcGISTiledMapServiceLayer, SimpleMarkerSymbol, SimpleLineSymbol, Color,
        RouteTask, RouteParameters, FeatureSet) {
        var extent = new Extent(-122.42885112762451, 37.79326915740967, -122.40310192108154, 37.81043529510498, new SpatialReference({ wkid: 4326 }))
        map = new esri.Map("map", {
            extent: extent
        });

        var streetMap = new ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/ESRI_StreetMap_World_2D/MapServer");
        map.addLayer(streetMap);

        routeTask = new RouteTask("http://tasks.arcgisonline.com/ArcGIS/rest/services/NetworkAnalysis/ESRI_Route_NA/NAServer/Route");
        routeParams = new RouteParameters();
        routeParams.stops = new FeatureSet();
        routeParams.barriers = new FeatureSet();

        stopSymbol = new SimpleMarkerSymbol().setStyle(SimpleMarkerSymbol.STYLE_CROSS).setSize(15);
        stopSymbol.outline.setWidth(3);

        barrierSymbol = new SimpleMarkerSymbol().setStyle(SimpleMarkerSymbol.STYLE_X).setSize(10);
        barrierSymbol.outline.setWidth(3).setColor(new Color([255, 0, 0]));

        routeSymbol = new SimpleLineSymbol().setColor(new Color([0, 0, 255, 0.5])).setWidth(5);
});

//Begins listening for click events to add stops
function addStops() {
    removeEventHandlers();
    mapOnClick_addStops_connect = map.on("click", addStop);
}

//Clears all stops
function clearStops() {
    removeEventHandlers();
    for (var i = routeParams.stops.features.length - 1; i >= 0; i--) {
        map.graphics.remove(routeParams.stops.features.splice(i, 1)[0]);
    }
}

//Adds a stop. The stop is associated with the route currently displayed in the dropdown
function addStop(evt) {
    require(["esri/graphic"], function (Graphic) {
        var graphic = new Graphic(evt.mapPoint, stopSymbol);
        routeParams.stops.features.push(
              map.graphics.add(graphic)
            );
    });
}

//Begins listening for click events to add barriers
function addBarriers() {
    removeEventHandlers();
    mapOnClick_addBarriers_connect = map.on("click", addBarrier);
}

//Clears all barriers
function clearBarriers() {
    removeEventHandlers();
    for (var i = routeParams.barriers.features.length - 1; i >= 0; i--) {
        map.graphics.remove(routeParams.barriers.features.splice(i, 1)[0]);
    }
}

//Adds a barrier
function addBarrier(evt) {
    require(["esri/graphic"], function (Graphic) {
        var graphic = new Graphic(evt.mapPoint, barrierSymbol);
        routeParams.barriers.features.push(
              map.graphics.add(graphic)
            );
    });
}

//Stops listening for click events to add barriers and stops
function removeEventHandlers() {
    if (mapOnClick_addStops_connect != null) {
        mapOnClick_addStops_connect.remove();
    }
    if (mapOnClick_addBarriers_connect != null) {
        mapOnClick_addBarriers_connect.remove();
    }
}

//Solves the routes. Any errors will trigger the errorHandler function.
function solveRoute() {
    removeEventHandlers();
    routeTask.solve(routeParams, showRoute, errorHandler);
}

//Clears all routes
function clearRoutes() {
    for (var i = routes.length - 1; i >= 0; i--) {
        map.graphics.remove(routes.splice(i, 1)[0]);
    }
    routes = [];
}

//Draws the resulting routes on the map
function showRoute(result) {
    clearRoutes();

    var routeResults = result.routeResults;
    routes.push(
        map.graphics.add(routeResults[0].route.setSymbol(routeSymbol))
        );

    var msgs = ["服务器消息："];
    for (var i = 0; i < result.messages.length; i++) {
        msgs.push(result.messages[i].type + " : " + result.messages[i].description);
    }
    if (msgs.length > 1) {
        alert(msgs.join("\n - "));
    }
}

//Reports any errors that occurred during the solve
function errorHandler(err) {
    alert("发生错误\n" + err.message + "\n" + err.details.join("\n"));
}