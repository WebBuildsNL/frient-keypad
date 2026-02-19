'use strict';

const Homey = require('homey');

class FrientKeypadApp extends Homey.App {

  async onInit() {
    // Initialize codes setting if not set
    if (!this.homey.settings.get('codes')) {
      this.homey.settings.set('codes', []);
    }

    this.homey.settings.on('set', (key) => {
      if (key === 'codes') {
        this.log('Access codes updated');
      }
    });

    this.log('Frient Keypad Code Reader has been initialized');
  }

  /**
   * Validate a PIN code against the stored codes list.
   * Returns { valid: boolean, name: string }.
   * If no codes are configured, all codes are accepted (backward compatible).
   */
  validateCode(code) {
    const codes = this.homey.settings.get('codes') || [];
    if (codes.length === 0) return { valid: true, name: '' };

    const now = new Date();
    const match = codes.find((c) => {
      if (c.code !== code) return false;
      const from = new Date(c.from);
      const till = new Date(c.till);
      till.setHours(23, 59, 59, 999);
      return now >= from && now <= till;
    });

    return match
      ? { valid: true, name: match.name || '' }
      : { valid: false, name: '' };
  }

}

module.exports = FrientKeypadApp;
