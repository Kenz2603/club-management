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

function createSessionAuth(role = 'admin', userId = 1, sessionId = 100) {
  const token = Buffer.from(`tok_${role}_${userId}_${sessionId}_12345678901234567890`).toString('hex').padEnd(64, '0');
  const csrfSecret = Buffer.from(`sec_${role}_${userId}_${sessionId}_12345678901234567890`).toString('hex').padEnd(64, '0');
  const csrfToken = createCsrfToken(csrfSecret, sessionId);

  const sessionRow = {
    session_id: sessionId,
    user_id: userId,
    csrf_secret: csrfSecret,
    expires_at: new Date(Date.now() + 3600000),
    revoked_at: null,
    last_active_at: new Date(),
    id: userId,
    username: `${role}_account`,
    email: `${role}@example.com`,
    full_name: `${role} Name`,
    role,
    status: 'active'
  };

  return {
    token,
    csrfSecret,
    csrfToken,
    sessionRow,
    cookie: `cm_session=${token}`
  };
}

test('Group 1.1: POST /api/auth/login succeeds with valid credentials and sets secure cookie', async (t) => {
  const password = 'StrongPassword123!';
  const passwordHash = await hashPassword(password);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{
        id: 10,
        username: 'test_admin',
        email: 'test_admin@example.com',
        password_hash: passwordHash,
        full_name: 'Test Administrator',
        role: 'admin',
        status: 'active'
      }]];
    }
    if (sql.includes('INSERT INTO user_sessions')) {
      return [{ insertId: 77 }];
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
      body: JSON.stringify({ username: 'test_admin', password })
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.user.username, 'test_admin');
    assert.equal(body.data.user.role, 'admin');
    assert.equal(body.data.user.password_hash, undefined);
    assert.equal(body.data.user.password, undefined);
    assert.ok(typeof body.data.csrfToken === 'string');

    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie.includes('cm_session='));
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('Path=/'));
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 1.2: POST /api/auth/login fails with uniform 401 when username does not exist', async (t) => {
  t.mock.method(pool, 'query', async () => [[]]);

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
      body: JSON.stringify({ username: 'nonexistent_user', password: 'AnyPassword123' })
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

test('Group 1.3: POST /api/auth/login fails with uniform 401 when password is wrong', async (t) => {
  const actualHash = await hashPassword('ActualPassword123');

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{
        id: 11,
        username: 'some_user',
        email: 'some_user@example.com',
        password_hash: actualHash,
        full_name: 'Some User',
        role: 'viewer',
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
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ username: 'some_user', password: 'WrongPassword999' })
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

test('Group 1.4: POST /api/auth/login fails with uniform 401 when identifier or password is missing', async () => {
  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const responseMissingPass = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ username: 'admin' })
    });
    const bodyMissingPass = await responseMissingPass.json();
    assert.equal(responseMissingPass.status, 401);
    assert.equal(bodyMissingPass.success, false);
    assert.equal(bodyMissingPass.message, 'Tên đăng nhập hoặc mật khẩu không chính xác');

    const responseMissingUser = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ password: 'Password123' })
    });
    const bodyMissingUser = await responseMissingUser.json();
    assert.equal(responseMissingUser.status, 401);
    assert.equal(bodyMissingUser.success, false);
    assert.equal(bodyMissingUser.message, 'Tên đăng nhập hoặc mật khẩu không chính xác');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 1.5: POST /api/auth/login fails with uniform 401 when account is disabled', async (t) => {
  const passwordHash = await hashPassword('ValidPass123');

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{
        id: 12,
        username: 'disabled_account',
        email: 'disabled@example.com',
        password_hash: passwordHash,
        full_name: 'Disabled Person',
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
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ username: 'disabled_account', password: 'ValidPass123' })
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

test('Group 1.6 & 1.7: POST /api/auth/login sets cookie attributes and omits password_hash', async (t) => {
  const password = 'CorrectPassword123!';
  const passwordHash = await hashPassword(password);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{
        id: 15,
        username: 'secure_user',
        email: 'secure@example.com',
        password_hash: passwordHash,
        full_name: 'Secure User',
        role: 'manager',
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
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ username: 'secure_user', password })
    });

    const body = await response.json();
    assert.equal(body.data.user.password_hash, undefined);
    assert.equal(body.data.user.password, undefined);

    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('Path=/'));
    assert.ok(setCookie.includes('Max-Age='));
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 1.8: Rate limiter prevents continuous brute force login attempts with 429', async (t) => {
  t.mock.method(pool, 'query', async () => [[]]);

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    for (let i = 0; i < 5; i++) {
      await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: `http://127.0.0.1:${address.port}`
        },
        body: JSON.stringify({ username: 'attack_target', password: 'WrongPassword' })
      });
    }

    const blockedResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ username: 'attack_target', password: 'WrongPassword' })
    });

    const body = await blockedResponse.json();
    assert.equal(blockedResponse.status, 429);
    assert.equal(body.success, false);
    assert.match(body.message, /Quá nhiều lần thử/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 2.1 & 2.2: GET /api/auth/me returns user profile when authenticated and 401 when unauthenticated', async (t) => {
  const auth = createSessionAuth('admin', 1, 101);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[auth.sessionRow]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const unauthRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`);
    assert.equal(unauthRes.status, 401);

    const authRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: { Cookie: auth.cookie }
    });
    const authBody = await authRes.json();
    assert.equal(authRes.status, 200);
    assert.equal(authBody.success, true);
    assert.equal(authBody.data.user.username, 'admin_account');
    assert.equal(authBody.data.user.password_hash, undefined);
    assert.ok(typeof authBody.data.csrfToken === 'string');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 2.3 & 2.4: Invalid or expired session tokens return 401', async (t) => {
  t.mock.method(pool, 'query', async () => [[]]);

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const invalidRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: { Cookie: 'cm_session=invalid_nonexistent_hash_token_string' }
    });
    assert.equal(invalidRes.status, 401);

    const expiredRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: { Cookie: 'cm_session=expired_session_token_1234567890abcdef' }
    });
    assert.equal(expiredRes.status, 401);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 2.5 & 2.6: POST /api/auth/logout revokes session and prevents reuse', async (t) => {
  const auth = createSessionAuth('admin', 1, 105);
  let isRevoked = false;

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      if (isRevoked) {
        return [[]];
      }
      return [[auth.sessionRow]];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?')) {
      isRevoked = true;
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const logoutRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      }
    });

    const logoutBody = await logoutRes.json();
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutBody.success, true);

    const reuseRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: { Cookie: auth.cookie }
    });
    assert.equal(reuseRes.status, 401);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 2.7: Concurrent active sessions for same user function independently', async (t) => {
  const rawTokenA = 'aaaa1111'.repeat(8);
  const rawTokenB = 'bbbb2222'.repeat(8);
  const hashA = hashSessionToken(rawTokenA);
  const hashB = hashSessionToken(rawTokenB);

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      const queriedHash = params && params[0];
      if (queriedHash === hashA) {
        return [[{
          session_id: 201,
          user_id: 5,
          csrf_secret: 'secretA'.repeat(8),
          expires_at: new Date(Date.now() + 3600000),
          revoked_at: null,
          last_active_at: new Date(),
          id: 5,
          username: 'multi_user',
          email: 'multi@example.com',
          full_name: 'Multi Session',
          role: 'viewer',
          status: 'active'
        }]];
      }
      if (queriedHash === hashB) {
        return [[{
          session_id: 202,
          user_id: 5,
          csrf_secret: 'secretB'.repeat(8),
          expires_at: new Date(Date.now() + 3600000),
          revoked_at: null,
          last_active_at: new Date(),
          id: 5,
          username: 'multi_user',
          email: 'multi@example.com',
          full_name: 'Multi Session',
          role: 'viewer',
          status: 'active'
        }]];
      }
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const resA = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: { Cookie: `cm_session=${rawTokenA}` }
    });
    const bodyA = await resA.json();
    assert.equal(resA.status, 200);
    assert.equal(bodyA.data.user.id, 5);

    const resB = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: { Cookie: `cm_session=${rawTokenB}` }
    });
    const bodyB = await resB.json();
    assert.equal(resB.status, 200);
    assert.equal(bodyB.data.user.id, 5);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 3.1 & 3.2: Origin validation accepts same-origin and rejects cross-origin POST', async (t) => {
  const auth = createSessionAuth('admin', 1, 301);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[auth.sessionRow]];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at')) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const rejectRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: 'http://malicious-website.xyz'
      }
    });
    assert.equal(rejectRes.status, 403);

    const acceptRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      }
    });
    assert.equal(acceptRes.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 3.3: POST with session cookie missing Origin and Referer is rejected with 403', async (t) => {
  const auth = createSessionAuth('admin', 1, 302);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[auth.sessionRow]];
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
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken
      }
    });
    assert.equal(response.status, 403);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 3.4 & 3.5 & 3.6: CSRF token verification enforces presence, rejects mismatch, accepts valid token', async (t) => {
  const auth = createSessionAuth('admin', 1, 303);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[auth.sessionRow]];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at')) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const missingCsrfRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        Origin: `http://127.0.0.1:${address.port}`
      }
    });
    assert.equal(missingCsrfRes.status, 403);

    const forgedCsrfRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': 'forged_fake_token_hex_value_00000000000000000000000000000000',
        Origin: `http://127.0.0.1:${address.port}`
      }
    });
    assert.equal(forgedCsrfRes.status, 403);

    const validCsrfRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      }
    });
    assert.equal(validCsrfRes.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 3.7: Safe HTTP GET methods are never blocked by CSRF checks', async (t) => {
  const auth = createSessionAuth('viewer', 2, 304);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[auth.sessionRow]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: { Cookie: auth.cookie }
    });
    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 4.1 & 4.2 & 4.3: RBAC restricts /api/users to admin and rejects manager and viewer with 403', async (t) => {
  const adminAuth = createSessionAuth('admin', 1, 401);
  const managerAuth = createSessionAuth('manager', 2, 402);
  const viewerAuth = createSessionAuth('viewer', 3, 403);

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      const hash = params && params[0];
      if (hash === hashSessionToken(adminAuth.token)) {
        return [[adminAuth.sessionRow]];
      }
      if (hash === hashSessionToken(managerAuth.token)) {
        return [[managerAuth.sessionRow]];
      }
      if (hash === hashSessionToken(viewerAuth.token)) {
        return [[viewerAuth.sessionRow]];
      }
    }
    if (sql.includes('SELECT COUNT(*) as total FROM users')) {
      return [[{ total: 1 }]];
    }
    if (sql.includes('FROM users') && sql.includes('LIMIT')) {
      return [[{
        id: 1,
        username: 'admin_account',
        email: 'admin@example.com',
        full_name: 'Admin Name',
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

    const adminRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      headers: { Cookie: adminAuth.cookie }
    });
    assert.equal(adminRes.status, 200);

    const managerRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      headers: { Cookie: managerAuth.cookie }
    });
    assert.equal(managerRes.status, 403);

    const viewerRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      headers: { Cookie: viewerAuth.cookie }
    });
    assert.equal(viewerRes.status, 403);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 4.4 & 4.5 & 4.6: Unauthenticated access blocked with 401 and privilege escalation blocked with 403', async (t) => {
  const managerAuth = createSessionAuth('manager', 2, 404);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[managerAuth.sessionRow]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const unauthPut = await fetch(`http://127.0.0.1:${address.port}/api/users/2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' })
    });
    assert.equal(unauthPut.status, 401);

    const managerEscalatePut = await fetch(`http://127.0.0.1:${address.port}/api/users/2`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: managerAuth.cookie,
        'X-CSRF-Token': managerAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ role: 'admin' })
    });
    assert.equal(managerEscalatePut.status, 403);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 5.1 & 5.2: POST /api/users creates user and prevents duplicates with 409', async (t) => {
  const adminAuth = createSessionAuth('admin', 1, 501);

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[adminAuth.sessionRow]];
    }
    if (sql.includes('SELECT id, username, email FROM users WHERE username = ? OR email = ?')) {
      const username = params && params[0];
      if (username === 'duplicate_user') {
        return [[{ id: 99, username: 'duplicate_user', email: 'dup@example.com' }]];
      }
      return [[]];
    }
    if (sql.includes('INSERT INTO users')) {
      return [{ insertId: 70 }];
    }
    if (sql.includes('SELECT id, username, email, full_name, role, status') && sql.includes('WHERE id = ?')) {
      return [[{
        id: 70,
        username: 'brand_new_user',
        email: 'brand_new@example.com',
        full_name: 'Brand New',
        role: 'viewer',
        status: 'active'
      }]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const createRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({
        username: 'brand_new_user',
        email: 'brand_new@example.com',
        password: 'Password123!',
        full_name: 'Brand New',
        role: 'viewer'
      })
    });
    const createBody = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.equal(createBody.data.username, 'brand_new_user');
    assert.equal(createBody.data.password_hash, undefined);

    const dupRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({
        username: 'duplicate_user',
        email: 'brand_new@example.com',
        password: 'Password123!',
        full_name: 'Dup User',
        role: 'viewer'
      })
    });
    assert.equal(dupRes.status, 409);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 5.3: POST /api/users rejects invalid input with 400', async (t) => {
  const adminAuth = createSessionAuth('admin', 1, 502);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[adminAuth.sessionRow]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const shortPassRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({
        username: 'validuser',
        email: 'valid@example.com',
        password: 'short',
        full_name: 'Valid Name',
        role: 'viewer'
      })
    });
    assert.equal(shortPassRes.status, 400);

    const badEmailRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({
        username: 'validuser',
        email: 'invalid-email-address',
        password: 'Password123!',
        full_name: 'Valid Name',
        role: 'viewer'
      })
    });
    assert.equal(badEmailRes.status, 400);

    const badUsernameRes = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({
        username: 'a!',
        email: 'valid@example.com',
        password: 'Password123!',
        full_name: 'Valid Name',
        role: 'viewer'
      })
    });
    assert.equal(badUsernameRes.status, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 5.4 & 5.5: User listing and info update succeed for admin', async (t) => {
  const adminAuth = createSessionAuth('admin', 1, 503);

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    query: async (sql, params) => sql.includes('FROM users WHERE id = ?') ? pool.query(sql, params) : [[]],
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);
  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[adminAuth.sessionRow]];
    }
    if (sql.includes('SELECT COUNT(*) as total FROM users')) {
      return [[{ total: 1 }]];
    }
    if (sql.includes('SELECT id, username, email, full_name, role, status') && sql.includes('WHERE id = ?')) {
      return [[{
        id: 15,
        username: 'target_user',
        email: 'target@example.com',
        full_name: 'Target Full Name',
        role: 'viewer',
        status: 'active'
      }]];
    }
    if (sql.includes('FROM users') && sql.includes('LIMIT')) {
      return [[{
        id: 15,
        username: 'target_user',
        email: 'target@example.com',
        full_name: 'Target Full Name',
        role: 'viewer',
        status: 'active'
      }]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const listRes = await fetch(`http://127.0.0.1:${address.port}/api/users?page=1&limit=10`, {
      headers: { Cookie: adminAuth.cookie }
    });
    const listBody = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.equal(listBody.pagination.page, 1);
    assert.equal(listBody.data.length, 1);

    const updateRes = await fetch(`http://127.0.0.1:${address.port}/api/users/15`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ full_name: 'Updated Name', email: 'updated@example.com' })
    });
    assert.equal(updateRes.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 5.6 & 5.7: Role changes and status disabling revoke user active sessions', async (t) => {
  const adminAuth = createSessionAuth('admin', 1, 504);
  let sessionRevokedForTarget = false;

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM users WHERE id = ?')) return pool.query(sql, params);
      if (sql.includes('FOR UPDATE')) return [[{ id: 1, role: 'admin', status: 'active' }]];
      if (sql.includes('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ?')) {
        sessionRevokedForTarget = true;
      }
      return [{ affectedRows: 1 }];
    },
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);
  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[adminAuth.sessionRow]];
    }
    if (sql.includes('SELECT id, username, email, full_name, role, status') && sql.includes('WHERE id = ?')) {
      return [[{
        id: 20,
        username: 'subordinate_user',
        email: 'sub@example.com',
        full_name: 'Subordinate',
        role: 'viewer',
        status: 'active'
      }]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const patchRes = await fetch(`http://127.0.0.1:${address.port}/api/users/20/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ status: 'disabled' })
    });
    assert.equal(patchRes.status, 200);
    assert.equal(sessionRevokedForTarget, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 5.8 & 5.9 & 5.10: Self-disabling and last active admin demotion are blocked with 409', async (t) => {
  const adminAuth = createSessionAuth('admin', 1, 505);

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM users WHERE id = ?')) return pool.query(sql, params);
      if (sql.includes('FOR UPDATE')) {
        return [[{ id: 1, role: 'admin', status: 'active' }]];
      }
      return [[]];
    },
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);
  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[adminAuth.sessionRow]];
    }
    if (sql.includes('SELECT id, username, email, full_name, role, status') && sql.includes('WHERE id = ?')) {
      return [[{
        id: 1,
        username: 'admin_account',
        email: 'admin@example.com',
        full_name: 'Admin Name',
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

    const selfDisableRes = await fetch(`http://127.0.0.1:${address.port}/api/users/1/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ status: 'disabled' })
    });
    assert.equal(selfDisableRes.status, 409);

    const demoteRes = await fetch(`http://127.0.0.1:${address.port}/api/users/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ role: 'viewer' })
    });
    assert.equal(demoteRes.status, 409);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 6.1 & 6.2 & 6.3: PUT /api/auth/password verifies current password, length, and updates hash', async (t) => {
  const currentPassword = 'OldPassword123!';
  const currentHash = await hashPassword(currentPassword);
  const auth = createSessionAuth('viewer', 8, 601);

  let updatedPasswordHash = null;
  let revokedOtherSessions = false;

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[auth.sessionRow]];
    }
    if (sql.includes('SELECT password_hash FROM users WHERE id = ?')) {
      return [[{ password_hash: currentHash }]];
    }
    if (sql.includes('UPDATE users SET password_hash = ?')) {
      updatedPasswordHash = params && params[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND id != ?')) {
      revokedOtherSessions = true;
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const shortPassRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: 'short' })
    });
    assert.equal(shortPassRes.status, 400);

    const wrongCurrentRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ current_password: 'WrongCurrentPassword123', new_password: 'NewStrongPassword123!' })
    });
    assert.equal(wrongCurrentRes.status, 400);

    const successRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: 'NewStrongPassword123!' })
    });
    const successBody = await successRes.json();
    assert.equal(successRes.status, 200);
    assert.equal(successBody.success, true);
    assert.ok(updatedPasswordHash !== null);
    assert.equal(revokedOtherSessions, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 6.4 & 6.5: PUT /api/auth/password requires CSRF token and maintains current session', async (t) => {
  const currentPassword = 'OldPassword123!';
  const currentHash = await hashPassword(currentPassword);
  const auth = createSessionAuth('viewer', 8, 602);

  let currentSessionExcluded = false;

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[auth.sessionRow]];
    }
    if (sql.includes('SELECT password_hash FROM users WHERE id = ?')) {
      return [[{ password_hash: currentHash }]];
    }
    if (sql.includes('UPDATE users SET password_hash = ?')) {
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND id != ?')) {
      if (params && params[1] === 602) {
        currentSessionExcluded = true;
      }
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const missingCsrfRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth.cookie,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: 'NewStrongPassword123!' })
    });
    assert.equal(missingCsrfRes.status, 403);

    const successRes = await fetch(`http://127.0.0.1:${address.port}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: 'NewStrongPassword123!' })
    });
    assert.equal(successRes.status, 200);
    assert.equal(currentSessionExcluded, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 7.1 & 7.2: Health check and club listing preserve Phase 1 contract and compatibility', async (t) => {
  t.mock.method(pool, 'execute', async (sql) => {
    if (sql.includes('FROM clubs')) {
      return [[{
        id: 1,
        name: 'CLB Cong nghe thong tin',
        description: 'Mo ta ngan gon',
        founded_date: '2026-01-01',
        status: 'active',
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      }]];
    }
    return [[]];
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const healthRes = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const healthBody = await healthRes.json();
    assert.equal(healthRes.status, 200);
    assert.equal(healthBody.status, 'ok');
    assert.equal(healthBody.application, 'Club Management');

    const clubsRes = await fetch(`http://127.0.0.1:${address.port}/api/clubs`);
    const clubsBody = await clubsRes.json();
    assert.equal(clubsRes.status, 200);
    assert.equal(clubsBody.success, true);
    assert.equal(Array.isArray(clubsBody.data), true);
    assert.equal(clubsBody.pagination, undefined);
    assert.equal(clubsBody.data.length, 1);
    assert.equal(clubsBody.data[0].name, 'CLB Cong nghe thong tin');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Group 7.3 & 7.4: Phase 1 public APIs require no auth/CSRF and handle database error with 500', async (t) => {
  t.mock.method(pool, 'execute', async () => {
    throw new Error('Connection refused');
  });

  const server = http.createServer(app);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const errorRes = await fetch(`http://127.0.0.1:${address.port}/api/clubs`);
    const errorBody = await errorRes.json();
    assert.equal(errorRes.status, 500);
    assert.equal(errorBody.success, false);
    assert.equal(errorBody.message, 'Unable to fetch clubs');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});
