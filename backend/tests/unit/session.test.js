const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const {
  generateSessionToken,
  hashSessionToken,
  generateCsrfSecret,
  createCsrfToken,
  verifyCsrfToken,
  getSessionTtlHours,
  calculateSessionExpiry
} = require('../../src/utils/session');
const { cleanExpiredSessions } = require('../../src/services/auth.service');

test.after(async () => {
  await pool.end();
});

test('generateSessionToken returns 64 character hex string', () => {
  const token = generateSessionToken();
  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test('hashSessionToken computes consistent sha256 hex digest', () => {
  const token = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const hash1 = hashSessionToken(token);
  const hash2 = hashSessionToken(token);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.equal(hashSessionToken(null), '');
});

test('generateCsrfSecret returns 64 character hex secret', () => {
  const secret = generateCsrfSecret();
  assert.equal(secret.length, 64);
});

test('createCsrfToken and verifyCsrfToken work correctly', () => {
  const secret = generateCsrfSecret();
  const sessionId = 42;
  const token = createCsrfToken(secret, sessionId);

  assert.equal(verifyCsrfToken(token, secret, sessionId), true);
  assert.equal(verifyCsrfToken(token, secret, 999), false);
  assert.equal(verifyCsrfToken('tampered_token', secret, sessionId), false);
  assert.equal(verifyCsrfToken('', secret, sessionId), false);
  assert.equal(verifyCsrfToken(token, null, sessionId), false);
});

test('getSessionTtlHours respects env or defaults to 8', () => {
  const originalEnv = process.env.SESSION_TTL_HOURS;
  try {
    delete process.env.SESSION_TTL_HOURS;
    assert.equal(getSessionTtlHours(), 8);

    process.env.SESSION_TTL_HOURS = '12';
    assert.equal(getSessionTtlHours(), 12);

    process.env.SESSION_TTL_HOURS = 'invalid';
    assert.equal(getSessionTtlHours(), 8);
  } finally {
    if (originalEnv !== undefined) {
      process.env.SESSION_TTL_HOURS = originalEnv;
    } else {
      delete process.env.SESSION_TTL_HOURS;
    }
  }
});

test('calculateSessionExpiry produces date in the future according to TTL', () => {
  const before = Date.now();
  const expiry = calculateSessionExpiry(2);
  const diffHours = (expiry.getTime() - before) / (3600 * 1000);
  assert.ok(diffHours >= 1.99 && diffHours <= 2.01);
});

test('cleanExpiredSessions executes deletion query and catches errors gracefully', async (t) => {
  let executedSql = '';

  t.mock.method(pool, 'query', async (sql) => {
    executedSql = sql;
    return [{ affectedRows: 5 }];
  });

  await cleanExpiredSessions();

  assert.ok(executedSql.includes('DELETE FROM user_sessions'));
  assert.ok(executedSql.includes('expires_at < NOW()'));
});

test('cleanExpiredSessions handles database errors without throwing', async (t) => {
  t.mock.method(pool, 'query', async () => {
    throw new Error('Database connection lost');
  });

  await assert.doesNotReject(async () => {
    await cleanExpiredSessions();
  });
});
