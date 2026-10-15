const MAX_IP_ATTEMPTS = 20;
const MAX_ACCOUNT_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_MAP_SIZE = 10000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const ipAttempts = new Map();
const accountAttempts = new Map();

function cleanMap(map) {
  const now = Date.now();
  for (const [key, record] of map.entries()) {
    if (record.resetAt <= now) {
      map.delete(key);
    }
  }
}

let cleanupTimer = setInterval(() => {
  cleanMap(ipAttempts);
  cleanMap(accountAttempts);
}, CLEANUP_INTERVAL_MS);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

function getClientIp(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

function normalizeIdentifier(identifier) {
  if (typeof identifier !== 'string') {
    return '';
  }
  return identifier.trim().toLowerCase();
}

function isRateLimited(map, key, maxLimit) {
  if (!key) {
    return false;
  }
  const now = Date.now();
  const record = map.get(key);
  if (record) {
    if (record.resetAt <= now) {
      map.delete(key);
      return false;
    }
    return record.count >= maxLimit;
  }

  if (map.size >= MAX_MAP_SIZE) {
    cleanMap(map);
    if (map.size >= MAX_MAP_SIZE) {
      return true;
    }
  }

  return false;
}

function incrementAttempt(map, key) {
  if (!key) {
    return;
  }
  const now = Date.now();
  const record = map.get(key);
  if (!record || record.resetAt <= now) {
    if (map.size >= MAX_MAP_SIZE) {
      cleanMap(map);
    }
    if (map.size < MAX_MAP_SIZE) {
      map.set(key, {
        count: 1,
        resetAt: now + WINDOW_MS
      });
    }
  } else {
    record.count += 1;
  }
}

function loginRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const identifier = normalizeIdentifier(req.body && (req.body.username || req.body.email));

  if (isRateLimited(ipAttempts, ip, MAX_IP_ATTEMPTS)) {
    return res.status(429).json({
      success: false,
      message: 'Quá nhiều lần thử đăng nhập từ địa chỉ này. Vui lòng thử lại sau 15 phút.'
    });
  }

  if (identifier && isRateLimited(accountAttempts, identifier, MAX_ACCOUNT_ATTEMPTS)) {
    return res.status(429).json({
      success: false,
      message: 'Quá nhiều lần thử đăng nhập cho tài khoản này. Vui lòng thử lại sau 15 phút.'
    });
  }

  next();
}

function recordFailedLogin(ip, identifier) {
  if (ip) {
    incrementAttempt(ipAttempts, ip);
  }
  const normId = normalizeIdentifier(identifier);
  if (normId) {
    incrementAttempt(accountAttempts, normId);
  }
}

function recordSuccessfulLogin(identifier) {
  const normId = normalizeIdentifier(identifier);
  if (normId) {
    accountAttempts.delete(normId);
  }
}

function _resetAllForTesting() {
  ipAttempts.clear();
  accountAttempts.clear();
}

function _stopCleanupTimer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
}

module.exports = {
  loginRateLimiter,
  recordFailedLogin,
  recordSuccessfulLogin,
  getClientIp,
  normalizeIdentifier,
  _resetAllForTesting,
  _stopCleanupTimer,
  MAX_MAP_SIZE
};
