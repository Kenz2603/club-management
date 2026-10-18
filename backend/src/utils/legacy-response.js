function legacyResponse(row) {
  const result = { ...row };
  for (const key of ['founded_date', 'created_at', 'updated_at', 'last_login_at']) {
    const value = result[key];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(value)) continue;
    const date = new Date(value.length === 10 ? value + 'T00:00:00Z' : value.replace(' ', 'T') + 'Z');
    if (Number.isFinite(date.getTime())) result[key] = date.toISOString();
  }
  return result;
}
module.exports = legacyResponse;
