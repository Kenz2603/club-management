const { getClientIp } = require('./rate-limiter');

function createRegistrationLimiter({ now = Date.now, limit = 20, windowMs = 15 * 60 * 1000, maxEntries = 10000, maxConcurrent = 10 } = {}) {
  const attempts = new Map();
  let active = 0;
  return function registrationLimiter(req, res, next) {
    const time = now();
    for (const [key, record] of attempts) if (record.until <= time && !record.active) attempts.delete(key);
    const ip = getClientIp(req);
    let record = attempts.get(ip);
    function reject(seconds) {
      res.setHeader('Retry-After', String(seconds));
      return res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.' });
    }
    if (!record) {
      if (attempts.size >= maxEntries) return reject(60);
      record = { count: 0, until: time + windowMs, active: 0 };
      attempts.set(ip, record);
    }
    if (record.until <= time) { record.count = 0; record.until = time + windowMs; }
    if (record.count >= limit) return reject(Math.max(1, Math.ceil((record.until - time) / 1000)));
    if (record.active >= 2 || active >= maxConcurrent) return reject(5);
    record.count++;
    record.active++;
    active++;
    res.once('close', () => { record.active--; active--; });
    next();
  };
}

module.exports = { createRegistrationLimiter, registrationLimiter: createRegistrationLimiter() };
