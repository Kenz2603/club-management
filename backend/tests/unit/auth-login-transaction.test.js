const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const passwordUtils = require('../../src/utils/password');
const auth = require('../../src/services/auth.service');
const limiter = require('../../src/middleware/rate-limiter');
const { hashSessionToken, verifyCsrfToken } = require('../../src/utils/session');

const req = { ip: '127.0.0.1', headers: { 'user-agent': 'transaction-test' } };
const denied = error => error.statusCode === 401 && error.message === 'Tên đăng nhập hoặc mật khẩu không chính xác';

test.beforeEach(() => { limiter._resetAllForTesting(); });

function setup(t) {
  const snapshot = {
    id: 7, username: 'viewer', email: 'viewer@example.test',
    password_hash: 'verified-hash', full_name: 'Viewer', role: 'viewer', status: 'active'
  };
  const state = { snapshot, current: { ...snapshot }, inserted: null };
  const connection = {
    beginTransaction: t.mock.fn(async () => {}),
    commit: t.mock.fn(async () => {}),
    rollback: t.mock.fn(async () => {}),
    release: t.mock.fn(() => {}),
    query: t.mock.fn(async (sql, params) => {
      if (sql.includes('FOR UPDATE')) {
        assert.deepEqual(params, ['viewer', 'viewer']);
        return [state.current ? [state.current] : []];
      }
      if (sql.includes('INSERT INTO user_sessions')) {
        state.inserted = params;
        return [{ insertId: 91 }];
      }
      if (sql.includes('UPDATE users SET last_login_at')) {
        assert.deepEqual(params, [state.current.id]);
        return [{ affectedRows: 1 }];
      }
      assert.fail('Unexpected transaction query');
    })
  };
  t.mock.method(pool, 'query', async (sql, params) => {
    assert.ok(!sql.includes('FOR UPDATE'));
    assert.deepEqual(params, ['viewer', 'viewer']);
    return [state.snapshot ? [state.snapshot] : []];
  });
  t.mock.method(pool, 'getConnection', async () => connection);
  t.mock.method(passwordUtils, 'verifyPassword', async () => true);
  t.mock.method(passwordUtils, 'dummyVerifyPassword', async () => false);
  return { state, connection };
}

function limited() {
  let status;
  let passed = false;
  limiter.loginRateLimiter({ ...req, body: { username: 'viewer' } }, {
    status(code) { status = code; return this; },
    json() {}
  }, () => { passed = true; });
  return passed ? false : status === 429;
}

test('login completes password verification before acquiring a transaction connection', async (t) => {
  const { state, connection } = setup(t);
  const started = Promise.withResolvers();
  const resume = Promise.withResolvers();
  t.mock.method(passwordUtils, 'verifyPassword', async (plain, hash) => {
    assert.equal(plain, 'test-password');
    assert.equal(hash, 'verified-hash');
    started.resolve();
    await resume.promise;
    return true;
  });
  const pending = auth.login(' VIEWER ', 'test-password', req);
  try {
    await started.promise;
    assert.equal(pool.getConnection.mock.callCount(), 0);
    assert.equal(connection.beginTransaction.mock.callCount(), 0);
    state.current.role = 'manager';
    state.current.full_name = 'Updated name';
  } finally {
    resume.resolve();
  }
  const result = await pending;
  assert.deepEqual(result.user, {
    id: 7, username: 'viewer', email: 'viewer@example.test', full_name: 'Updated name', role: 'manager'
  });
  assert.equal(state.inserted[0], 7);
  assert.equal(state.inserted[1], hashSessionToken(result.sessionToken));
  assert.equal(verifyCsrfToken(result.csrfToken, state.inserted[2], 91), true);
  assert.equal(connection.commit.mock.callCount(), 1);
  assert.equal(connection.release.mock.callCount(), 1);
});

for (const change of ['disabled', 'password', 'deleted', 'reassigned identifier']) {
  test(`login rejects stale credentials after concurrent ${change}`, async (t) => {
    const { state, connection } = setup(t);
    t.mock.method(passwordUtils, 'verifyPassword', async () => {
      assert.equal(pool.getConnection.mock.callCount(), 0);
      if (change === 'disabled') state.current.status = 'disabled';
      if (change === 'password') state.current.password_hash = 'new-hash';
      if (change === 'deleted') state.current = null;
      if (change === 'reassigned identifier') state.current.id = 8;
      return true;
    });
    await assert.rejects(auth.login('viewer', 'test-password', req), denied);
    assert.equal(state.inserted, null);
    assert.equal(connection.commit.mock.callCount(), 0);
    assert.equal(connection.rollback.mock.callCount(), 1);
    assert.equal(connection.release.mock.callCount(), 1);
  });
}

test('login keeps the verified hash snapshot even if the read object is changed in place', async (t) => {
  const { state } = setup(t);
  state.current = state.snapshot;
  t.mock.method(passwordUtils, 'verifyPassword', async () => {
    state.snapshot.password_hash = 'changed-during-scrypt';
    return true;
  });
  await assert.rejects(auth.login('viewer', 'test-password', req), denied);
  assert.equal(state.inserted, null);
});

for (const reason of ['missing', 'wrong password', 'disabled']) {
  test(`login does not open a transaction for ${reason} credentials`, async (t) => {
    const { state } = setup(t);
    if (reason === 'missing') state.snapshot = null;
    if (reason === 'disabled') state.snapshot.status = 'disabled';
    if (reason === 'wrong password') t.mock.method(passwordUtils, 'verifyPassword', async () => false);
    await assert.rejects(auth.login('viewer', 'test-password', req), denied);
    assert.equal(pool.getConnection.mock.callCount(), 0);
    assert.equal(passwordUtils.dummyVerifyPassword.mock.callCount(), reason === 'missing' ? 1 : 0);
  });
}

test('login does not swallow last_login_at failure or clear failed attempts before commit', async (t) => {
  const { connection } = setup(t);
  const original = new Error('last_login_at failed');
  for (let i = 0; i < 5; i++) limiter.recordFailedLogin(req.ip, 'viewer');
  assert.equal(limited(), true);
  const query = connection.query;
  connection.query = t.mock.fn(async (sql, params) => {
    if (sql.includes('UPDATE users SET last_login_at')) throw original;
    return query(sql, params);
  });
  await assert.rejects(auth.login('viewer', 'test-password', req), error => error === original);
  assert.equal(connection.commit.mock.callCount(), 0);
  assert.equal(connection.rollback.mock.callCount(), 1);
  assert.equal(connection.release.mock.callCount(), 1);
  assert.equal(limited(), true);
});

test('login clears account failures only after commit succeeds', async (t) => {
  const { connection } = setup(t);
  for (let i = 0; i < 5; i++) limiter.recordFailedLogin(req.ip, 'viewer');
  connection.commit = t.mock.fn(async () => { assert.equal(limited(), true); });
  await auth.login('viewer', 'test-password', req);
  assert.equal(limited(), false);
});

test('login preserves commit failure when rollback also fails and keeps account failures', async (t) => {
  const { connection } = setup(t);
  const original = new Error('commit failed');
  connection.commit = t.mock.fn(async () => { throw original; });
  connection.rollback = t.mock.fn(async () => { throw new Error('rollback failed'); });
  for (let i = 0; i < 5; i++) limiter.recordFailedLogin(req.ip, 'viewer');
  await assert.rejects(auth.login('viewer', 'test-password', req), error => error === original);
  assert.equal(connection.release.mock.callCount(), 1);
  assert.equal(limited(), true);
});
