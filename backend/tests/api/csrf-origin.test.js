const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const pool = require('../../src/config/database');
const app = require('../../src/app');
const { createCsrfToken } = require('../../src/utils/session');
const { hashPassword } = require('../../src/utils/password');
const { extractOriginFromReferer } = require('../../src/utils/origin-validator');

test.after(async () => {
  await pool.end();
});

function setupMockSession(t) {
  const token = '2222222222333333333344444444445555555555666666666677777777778888';
  const csrfSecret = 'csrfsecretabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef';
  const sessionId = 50;
  const csrfToken = createCsrfToken(csrfSecret, sessionId);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[{
        session_id: sessionId,
        user_id: 1,
        csrf_secret: csrfSecret,
        expires_at: new Date(Date.now() + 3600000),
        revoked_at: null,
        last_active_at: new Date(),
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        full_name: 'Admin',
        role: 'admin',
        status: 'active'
      }]];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at = NOW()')) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  return {
    token,
    csrfToken,
    cookie: `cm_session=${token}`
  };
}

test('POST /api/auth/logout is blocked with 403 when X-CSRF-Token header is missing', async (t) => {
  const { cookie } = setupMockSession(t);
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: `http://127.0.0.1:${address.port}`
      }
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /CSRF/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/logout is blocked with 403 when X-CSRF-Token is invalid', async (t) => {
  const { cookie } = setupMockSession(t);
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'X-CSRF-Token': 'invalid_forged_csrf_token',
        Origin: `http://127.0.0.1:${address.port}`
      }
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /CSRF/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/logout is blocked with 403 when Origin is untrusted', async (t) => {
  const { cookie, csrfToken } = setupMockSession(t);
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
        Origin: 'http://malicious-website.com'
      }
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Cross-Origin/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/logout succeeds with 200 when Origin and CSRF token are valid', async (t) => {
  const { cookie, csrfToken } = setupMockSession(t);
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      }
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('extractOriginFromReferer parses valid URLs and returns null for invalid input', () => {
  assert.equal(extractOriginFromReferer('http://example.com/login?foo=bar'), 'http://example.com');
  assert.equal(extractOriginFromReferer('https://secure.club.local:8443/app/dashboard'), 'https://secure.club.local:8443');
  assert.equal(extractOriginFromReferer('not-a-valid-url'), null);
  assert.equal(extractOriginFromReferer(''), null);
  assert.equal(extractOriginFromReferer(null), null);
});

test('POST /api/auth/login is blocked with 403 when Referer is from cross-origin site', async () => {
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'http://malicious-attacker.com/phishing.html'
      },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Cross-Origin|nguồn gốc/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login succeeds when Origin is missing but same-origin Referer is present', async (t) => {
  const password = 'StrongPassword123!';
  const passwordHash = await hashPassword(password);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password_hash: passwordHash,
        full_name: 'Administrator',
        role: 'admin',
        status: 'active'
      }]];
    }
    if (sql.includes('INSERT INTO user_sessions')) {
      return [{ insertId: 99 }];
    }
    if (sql.includes('UPDATE users SET last_login_at')) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: `http://127.0.0.1:${address.port}/login.html`
      },
      body: JSON.stringify({ username: 'admin', password })
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login is blocked with 403 in production when both Origin and Referer are missing', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});
