'use strict';

function normalizeCodes(codes) {
  return codes.map((c) => ({
    name: c.name || '',
    code: c.code,
    from: c.from,
    till: c.till,
    reference_id: c.reference_id != null ? c.reference_id : null,
  }));
}

module.exports = {

  // GET /codes — list all access codes
  async getCodes({ homey }) {
    return normalizeCodes(homey.settings.get('codes') || []);
  },

  // POST /codes — add a new access code
  // Body: { name: string, code: string, from: "YYYY-MM-DD HH:mm[:ss]", till: "YYYY-MM-DD HH:mm[:ss]", reference_id: string|number|null }
  async postCodes({ homey, body }) {
    if (!body.code || !body.from || !body.till) {
      throw new Error('Missing required fields: code, from, till');
    }

    const datetimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
    const fromRaw = String(body.from).replace('T', ' ');
    const tillRaw = String(body.till).replace('T', ' ');

    if (!datetimeRegex.test(fromRaw) || !datetimeRegex.test(tillRaw)) {
      throw new Error('Invalid format: from and till must be "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"');
    }

    // Normalize to "YYYY-MM-DD HH:mm" for consistent storage and comparison
    const fromNorm = fromRaw.slice(0, 16);
    const tillNorm = tillRaw.slice(0, 16);

    if (Number.isNaN(new Date(fromNorm).getTime()) || Number.isNaN(new Date(tillNorm).getTime())) {
      throw new Error('Invalid date values for from or till');
    }

    const codes = homey.settings.get('codes') || [];
    const newCode = String(body.code).trim();
    if (!newCode) {
      throw new Error('Code cannot be empty or whitespace-only');
    }
    const duplicate = codes.some((c) => c.code === newCode && c.from === fromNorm && c.till === tillNorm);
    if (duplicate) {
      throw new Error('A code with the same PIN and date range already exists');
    }

    codes.push({
      name: body.name || '',
      code: newCode,
      from: fromNorm,
      till: tillNorm,
      reference_id: body.reference_id != null ? body.reference_id : null,
    });
    homey.settings.set('codes', codes);
    return normalizeCodes(codes);
  },

  // DELETE /codes — remove an access code by index
  // Query: ?index=0
  async deleteCodes({ homey, query }) {
    const index = parseInt(query.index, 10);
    if (Number.isNaN(index)) {
      throw new Error('Missing or invalid query parameter: index');
    }

    const codes = homey.settings.get('codes') || [];
    if (index < 0 || index >= codes.length) {
      throw new Error('Index out of range');
    }

    codes.splice(index, 1);
    homey.settings.set('codes', codes);
    return normalizeCodes(codes);
  },

};
