const crypto = require('node:crypto');

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSessionToken(token) {
  if (typeof token !== 'string') {
    return '';
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateCsrfSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function createCsrfToken(csrfSecret, sessionId) {
  if (!csrfSecret || !sessionId) {
    return '';
  }
  return crypto.createHmac('sha256', csrfSecret).update(String(sessionId), 'utf8').digest('hex');
}

function verifyCsrfToken(csrfToken, csrfSecret, sessionId) {
  if (!csrfToken || !csrfSecret || !sessionId) {
    return false;
  }
  if (typeof csrfToken !== 'string') {
    return false;
  }

  const expectedToken = createCsrfToken(csrfSecret, sessionId);
  if (csrfToken.length !== expectedToken.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(csrfToken, 'utf8'), Buffer.from(expectedToken, 'utf8'));
}

function getSessionTtlHours() {
  const envHours = Number(process.env.SESSION_TTL_HOURS);
  return Number.isInteger(envHours) && envHours > 0 ? envHours : 8;
}

function calculateSessionExpiry(ttlHours) {
  const hours = ttlHours || getSessionTtlHours();
  return new Date(Date.now() + hours * 3600 * 1000);
}

module.exports = {
  generateSessionToken,
  hashSessionToken,
  generateCsrfSecret,
  createCsrfToken,
  verifyCsrfToken,
  getSessionTtlHours,
  calculateSessionExpiry
};
