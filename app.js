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
   * Get current time in Homey's configured timezone as "YYYY-MM-DD HH:mm".
   * Uses sv-SE locale which natively outputs "YYYY-MM-DD HH:mm:ss" format.
   */
  _nowLocal() {
    const tz = this.homey.clock.getTimezone();
    return new Date().toLocaleString('sv-SE', { timeZone: tz }).slice(0, 16);
  }

  /**
   * Validate a PIN code against the stored codes list.
   * Returns { valid: boolean, name: string }.
   * If no codes are configured, all codes are rejected.
   * Compares as strings in the Homey's timezone — no Date parsing needed.
   */
  validateCode(code) {
    const codes = this.homey.settings.get('codes') || [];
    if (codes.length === 0) return { valid: false, name: '' };

    const nowLocal = this._nowLocal();

    const match = codes.find((c) => {
      if (c.code !== code) return false;
      const from = c.from;
      // Backward compat: date-only till (length 10) gets end-of-day
      const till = (c.till && c.till.length === 10) ? `${c.till} 23:59` : c.till;
      return nowLocal >= from && nowLocal <= till;
    });

    return match
      ? { valid: true, name: match.name || '' }
      : { valid: false, name: '' };
  }

}

module.exports = FrientKeypadApp;
