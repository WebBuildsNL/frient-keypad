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
   * Append a line to the persistent log visible in the settings tab.
   * Keeps the last 200 lines to avoid unbounded growth.
   */
  writeLog(message) {
    const timestamp = this._nowLocal();
    const line = `[${timestamp}] ${message}`;
    const log = this.homey.settings.get('log') || '';
    const lines = log ? log.split('\n') : [];
    lines.push(line);
    if (lines.length > 200) lines.splice(0, lines.length - 200);
    this.homey.settings.set('log', lines.join('\n'));
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
   * Returns { valid: boolean, name: string, status: string }.
   *   status: "valid"    — code exists and is within its date range
   *           "upcoming" — code exists but its start date is in the future
   *           "expired"  — code exists but its end date has passed
   *           "unknown"  — code not found in the system
   * If no codes are configured, all codes are rejected.
   * Compares as strings in the Homey's timezone — no Date parsing needed.
   */
  validateCode(code) {
    const codes = this.homey.settings.get('codes') || [];
    if (codes.length === 0) return { valid: false, name: '', status: 'unknown' };

    const nowLocal = this._nowLocal();

    // Find all entries matching this PIN
    const matches = codes.filter((c) => c.code === code);
    if (matches.length === 0) return { valid: false, name: '', status: 'unknown' };

    // Check if any match is currently valid
    for (const m of matches) {
      const from = m.from;
      const till = (m.till && m.till.length === 10) ? `${m.till} 23:59` : m.till;
      if (nowLocal >= from && nowLocal <= till) {
        return { valid: true, name: m.name || '', status: 'valid' };
      }
    }

    // Code exists but isn't valid now — check if upcoming or expired
    for (const m of matches) {
      if (nowLocal < m.from) {
        return { valid: false, name: m.name || '', status: 'upcoming' };
      }
    }

    // All matches are expired
    return { valid: false, name: matches[0].name || '', status: 'expired' };
  }

}

module.exports = FrientKeypadApp;
