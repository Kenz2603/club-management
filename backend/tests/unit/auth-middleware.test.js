const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const { authenticate, requireAuth } = require('../../src/middleware/auth');
const { requireRole } = require('../../src/middleware/rbac');

test.after(async () => {
  await pool.end();
});

test('authenticate leaves req.user null when no cookie header exists', async () => {
  const req = { headers: {} };
  const res = {};
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user, null);
  assert.equal(req.session, null);
});

test('authenticate revokes session and leaves user null when user is disabled', async (t) => {
  const req = {
    headers: {
      cookie: 'cm_session=3333333333444444444455555555556666666666777777777788888888889999'
    }
  };
  const res = {};
  let nextCalled = false;
  let revokedId = null;

  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      return [[{
        session_id: 88,
        user_id: 12,
        csrf_secret: 'secret',
        expires_at: new Date(Date.now() + 10000),
        revoked_at: null,
        id: 12,
        username: 'disabled_user',
        email: 'dis@example.com',
        role: 'viewer',
        status: 'disabled'
      }]];
    }
    if (sql.includes('UPDATE user_sessions SET revoked_at = NOW()')) {
      revokedId = params[0];
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(revokedId, 88);
  assert.equal(req.user, null);
  assert.equal(req.session, null);
});

test('requireAuth blocks with 401 when req.user is null', () => {
  const req = { user: null, headers: {} };
  let statusCode = 0;
  let body = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          body = data;
        }
      };
    }
  };

  requireAuth(req, res, () => {
    assert.fail('Should not call next when unauthenticated');
  });

  assert.equal(statusCode, 401);
  assert.equal(body.success, false);
});

test('requireRole blocks with 403 when role is insufficient', () => {
  const middleware = requireRole('admin');
  const req = {
    user: { id: 1, role: 'viewer' }
  };
  let statusCode = 0;
  let body = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          body = data;
        }
      };
    }
  };

  middleware(req, res, () => {
    assert.fail('Should not call next when role is insufficient');
  });

  assert.equal(statusCode, 403);
  assert.equal(body.success, false);
});

test('requireRole allows access when role matches', () => {
  const middleware = requireRole('admin', 'manager');
  const req = {
    user: { id: 2, role: 'manager' }
  };
  let nextCalled = false;
  const res = {};

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
