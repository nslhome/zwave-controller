OpenZWave Controller
=========

This is a basic controller using the openzwave library for managing a z-wave network
and providing an interface to the nslhome platform.

## Installation

Install the OpenZWave library.

Currently tested with Aeotec Z-Stick Gen5 on a Raspberry Pi

`git clone https://github.com/nslhome/zwave-controller.git`

Edit zwave-controller.js and verify the config.

## Usage

`node zwave-controller.js`

Open [http://localhost:8017](http://localhost:8017)

Consider using [forever](https://github.com/foreverjs/forever) once you have a working setup.

## Release History

1.0.0
* Initial Release
