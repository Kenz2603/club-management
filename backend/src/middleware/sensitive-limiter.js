const attempts = new Map();
function sensitiveLimiter(req, res, next) {
  const now = Date.now();
  const key = String(req.user?.id || req.ip);
  for (const [id, record] of attempts) if (record.until <= now) attempts.delete(id);
  let record = attempts.get(key);
  if (!record) {
    if (attempts.size >= 10000) return res.status(429).json({ success: false, message: 'Vui lòng thử lại sau' });
    record = { count: 0, until: now + 60000 };
    attempts.set(key, record);
  }
  if (record.count >= 10) { res.setHeader('Retry-After', '60'); return res.status(429).json({ success: false, message: 'Quá nhiều thao tác bảo mật. Thử lại sau một phút.' }); }
  record.count++;
  next();
}
module.exports = sensitiveLimiter;
