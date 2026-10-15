const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCookies,
  isConnectionSecure,
  getSessionCookieOptions,
  getClearCookieOptions
} = require('../../src/utils/cookies');

test('parseCookies parses cookie string into key-value map', () => {
  const cookieHeader = 'cm_session=token123; other_cookie=val%20456; test=1';
  const cookies = parseCookies(cookieHeader);
  assert.equal(cookies.cm_session, 'token123');
  assert.equal(cookies.other_cookie, 'val 456');
  assert.equal(cookies.test, '1');
  assert.deepEqual(parseCookies(''), {});
  assert.deepEqual(parseCookies(null), {});
});

test('isConnectionSecure respects COOKIE_SECURE env or headers', () => {
  const origEnv = process.env.COOKIE_SECURE;
  try {
    process.env.COOKIE_SECURE = 'true';
    assert.equal(isConnectionSecure({}), true);

    process.env.COOKIE_SECURE = 'false';
    assert.equal(isConnectionSecure({}), false);

    delete process.env.COOKIE_SECURE;
    assert.equal(isConnectionSecure({ protocol: 'https' }), true);
    assert.equal(isConnectionSecure({ secure: true }), true);
    assert.equal(isConnectionSecure({ protocol: 'http', secure: false }), false);
    assert.equal(isConnectionSecure({ headers: { 'x-forwarded-proto': 'https' } }), false);
    assert.equal(isConnectionSecure({ headers: {} }), false);
  } finally {
    if (origEnv !== undefined) {
      process.env.COOKIE_SECURE = origEnv;
    } else {
      delete process.env.COOKIE_SECURE;
    }
  }
});

test('getSessionCookieOptions returns expected flags and TTL', () => {
  const opts = getSessionCookieOptions({});
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, 'lax');
  assert.equal(opts.path, '/');
  assert.equal(opts.maxAge, 8 * 3600 * 1000);
});

test('getClearCookieOptions returns proper removal flags', () => {
  const opts = getClearCookieOptions();
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, 'lax');
  assert.equal(opts.path, '/');
});
