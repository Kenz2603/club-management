const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const pool = require('../../src/config/database');
const app = require('../../src/app');
const { hashPassword } = require('../../src/utils/password');
const { hashSessionToken, createCsrfToken } = require('../../src/utils/session');
const { _resetAllForTesting } = require('../../src/middleware/rate-limiter');

test.after(async () => {
  await pool.end();
});

test.beforeEach(() => {
  _resetAllForTesting();
});

test('POST /api/auth/login returns 200 with session cookie and user data on valid credentials', async (t) => {
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
      return [{ insertId: 10 }];
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password })
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.user.username, 'admin');
    assert.equal(body.data.user.role, 'admin');
    assert.ok(typeof body.data.csrfToken === 'string');

    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('cm_session='));
    assert.ok(setCookie.includes('HttpOnly'));
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login returns uniform 401 when password is incorrect', async (t) => {
  const passwordHash = await hashPassword('CorrectPassword123');

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{
        id: 2,
        username: 'manager',
        email: 'manager@example.com',
        password_hash: passwordHash,
        full_name: 'Manager',
        role: 'manager',
        status: 'active'
      }]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'manager', password: 'WrongPassword' })
    });

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Tên đăng nhập hoặc mật khẩu không chính xác');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login returns uniform 401 when user is not found', async (t) => {
  t.mock.method(pool, 'query', async () => [[]]);

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'SomePassword123' })
    });

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Tên đăng nhập hoặc mật khẩu không chính xác');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login returns uniform 401 when user is disabled', async (t) => {
  const password = 'ValidPassword123';
  const passwordHash = await hashPassword(password);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{
        id: 3,
        username: 'disabled_user',
        email: 'disabled@example.com',
        password_hash: passwordHash,
        full_name: 'Disabled User',
        role: 'viewer',
        status: 'disabled'
      }]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'disabled_user', password })
    });

    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Tên đăng nhập hoặc mật khẩu không chính xác');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('GET /api/auth/me returns 401 when unauthenticated', async () => {
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('GET /api/auth/me returns user data when authenticated', async (t) => {
  const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const tokenHash = hashSessionToken(rawToken);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[{
        session_id: 100,
        user_id: 1,
        csrf_secret: 'csrfsecret123456789012345678901234567890123456789012345678901234',
        expires_at: new Date(Date.now() + 3600000),
        revoked_at: null,
        last_active_at: new Date(),
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        full_name: 'Administrator',
        role: 'admin',
        status: 'active'
      }]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: {
        Cookie: `cm_session=${rawToken}`
      }
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.user.username, 'admin');
    assert.ok(typeof body.data.csrfToken === 'string');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/logout revokes session and clears cookie', async (t) => {
  const rawToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const csrfSecret = 'csrfsecret123456789012345678901234567890123456789012345678901234';
  const csrfToken = createCsrfToken(csrfSecret, 100);

  let revokedSessionId = null;

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[{
        session_id: 100,
        user_id: 1,
        csrf_secret: csrfSecret,
        expires_at: new Date(Date.now() + 3600000),
        revoked_at: null,
        last_active_at: new Date(),
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        full_name: 'Administrator',
        role: 'admin',
        status: 'active'
      }]];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?')) {
      revokedSessionId = params[0];
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `cm_session=${rawToken}`,
        'X-CSRF-Token': csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      }
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(revokedSessionId, 100);

    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie && (setCookie.includes('cm_session=;') || setCookie.includes('Max-Age=0') || setCookie.includes('Expires=')));
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login rejects cross-origin login attempt with 403 (Login CSRF)', async () => {
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://malicious-site.com'
      },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });

    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.match(body.message, /Cross-Origin|nguồn gốc/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login succeeds with same-origin header', async (t) => {
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
      return [{ insertId: 20 }];
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
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ username: 'admin', password })
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.user.username, 'admin');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/auth/login truncates User-Agent exceeding 255 characters before storing session', async (t) => {
  const password = 'StrongPassword123!';
  const passwordHash = await hashPassword(password);
  let storedUserAgent = null;

  t.mock.method(pool, 'query', async (sql, params) => {
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
      storedUserAgent = params[4];
      return [{ insertId: 30 }];
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
    const oversizedUserAgent = 'A'.repeat(500);

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': oversizedUserAgent,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ username: 'admin', password })
    });

    assert.equal(response.status, 200);
    assert.ok(storedUserAgent !== null);
    assert.equal(storedUserAgent.length, 255);
    assert.equal(storedUserAgent, 'A'.repeat(255));
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});
