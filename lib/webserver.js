var express = require("express");
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server, { log: true });
var path = require('path');

module.exports = {

    emit: function() {
        io.sockets.emit.apply(io.sockets, arguments);
    },

    start: function(httpPort, zwave) {
        app.use(express.static(path.join(__dirname, '../public')));
        app.get('/', function (req, res) { res.sendfile(path.resolve(__dirname + '../public/index.html')); });

        // default route
        app.use(function(req, res){
            console.log("404: " + req.url);
            res.send(404);
        });

        server.listen(httpPort);

        // socket.io handler
        io.sockets.on('connection', function (socket) {
            console.log("connection: " + socket.id);

            socket.on('disconnect', function() {
                console.log("disconnect: " + socket.id);
            });

            socket.on('getNodes', function() {
                socket.emit('nodes', zwave.nodes);
            });

            socket.on('getNode', function(id) {
                socket.emit('node', zwave.nodes[id]);
            });

            socket.on('setValue', function(params) {
                /*
                 {nodeID, classID, instance, index, value}
                 */
                console.log("setValue: " + JSON.stringify(params));
                zwave.setValue( {
                    nodeid: params.nodeID,
                    class_id: params.classID,
                    instance: params.instance,
                    index: params.index
                },  params.value);
            });

            socket.on('getConfig', function(params) {
                /*
                 {nodeID, paramID}
                 */
                if (params.length == 2)
                    zwave.requestConfigParam(params.nodeID, params.paramID);
                else
                    zwave.requestAllConfigParams(params.nodeID);
            });

            socket.on('setConfig', function(params) {
                /*
                 {nodeID, paramID, size, value}
                 */
                console.log("setConfig: " + JSON.stringify(params));
                zwave.setConfigParam(params.nodeID, params.paramID, params.value, params.size);
            });

            socket.on('requestNodeNeighborUpdate', function(id) {
                zwave.controllerCommandCallback = function() {
                    zwave.nodes[id].neighbors = zwave.getNodeNeighbors(id);
                    console.log("GetNodeNeighbors: " + JSON.stringify(zwave.nodes[id].neighbors));
                    zwave.dirty = true;
                    socket.emit('nodeNeighbors', id, zwave.nodes[id].neighbors);
                };
                zwave.requestNodeNeighborUpdate(id);
            });

            socket.on('setName', function(params) {
                zwave.nodes[params.nodeID].name = params.name;
                zwave.setNodeName(params.nodeID, params.name);
                zwave.dirty = true;
            });

            socket.on('addNode', function() {
                console.log("Starting addNode...");
                zwave.addNode(false);
            });

            socket.on('removeNode', function() {
                console.log("Starting removeNode...");
                zwave.removeNode();
            });

            socket.on('replaceFailedNode', function(nodeid) {
                console.log("Replace failed node: " + nodeid);
                zwave.replaceFailedNode(nodeid);
            });

            socket.on('softReset', function() {
                console.log("Soft Reset z-wave chip");
                zwave.softReset();
            });

            socket.on('healNetwork', function() {
                console.log("Heal network");
                zwave.healNetwork();
            });

            socket.on('healNetworkNode', function(nodeId) {
                console.log("Heal network node: " + nodeId);
                zwave.healNetworkNode(nodeId, doReturnRoutes=true);
            });

            socket.on('getSendQueueCount', function() {
                console.log("Get send queue count")
                var ct = zwave.getSendQueueCount();
                socket.emit('sendQueueCount', ct);
            });

            socket.on('pressButton', function(params) {
                zwave.nodeLog(params.nodeID, "Pressing Button: " + JSON.stringify(params));
                zwave.pressButton({
                    nodeid: params.nodeID,
                    class_id: params.classID,
                    instance: params.instance,
                    index: params.index
                });
            });
        });
    }
}