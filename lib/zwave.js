/**
 * Created by Nick Largent on 2015-12-23.
 *
 * Reference Docs
 *
 * Open Z-Wave API
 * https://github.com/OpenZWave/node-openzwave-shared
 *
 * ZWave Command Classes
 * http://wiki.micasaverde.com/index.php/ZWave_Command_Classes
 *
 * ZWave Primer
 * http://docs.smartthings.com/en/latest/device-type-developers-guide/z-wave-primer.html
 *
 */
var fs = require('fs');
var OZW = require('openzwave-shared');

var zwave = new OZW({
    Logging: true,
    ConsoleOutput: false
});

module.exports = zwave;

zwave.nodes = {};
zwave.dirty = false;
zwave.ready = false;

var ozw_device = null;
var node_db = {};
var node_db_path = ".nodes.json";

zwave.nodeLog = function(nodeID, msg) {
    var txt = (new Date()).getTime() + ": " + msg;
    var node = zwave.nodes[nodeID];
    if (node) {
        node.log.push(txt);
        emit("nodeLog", nodeID, txt);
        while (node.log.length > 10)
            node.log.shift();
        zwave.dirty = true;
    }
};

var emit = function() {
    console.log("Emit: " + JSON.stringify(arguments) );
};

var saveDb = function(callback) {
    if (zwave.dirty) {
        zwave.dirty = false;
        fs.writeFile(node_db_path, JSON.stringify(node_db, null, 4), function(err) {
            if (err)
                console.log("error saving node_db");
            else
                console.log("node_db saved");
            if (callback)
                callback(err);
        });
    }
    else {
        if (callback)
            callback(null);
    }
};

var shutdown = function() {
    console.log('shutting down...');
    zwave.disconnect(ozw_device);
    saveDb(function() {
        process.exit();
    });
};

/* // Uncomment for debugging
 var patchEmitter = function (emitter) {
 var oldEmit = emitter.emit;

 emitter.emit = function() {
 console.log("Catchall: " + JSON.stringify(arguments));
 oldEmit.apply(emitter, arguments);
 }
 };
 patchEmitter(zwave);
 */



zwave.on('driver ready', function(homeid) {
    console.log('scanning homeid=0x%s...', homeid.toString(16));
});

zwave.on('driver failed', function() {
    console.log('driver failed, exiting.');
    shutdown();
});

zwave.on('scan complete', function() {
    console.log('scan complete');
    zwave.ready = true;

    setInterval(function() {
        saveDb();
    }, 60000);
});

zwave.on('node added', function(nodeid) {
    console.log('node added: ' + nodeid);
    if (node_db[nodeid] == null) {
        node_db[nodeid] = {
            id: nodeid,
            info: {},
            classes: {},
            log: []
        };
        zwave.dirty = true;
    }
    zwave.nodes[nodeid] = node_db[nodeid];
    zwave.nodes[nodeid].dead = false;
    zwave.nodes[nodeid].ready = false;
});

zwave.on('node ready', function(nodeid, nodeinfo) {
    //console.log('node ready: ' + nodeid);
    //console.log(nodeinfo);
    zwave.nodes[nodeid].info = nodeinfo;

    zwave.nodes[nodeid]['ready'] = true;
    console.log('node%d: %s, %s', nodeid,
        nodeinfo.manufacturer ? nodeinfo.manufacturer : 'id=' + nodeinfo.manufacturerid,
        nodeinfo.product ? nodeinfo.product : 'product=' + nodeinfo.productid + ', type=' + nodeinfo.producttype);
    console.log('node%d: name="%s", type="%s", location="%s"', nodeid,
        nodeinfo.name,
        nodeinfo.type,
        nodeinfo.loc);
    for (var comclass in zwave.nodes[nodeid]['classes']) {
        switch (comclass) {
            case 0x25: // COMMAND_CLASS_SWITCH_BINARY
            case 0x26: // COMMAND_CLASS_SWITCH_MULTILEVEL
                zwave.enablePoll(nodeid, comclass);
                break;
        }
        var values = zwave.nodes[nodeid]['classes'][comclass];
        console.log('node%d: class %d', nodeid, comclass);
        for (var idx in values)
            console.log('node%d:   %s=%s', nodeid, values[idx]['label'], values[idx]['value']);
    }
    zwave.dirty = true;
});

zwave.on('controller command', function(nodeId, ctrlState, ctrlError, helpmsg) {
    console.log('controller commmand: ' + JSON.stringify(arguments));
    if (ctrlState == 7 && zwave.controllerCommandCallback != null) {
        zwave.controllerCommandCallback();
        zwave.controllerCommandCallback = null;
    }
});

zwave.on('notification', function(nodeid, notif) {
    switch (notif) {
        case 0:
            zwave.nodeLog(nodeid, "notification: message complete");
            console.log('node%d: message complete', nodeid);
            break;
        case 1:
            zwave.nodeLog(nodeid, "notification: timeout");
            console.log('node%d: timeout', nodeid);
            break;
        case 2:
            zwave.nodeLog(nodeid, "notification: nop");
            console.log('node%d: nop', nodeid);
            break;
        case 3:
            zwave.nodeLog(nodeid, "notification: node awake");
            console.log('node%d: node awake', nodeid);
            break;
        case 4:
            zwave.nodeLog(nodeid, "notification: node sleep");
            console.log('node%d: node sleep', nodeid);
            break;
        case 5:
            zwave.nodeLog(nodeid, "notification: node dead");
            console.log('node%d: node dead', nodeid);
            zwave.nodes[nodeid].dead = true;
            zwave.dirty = true;
            break;
        case 6:
            zwave.nodeLog(nodeid, "notification: node alive");
            console.log('node%d: node alive', nodeid);
            break;
        default:
            zwave.nodeLog(nodeid, "notification: unknown notification");
            console.log('unknown notification: ' + notif);
    }
});

zwave.on('value added', function(nodeid, comclass, value) {
    if (!zwave.nodes[nodeid]['classes'][comclass])
        zwave.nodes[nodeid]['classes'][comclass] = {};
    zwave.nodes[nodeid]['classes'][comclass][value.index] = value;
    zwave.dirty = true;
});

zwave.on('value changed', function(nodeid, comclass, value) {
    if (zwave.nodes[nodeid]['ready']) {
        console.log('node%d: changed: %d:%s:%s->%s', nodeid, comclass,
            value['label'],
            zwave.nodes[nodeid]['classes'][comclass][value.index]['value'],
            value['value']);
    }
    var oldValue = zwave.nodes[nodeid]['classes'][comclass][value.index].value;
    zwave.nodes[nodeid]['classes'][comclass][value.index] = value;
    if (oldValue != value.value) {
        zwave.nodeLog(nodeid, "value " + value.class_id + ":" + value.label + " changed from " + oldValue + " to " + value.value);
        emit("valueChanged", nodeid, comclass, value);
    }
    zwave.dirty = true;
});

zwave.on('value removed', function(nodeid, comclass, index) {
    if (zwave.nodes[nodeid]['classes'][comclass] &&
        zwave.nodes[nodeid]['classes'][comclass][index])
        delete zwave.nodes[nodeid]['classes'][comclass][index];
    zwave.dirty = true;
});

zwave.on('scene event', function(nodeid, sceneid) {
    zwave.nodeLog(nodeid, "scene event: scene=" + sceneid);
    console.log('scene event: ' + nodeid + ', scene=' + sceneid);
    emit("sceneEvent", nodeid, sceneid);
});

zwave.on('node event', function(nodeid, event, valueId) {
    zwave.nodeLog(nodeid, "node event: event=" + event);
    console.log('node event: ' + nodeid + ', event=' + event + ', value=' + JSON.stringify(valueId));
    emit("nodeEvent", nodeid, event, valueId);
});

zwave.start = function(ozwDevice, emitFunc) {
    if (emitFunc)
        emit = emitFunc;

    ozw_device = ozwDevice;

    console.log("Loading DB...");
    fs.access(node_db_path, fs.F_OK, function(err) {
        if (!err)
            node_db = JSON.parse(fs.readFileSync(node_db_path));
    });

    console.log("Opening device...")
    zwave.connect(ozw_device);

    process.on('SIGINT', function() {
        console.log("Told to quit...");
        shutdown();
    });
};



