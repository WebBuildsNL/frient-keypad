'use strict';

const Homey = require('homey');

class FrientKeypadApp extends Homey.App {

  async onInit() {
    this.log('Frient Keypad Code Reader has been initialized');
  }

}

module.exports = FrientKeypadApp;
