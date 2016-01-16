/**
 * Created by Nick Largent on 2016-01-14.
 */

var zwave = require('./lib/zwave.js');
var webserver = require('./lib/webserver.js');

var config = {
    "webServerPort": 8017,
    //"ozwDevice": "/dev/ttyUSB0"
    "ozwDevice": "\\\\.\\COM3"
};

zwave.start(config.ozwDevice, webserver.emit);
webserver.start(config.webServerPort, zwave);