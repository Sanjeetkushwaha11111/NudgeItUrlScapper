const IST_OFFSET_MINUTES = 5 * 60 + 30;

function toISTISOString(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().replace("Z", "+05:30");
}

function mapDatesToIST(value) {
  if (value instanceof Date) return toISTISOString(value);
  if (Array.isArray(value)) return value.map(mapDatesToIST);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, v] of Object.entries(value)) out[key] = mapDatesToIST(v);
    return out;
  }
  return value;
}

module.exports = {
  toISTISOString,
  mapDatesToIST,
};
