define(["dojo/_base/declare", "esri/layers/layer", "esri/tasks/QueryTask", "esri/tasks/query", "esri/request", "dojo/_base/lang", "dojo/dom-construct", "dojo/_base/array", "dojo/dom-style"],
    function (declare, Layer, QueryTask, Query, esriRequest, lang, domConstruct, arrayUtils, domStyle) {
        var ExtrudedFeatureLayer = declare(Layer, {
            _osmb: null,
            _canvas: null,
            _tileInfo: null,
            _mode: 0,// ON_DEMAND|SNAPSHOT
            _heightAttribute: '',
            _oidField: null,// will be overridden from meta query
            _query: null,
            _task: null,
            _oids: null, //track current objectids to mark new/old for animation fade in
            _featureExt: null,//current feature extent, 1.5 map extent
            _suspendOnPan: false,

            // 构造函数
            constructor: function (url, opts) {
                if (!(!!document.createElement('canvas').getContext)) {
                    throw new Error('当前浏览器不支持Canvas，请选择其他浏览器。');
                }
                this.inherited(arguments);
                var opts = opts || {};
                this._heightAttribute = opts.heightAttribute;
                this._mode = opts.mode || ExtrudedFeatureLayer.MODE_ONDEMAND;
                this._heightScaleRatio = opts.heightScaleRatio || 1;
                this._extentScaleRatio = opts.extentScaleRatio || 1.5;
                this._defaultHeight = opts.defaultHeight || 0;
                this._style = opts.style;
                
                this._url = url;
                // 得到图层的元数据
                new esriRequest({
                    url: this._url,
                    content: {
                        f: "json"
                    },
                    callbackParamName: "callback"
                }).then(lang.hitch(this, this._initLayer));
                this._query = new Query();
                lang.mixin(this._query, opts.query);
                lang.mixin(this._query, {
                    returnGeometry: true,
                    outSpatialReference: {
                        "wkid": 4326
                    }
                });
                this._task = new QueryTask(url);
                this._task.on('complete', lang.hitch(this, this._onQueryComplete));
                this._task.on('error', esri.config.defaults.io.errorHandler);                
            },

            _initLayer: function (json) {
                this.setMinScale(json.minScale || 0);
                this.setMaxScale(json.maxScale || 0);
                this.copyrightText = json.copyrightText;
                arrayUtils.some(json.fields, function (field, i) {
                    if (field.type == 'esriFieldTypeOID') {
                        this._oidField = field.name;
                        return true;
                    }
                    return false;
                }, this);
                this._query.outFields = [this._oidField, this._heightAttribute];
                this.loaded = true;
                this.onLoad(this);
            },

            //esri.layers.Layer.method
            _setMap: function (map, container, ind, lod) {
                this._map = map;

                var element = domConstruct.create("div", {
                    width: map.width + "px",
                    height: map.height + "px",
                    style: "position: absolute; left: 0px; top: 0px;"
                }, container);
                this._osmb = new OSMBuildings();
                this.suspended = false;
                this.copyright = OSMBuildings.ATTRIBUTION + "," + this.copyrightText;

                this._element = element;
                this._canvas = this._osmb.createCanvas(element);
                this._osmb.setSize(map.width, map.height);
                // 计算原点
                if (map.layerIds.length == 0 || !map.getLayer(map.layerIds[0]).tileInfo) {
                    throw new Error('在增加该图层之前请确保至少添加了一个切片地图图层');
                }
                this._tileInfo = map.getLayer(map.layerIds[0]).tileInfo;
                this._osmb.setZoom(map.getLevel()); 
                this._setOrigin();

                // 加载数据
                this._loadData();
                // 事件连接
                this._connects = [];
                this._connects.push(map.on("resize", lang.hitch(this, this._onResize)));
                this._connects.push(map.on("pan", lang.hitch(this, this._onPan)));
                this._connects.push(map.on("extent-change", lang.hitch(this, this._onExtentChange)));
                this._connects.push(map.on("zoom-start", lang.hitch(this, this._onZoomStart)));
                return element;
            },
            // esri.layers.Layer.method
            _unsetMap: function (map, container) {
                this._osmb && this._osmb.destroyCanvas();
                this._osmb = null;
                arrayUtils.forEach(this._connects, function (handle) { handle.remove(); });
                if (this._element) {
                    container.removeChild(this._element);
                }
                this._map = null;
                this._element = null;
            },            
            _setOrigin: function (dx, dy) {
                var resolution = this._tileInfo.lods[this._map.getLevel()].resolution;
                var topLeft = this._map.toMap(new esri.geometry.Point(0, 0));
                var x = Math.round((topLeft.x - this._tileInfo.origin.x) / resolution);
                var y = Math.round((this._tileInfo.origin.y - topLeft.y) / resolution);
                this._osmb.setOrigin(x + (dx || 0), y + (dy || 0));
                this._osmb.setSize(this._map.width, this._map.height);
            },
            _loadData: function () {
                if (this._mode == ExtrudedFeatureLayer.MODE_SNAPSHOT) {
                    if (this._oids) {
                        return;
                    } else {
                        this._query.geometry = null;
                        this._query.where = this._query.where || '1=1';

                    }
                } else {
                    this._featureExt = this._map.extent.expand(this._extentScaleRatio);
                    this._query.geometry = this._featureExt;
                }
                this._task.execute(this._query);
            },
            _onQueryComplete: function (evt) {
                this._setFeatures(evt.featureSet.features);
            },
            _setFeatures: function (features) {
                var oids = {};
                var jfs = [];
                this._oids = this._oids || {};
                for (var i = 0; i < features.length; i++) {
                    var f = features[i];

                    var oid = f.attributes[this._oidField];
                    var gj = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": f.geometry.rings
                        },
                        "properties": {
                            "height": (f.attributes[this._heightAttribute] || this._defaultHeight) * this._heightScaleRatio,
                            'isNew': !this._oids[oid]
                        }
                    }
                    // 为了排序需要得到Y坐标的范围
                    var minY = maxY = f.geometry.rings[0][0][1];
                    for (var j = 0; j < f.geometry.rings.length; j++) {
                        for (var k = 0; k < f.geometry.rings[j].length; k++) {
                            minY = Math.min(minY, f.geometry.rings[j][k][1]);
                            maxY = Math.max(maxY, f.geometry.rings[j][k][1]);
                        }
                    }
                    gj.minY = minY;
                    gj.maxY = maxY;
                    jfs[i] = gj;
                    oids[oid] = f;
                }
                // 按照高度与Y坐标来排序
                jfs.sort(function (a, b) {
                    if (a.maxY < b.minY) {
                        return 1;
                    } else if (a.minY > b.maxY) {
                        return -1;
                    } else {
                        return b.properties.height - a.properties.height
                    }
                });
                this._oids = oids;
                this._osmb.geoJSON({
                    "type": "FeatureCollection",
                    "features": jfs
                });
                if (this._style) {
                    this._osmb.setStyle(this._style);
                }
            },
            _onResize: function (evt) {
                if (this._osmb) {
                    this._osmb.setSize(evt.width, evt.height);
                    this._osmb.render();
                };
            },
            _onPan: function (evt) {
                if (this._suspendOnPan) {
                    domStyle.set(this._canvas, {
                        left: evt.delta.x + "px",
                        top: evt.delta.y + "px"
                    });
                } else {
                    this._setOrigin(-evt.delta.x, -evt.delta.y);
                    this._osmb.render();
                }
            },
            _onExtentChange: function (evt) {
                domStyle.set(this._canvas, {
                    left: "0px",
                    top: "0px"
                });
                this._setOrigin();
                this._osmb.setCamOffset(0, 0);
                if (evt.levelChange) {
                    this._osmb.onZoomEnd({
                        zoom: this._map.getLevel()
                    });

                    if (this.isVisibleAtScale(this._map.getScale())) {
                        this._loadData();
                    } else {
                        // 清空画布
                        this._osmb.geoJSON({
                            features: []
                        });
                    }
                } else {
                    this._osmb.onMoveEnd();
                    if (this._featureExt && !this._featureExt.contains(evt.extent)) {
                        this._loadData();
                    };
                }
            },
            _onZoomStart: function (evt) {
                this._osmb.onZoomStart();
            }
        });

        lang.mixin(ExtrudedFeatureLayer, {
            MODE_ONDEMAND: 0,
            MODE_SNAPSHOT: 1
        });

        return ExtrudedFeatureLayer;
    }
)