const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const pool = require('../../src/config/database');
const app = require('../../src/app');
const { createCsrfToken } = require('../../src/utils/session');

test.after(async () => {
  await pool.end();
});

function createAuthContext(role = 'admin', userId = 1) {
  const token = '1111111111222222222233333333334444444444555555555566666666667777';
  const csrfSecret = 'csrfsecret123456789012345678901234567890123456789012345678901234';
  const csrfToken = createCsrfToken(csrfSecret, 100);

  const sessionRow = {
    session_id: 100,
    user_id: userId,
    csrf_secret: csrfSecret,
    expires_at: new Date(Date.now() + 3600000),
    revoked_at: null,
    last_active_at: new Date(),
    id: userId,
    username: role === 'admin' ? 'admin_user' : 'other_user',
    email: `${role}@example.com`,
    full_name: 'Test Account',
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

test('GET /api/users returns 401 when unauthenticated', async () => {
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users`);
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('GET /api/users returns 403 when role is not admin', async (t) => {
  const ctx = createAuthContext('manager', 2);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      headers: {
        Cookie: ctx.cookie
      }
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /quyền/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('GET /api/users returns paginated list for admin', async (t) => {
  const ctx = createAuthContext('admin', 1);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    if (sql.includes('SELECT COUNT(*) as total FROM users')) {
      return [[{ total: 2 }]];
    }
    if (sql.includes('FROM users') && sql.includes('LIMIT')) {
      return [[
        { id: 1, username: 'admin_user', email: 'admin@example.com', role: 'admin', status: 'active' },
        { id: 2, username: 'viewer_user', email: 'viewer@example.com', role: 'viewer', status: 'active' }
      ]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users?page=1&limit=10`, {
      headers: {
        Cookie: ctx.cookie
      }
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(body.pagination.total, 2);
    assert.equal(body.pagination.page, 1);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/users creates a new user and returns 201', async (t) => {
  const ctx = createAuthContext('admin', 1);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[]];
    }
    if (sql.includes('INSERT INTO users')) {
      return [{ insertId: 5 }];
    }
    if (sql.includes('FROM users WHERE id = ?')) {
      return [[{
        id: 5,
        username: 'new_manager',
        email: 'manager@club.com',
        full_name: 'New Manager',
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

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ctx.cookie,
        'X-CSRF-Token': ctx.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({
        username: 'new_manager',
        email: 'manager@club.com',
        password: 'ValidPassword123!',
        full_name: 'New Manager',
        role: 'manager'
      })
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.username, 'new_manager');
    assert.equal(body.data.role, 'manager');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/users returns 409 when username or email is already taken', async (t) => {
  const ctx = createAuthContext('admin', 1);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    if (sql.includes('FROM users WHERE username = ? OR email = ?')) {
      return [[{ id: 2, username: 'existing_user', email: 'existing@club.com' }]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ctx.cookie,
        'X-CSRF-Token': ctx.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({
        username: 'existing_user',
        email: 'existing@club.com',
        password: 'ValidPassword123!',
        full_name: 'Existing User'
      })
    });

    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.success, false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('PATCH /api/users/:id/status prevents self-disabling with 409', async (t) => {
  const ctx = createAuthContext('admin', 1);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users/1/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ctx.cookie,
        'X-CSRF-Token': ctx.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ status: 'disabled' })
    });

    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /chính mình/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('PATCH /api/users/:id/status prevents disabling the last active admin with 409', async (t) => {
  const ctx = createAuthContext('admin', 1);

  const mockConnection = {
    beginTransaction: async () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM users WHERE id = ?')) return pool.query(sql, params);
      if (sql.includes('FOR UPDATE')) {
        return [[{ id: 2, role: 'admin', status: 'active' }]];
      }
      return [[]];
    },
    commit: async () => {},
    rollback: async () => {},
    release: () => {}
  };

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    if (sql.includes('FROM users WHERE id = ?')) {
      return [[{ id: 2, username: 'other_admin', email: 'other@admin.com', role: 'admin', status: 'active' }]];
    }
    return [[]];
  });

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users/2/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ctx.cookie,
        'X-CSRF-Token': ctx.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ status: 'disabled' })
    });

    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /duy nhất/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('PUT /api/users/:id prevents demoting the last active admin with 409', async (t) => {
  const ctx = createAuthContext('admin', 1);

  const mockConnection = {
    beginTransaction: async () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM users WHERE id = ?')) return pool.query(sql, params);
      if (sql.includes('FOR UPDATE')) {
        return [[{ id: 1, role: 'admin', status: 'active' }]];
      }
      return [[]];
    },
    commit: async () => {},
    rollback: async () => {},
    release: () => {}
  };

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    if (sql.includes('FROM users WHERE id = ?')) {
      return [[{ id: 1, username: 'admin_user', email: 'admin@example.com', full_name: 'Test Account', role: 'admin', status: 'active' }]];
    }
    return [[]];
  });

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ctx.cookie,
        'X-CSRF-Token': ctx.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ role: 'manager' })
    });

    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /hạ quyền/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('POST /api/users/:id/reset-password resets password and revokes user sessions', async (t) => {
  const ctx = createAuthContext('admin', 1);

  let updatedSql = '';
  let revokedSql = '';

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    if (sql.includes('FROM users WHERE id = ?')) {
      return [[{ id: 3, username: 'user3', email: 'u3@example.com', full_name: 'User 3', role: 'viewer', status: 'active' }]];
    }
    if (sql.includes('UPDATE users SET password_hash = ?')) {
      updatedSql = sql;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ?')) {
      revokedSql = sql;
      return [{ affectedRows: 2 }];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users/3/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ctx.cookie,
        'X-CSRF-Token': ctx.csrfToken,
        Origin: `http://127.0.0.1:${address.port}`
      },
      body: JSON.stringify({ new_password: 'NewStrongPassword123!' })
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(updatedSql.length > 0);
    assert.ok(revokedSql.length > 0);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('GET /api/users/:id returns 404 when user is not found', async (t) => {
  const ctx = createAuthContext('admin', 1);

  t.mock.method(pool, 'query', async (sql) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[ctx.sessionRow]];
    }
    if (sql.includes('FROM users WHERE id = ?')) {
      return [[]];
    }
    return [[]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users/999`, {
      headers: {
        Cookie: ctx.cookie
      }
    });

    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.success, false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('Concurrent admin updates prevent leaving system with zero active admins', async (t) => {
  const usersService = require('../../src/services/users.service');

  let activeAdmins = [
    { id: 1, username: 'admin1', email: 'a1@example.com', full_name: 'Admin One', role: 'admin', status: 'active' },
    { id: 2, username: 'admin2', email: 'a2@example.com', full_name: 'Admin Two', role: 'admin', status: 'active' }
  ];

  let lockHolder = false;
  const lockQueue = [];

  const acquireLock = () => {
    return new Promise((resolve) => {
      if (!lockHolder) {
        lockHolder = true;
        resolve();
      } else {
        lockQueue.push(resolve);
      }
    });
  };

  const releaseLock = () => {
    if (lockQueue.length > 0) {
      const nextResolve = lockQueue.shift();
      nextResolve();
    } else {
      lockHolder = false;
    }
  };

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM users WHERE id = ?')) {
      const target = activeAdmins.find(u => u.id === Number(params[0]));
      return target ? [[target]] : [[]];
    }
    return [[]];
  });

  t.mock.method(pool, 'getConnection', async () => {
    let hasLock = false;
    let pendingChanges = null;

    return {
      beginTransaction: async () => {},
      query: async (sql, params) => {
        if (sql.includes('FROM users WHERE id = ?')) return pool.query(sql, params);
        if (sql.includes('FOR UPDATE')) {
          await acquireLock();
          hasLock = true;
          return [activeAdmins.filter(u => u.role === 'admin' && u.status === 'active')];
        }
        if (sql.includes('UPDATE users SET full_name = ?, email = ?, role = ? WHERE id = ?')) {
          pendingChanges = { id: Number(params[3]), role: params[2] };
          return [{ affectedRows: 1 }];
        }
        return [[]];
      },
      commit: async () => {
        if (pendingChanges) {
          activeAdmins = activeAdmins.map(u => u.id === pendingChanges.id ? { ...u, role: pendingChanges.role } : u);
        }
        if (hasLock) {
          hasLock = false;
          releaseLock();
        }
      },
      rollback: async () => {
        if (hasLock) {
          hasLock = false;
          releaseLock();
        }
      },
      release: () => {
        if (hasLock) {
          hasLock = false;
          releaseLock();
        }
      }
    };
  });

  const results = await Promise.allSettled([
    usersService.updateUser(1, { full_name: 'Admin One', role: 'viewer' }, 2),
    usersService.updateUser(2, { full_name: 'Admin Two', role: 'viewer' }, 1)
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.statusCode, 409);
  assert.match(rejected[0].reason.message, /duy nhất/i);
});
