/**
 * Created by Nick Largent on 2015-12-27.
 */
angular.module('zwaveApp', []).controller('MainController', function($scope, socket, $timeout) {

    $scope.nodes = {};
    $scope.sendQueueCount = null;
    $scope.selection = {
        node: null,
        nameEdit: null
    };

    var primary_class_ids = [37,48,49];

    // used for easy updating
    var values = {};

    var updateQueueCount = function() {
        socket.emit('getSendQueueCount');
    };

    socket.on('connect', function () {
        console.log("socket connected");
        socket.emit('getNodes');
        updateQueueCount();
    });

    socket.on('nodes', function (nodes) {
        console.log("got nodes");
        $scope.nodes = nodes;

        for (var node in nodes) {
            nodes[node].battery_value = null;
            nodes[node].primary_values = [];
            for (var comclass in nodes[node].classes) {
                for (var index in nodes[node].classes[comclass]) {
                    var value = nodes[node].classes[comclass][index];
                    values[value.value_id] = value;
                    if (value.class_id == 128) {
                        nodes[node].battery_value = value;
                    }
                    if (primary_class_ids.indexOf(value.class_id) >= 0) {
                        console.log(node.primary_values);
                        nodes[node].primary_values.push(value);
                    }
                }
            }
        }
    });

    socket.on('sendQueueCount', function (count) {
        $scope.sendQueueCount = count;
        if (count > 0) {
            setTimeout(updateQueueCount, 5000);
        }
    });

    socket.on('nodeEvent', function (nodeID, event, valueID) {
        console.log("nodeEvent");
        console.log(arguments);
        $scope.nodes[nodeID].lastEvent = "NodeEvent: event=" + event + " value=" + valueID;
    });

    socket.on('sceneEvent', function (nodeID, sceneid) {
        console.log("sceneEvent");
        console.log(arguments);
        $scope.nodes[nodeID].lastEvent = "Scene " + sceneid;
    });

    socket.on('valueChanged', function (nodeID, comclass, value) {
        values[value.value_id].value = value.value;
    });

    socket.on('nodeNeighbors', function (nodeID, neighbors) {
        console.log(neighbors);
        $scope.nodes[nodeID].neighbors = neighbors;
        $scope.nodes[nodeID].neighborsUpdating = false;
    });

    socket.on('nodeLog', function (nodeID, txt) {
        $scope.nodes[nodeID].log.push(txt);
        if ($scope.nodes[nodeID].log.length > 50)
            $scope.nodes[nodeID].log.shift();
    });


    $scope.toggleSwitch = function (value) {
        socket.emit('setValue', {nodeID:value.node_id, classID:value.class_id, instance:value.instance, index:value.index, value:!value.value});
    };

    $scope.nodeSettings = function (nodeID) {
        $scope.selection.node = $scope.nodes[nodeID];
        $('#nodeDetails').modal({});
    };

    $scope.getNeighbors = function (nodeID) {
        $scope.nodes[nodeID].neighborsUpdating = true;
        socket.emit('requestNodeNeighborUpdate', nodeID);
    };

    $scope.addNode = function() {
        console.log("addNode");
        socket.emit('addNode');
    };

    $scope.removeNode = function() {
        console.log("removeNode");
        socket.emit('removeNode');
    };

    $scope.replaceFailedNode = function(nodeid) {
        console.log("replaceFailed");
        socket.emit('replaceFailedNode', nodeid);
    };

    $scope.softReset = function() {
        console.log("softReset");
        socket.emit('softReset');
    };

    $scope.healNetwork = function() {
        console.log("healNetwork");
        socket.emit('healNetwork');
    };

    $scope.healNode = function(nodeID) {
        console.log("healNode");
        socket.emit('healNetworkNode', nodeID);
    };

    var setName = function (nodeID, name) {
        console.log("setName " + name);
        $scope.nodes[nodeID].name = name;
        socket.emit('setName', {nodeID: nodeID, name: name});
    };

    $scope.editName = function () {
        $scope.selection.nameEdit = $scope.selection.node.name;
        if ($scope.selection.nameEdit == null)
            $scope.selection.nameEdit = "no name";

        $timeout(function() {
            $("#nameEditBox").focus();
            $("#nameEditBox").select();
        }, 1);
    };

    $scope.cancelEditName = function () {
        $scope.selection.nameEdit = null;
    };

    $scope.saveName = function() {
        console.log($scope.selection.nameEdit);
        setName($scope.selection.node.id, $scope.selection.nameEdit)
        $scope.selection.nameEdit = null;
    };

    $scope.pressButton = function(value) {
        socket.emit('pressButton', {
            nodeID:value.node_id, classID:value.class_id, instance:value.instance, index:value.index
        });
    };

    var getSizeForType = function(type) {
        switch (type) {
            case 'byte':
                return 1;
            case 'short':
                return 2;
            case 'int':
                return 4;
            case 'list':
                return 1;
            default:
                return 0;
        }
    };

    $scope.configureValue = function(value) {
        var size = getSizeForType(value.type);

        var currentValue = value.value;

        var list = "";
        if (value.type == 'list') {
            for (var i in value.values) {
                list += (i + " - " + value.values[i] + "\n");
                if (value.values[i] == currentValue)
                    currentValue = i;
            }
            list += "\n";
        }

        var label = value.label + "\n\n" + value.help + "\n\n" + list + "Value Size: " + size;

        var newvalue = prompt(label, currentValue);
        if (newvalue && newvalue.length > 0) {
            // nodeID, paramID, value, size
            socket.emit('setConfig', {
                nodeID: value.node_id,
                paramID: value.index,
                value: newvalue,
                size: size
            });
        }
    };

    $scope.customCommandMethod = "";
    $scope.customCommandParams = "";

    $scope.showCustomCommand = function() {
        $('#customCommand').modal({});
    };

    $scope.customCommand = function() {
        console.log("Custom command: " + $scope.customCommandMethod + "\n" + $scope.customCommandParams);

        var params = $scope.customCommandParams;
        if (params.length > 0 && params[0] == "{")
            params = JSON.parse(params);

        socket.emit($scope.customCommandMethod, params);
    };
});

angular.module('zwaveApp').factory('socket', function ($rootScope, $location) {
    //console.log($location);
    var socketUrl = $location.protocol() + "://" + $location.host() + ":" + $location.port();
    var socket = io.connect(socketUrl);
    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            })
        }
    };
});

/*
 This directive allows us to pass a function in on an enter key to do what we want.
 */
angular.module('zwaveApp').directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if(event.which === 13) {
                scope.$apply(function (){
                    scope.$eval(attrs.ngEnter);
                });

                event.preventDefault();
            }
        });
    };
});