define(["dojo/_base/declare", "esri/layers/DynamicMapServiceLayer", "esri/geometry/Point", "esri/geometry/screenUtils", "dojo/dom-style", "dojo/query"],
    function (declare, DynamicMapServiceLayer, Point, screenUtils, domStyle, query) {
        return declare(DynamicMapServiceLayer, {
            // 变量
            properties: {},
            heatMap: null,
            // 构造函数
            constructor: function (properties) {
                declare.safeMixin(this.properties, properties);
                // 地图变量
                this._map = this.properties.map;
                // 原始数据
                this.lastData = [];
                // 地图的DOM节点
                this.domNode = document.getElementById(this.properties.domNodeId);
                // 配置信息
                this.config = {
                    element: this.domNode,
                    width: this._map.width,
                    height: this._map.height,
                    radius: 40,
                    debug: false,
                    visible: true,
                    useLocalMaximum: false,
                    gradient: {
                        0.45: "rgb(000,000,255)",
                        0.55: "rgb(000,255,255)",
                        0.65: "rgb(000,255,000)",
                        0.95: "rgb(255,255,000)",
                        1.00: "rgb(255,000,000)"
                    }
                };
                // 在配置信息中包含heatmap.js文件中的设置
                declare.safeMixin(this.config, properties.config);
                // 创建热度图
                this.heatMap = heatmapFactory.create(this.config);
                // 将loaded属性设置为true
                this.loaded = true;
                this.onLoad(this);
                this.globalMax = 0;
                this._map.on("resize", this, this.resizeHeatmap);
                this.domNode.style.position = 'relative';
                this.domNode.style.display = 'none';
            },
            resizeHeatmap: function (extent, width, height) {
                // 设置热度图大小
                this.heatMap.set("width", width);
                this.heatMap.set("height", height);
                // 设置容器的宽与高
                domStyle.set(this.domNode, {
                    "width": width + 'px',
                    "height": height + 'px'
                });
                // 设置容器中canvas元素的宽与高
                var child = query(':first-child', this.domNode);
                if (child) {
                    child.attr('width', width);
                    child.attr('height', height);
                }
                
                var actx = this.heatMap.get("actx");
                actx.canvas.height = height;
                actx.canvas.width = width;
                this.heatMap.set("actx", actx);
                this.refresh();
            },
            
            storeHeatmapData: function (heatPluginData) {
                // 设置热度图数据
                this.heatMap.store.setDataSet(heatPluginData);
            },
            // 将数据转换为热度图需要的格式
            convertHeatmapData: function (parsedData) {
                // variables
                var xParsed, yParsed, heatPluginData, dataPoint, screenGeometry;
                // set heat plugin data object
                heatPluginData = {
                    max: parsedData.max,
                    data: [] // empty data
                };
                // if data
                if (parsedData.data) {
                    // for all x values
                    for (xParsed in parsedData.data) {
                        // if data[x]
                        if (parsedData.data.hasOwnProperty(xParsed)) {
                            // for all y values and count
                            for (yParsed in parsedData.data[xParsed]) {
                                if (parsedData.data[xParsed].hasOwnProperty(yParsed)) {
                                    // convert data point into screen geometry
                                    screenGeometry = screenUtils.toScreenGeometry(this._map.extent, this._map.width, this._map.height, parsedData.data[xParsed][yParsed].dataPoint);
                                    // push to heatmap plugin data array
                                    heatPluginData.data.push({
                                        x: screenGeometry.x,
                                        y: screenGeometry.y,
                                        count: parsedData.data[xParsed][yParsed].count // count value of x,y
                                    });
                                }
                            }
                        }
                    }
                }
                
                this.storeHeatmapData(heatPluginData);
            },
            // runs through data and calulates weights and max
            parseHeatmapData: function (features) {
                // variables
                var i, parsedData, dataPoint, attributes;
                // if data points exist
                if (features) {
                    // create parsed data object
                    parsedData = {
                        max: 0,
                        data: []
                    };
                    if (!this.config.useLocalMaximum) {
                        parsedData.max = this.globalMax;
                    }
                    // for each data point
                    for (i = 0; i < features.length; i++) {
                        // create geometry point
                        dataPoint = Point(features[i].geometry);
                        // check point
                        var validPoint = false;
                        // if not using local max, point is valid
                        if (!this.config.useLocalMaximum) {
                            validPoint = true;
                        }
                            // using local max, make sure point is within extent
                        else if (this._map.extent.contains(dataPoint)) {
                            validPoint = true;
                        }
                        if (validPoint) {
                            // attributes
                            attributes = features[i].attributes;
                            // if array value is undefined
                            if (!parsedData.data[dataPoint.x]) {
                                // create empty array value
                                parsedData.data[dataPoint.x] = [];
                            }
                            // array value array is undefined
                            if (!parsedData.data[dataPoint.x][dataPoint.y]) {
                                // create object in array
                                parsedData.data[dataPoint.x][dataPoint.y] = {};
                                // if count is defined in datapoint
                                if (attributes && attributes.hasOwnProperty('count')) {
                                    // create array value with count of count set in datapoint
                                    parsedData.data[dataPoint.x][dataPoint.y].count = attributes.count;
                                } else {
                                    // create array value with count of 0
                                    parsedData.data[dataPoint.x][dataPoint.y].count = 0;
                                }
                            }
                            // add 1 to the count
                            parsedData.data[dataPoint.x][dataPoint.y].count += 1;
                            // store dataPoint var
                            parsedData.data[dataPoint.x][dataPoint.y].dataPoint = dataPoint;
                            // if count is greater than current max
                            if (parsedData.max < parsedData.data[dataPoint.x][dataPoint.y].count) {
                                // set max to this count
                                parsedData.max = parsedData.data[dataPoint.x][dataPoint.y].count;
                                if (!this.config.useLocalMaximum) {
                                    this.globalMax = parsedData.data[dataPoint.x][dataPoint.y].count;
                                }
                            }

                        }
                    }
                    // convert parsed data into heatmap plugin formatted data
                    this.convertHeatmapData(parsedData);
                }
            },
            // 设置数据
            setData: function (features) {
                // set width/height
                this.resizeHeatmap(null, this._map.width, this._map.height);
                this.lastData = features;
                this.parseHeatmapData(features);
                // 重新绘制热度图
                this.refresh();
            },
            // 在热度图中增加一要素
            addDataPoint: function (feature) {
                if (feature) {
                    this.lastData.push(feature);
                    setData(this.lastData);
                }
            },
            // 返回要素的数据集
            exportDataSet: function () {
                return this.lastData;
            },
            // 清空数据
            clearData: function () {
                this.heatMap.clear();
                var empty = [];
                this.setData(empty);
            },
            // 得到图像
            getImageUrl: function (extent, width, height, callback) {
                // 使用获得的数据创建热度图
                this.parseHeatmapData(this.lastData);
                // 图像数据
                var imageUrl = this.heatMap.get("canvas").toDataURL("image/png");
                // 调用回调函数
                callback(imageUrl);
            }
        });
    }
)