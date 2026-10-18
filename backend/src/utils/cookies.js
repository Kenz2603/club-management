const { getSessionTtlHours } = require('./session');

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        continue;
      }
    }
  }
  return cookies;
}

function isConnectionSecure(req) {
  if (process.env.COOKIE_SECURE === 'true') {
    return true;
  }
  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }
  if (req && (req.secure || req.protocol === 'https')) {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

function getSessionCookieOptions(req) {
  const secure = isConnectionSecure(req);
  const ttlHours = getSessionTtlHours();

  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ttlHours * 3600 * 1000
  };
}

function getClearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  };
}

module.exports = {
  parseCookies,
  isConnectionSecure,
  getSessionCookieOptions,
  getClearCookieOptions
};
