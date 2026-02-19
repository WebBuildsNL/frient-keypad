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
  // Body: { name: string, code: string, from: "YYYY-MM-DD", till: "YYYY-MM-DD", reference_id: string|number|null }
  async postCodes({ homey, body }) {
    if (!body.code || !body.from || !body.till) {
      throw new Error('Missing required fields: code, from, till');
    }

    const codes = homey.settings.get('codes') || [];
    const newCode = String(body.code);
    const duplicate = codes.some((c) => c.code === newCode && c.from === body.from && c.till === body.till);
    if (duplicate) {
      throw new Error('A code with the same PIN and date range already exists');
    }

    codes.push({
      name: body.name || '',
      code: newCode,
      from: body.from,
      till: body.till,
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
