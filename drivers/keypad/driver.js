'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

class KeypadDriver extends ZigBeeDriver {

  async onInit() {
    this.log('Frient Keypad driver initialized');
  }

}

module.exports = KeypadDriver;
