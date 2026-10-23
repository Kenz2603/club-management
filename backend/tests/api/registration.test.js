const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const app = require('../../src/app');
const pool = require('../../src/config/database');
const users = require('../../src/services/users.service');
const registration = require('../../src/services/registration.service');
const { verifyPassword } = require('../../src/utils/password');
const { createRegistrationLimiter } = require('../../src/middleware/registration-limiter');
const valid = () => ({ username: 'new_user', email: 'new@example.test', full_name: 'Người dùng mới', password: 'Registration-test-123', confirm_password: 'Registration-test-123' });
test.after(() => pool.end());

test('registration reuses scrypt and bound user queries, creates only active viewer and returns no secrets', async t => {
  let stored;
  const calls = [];
  t.mock.method(pool, 'query', async (sql, params) => {
    calls.push(sql);
    if (sql.startsWith('SELECT id, username, email FROM')) return [[]];
    if (sql.includes('INSERT INTO users')) { stored = params; return [{ insertId: 8 }]; }
    if (sql.includes('WHERE id = ?')) return [[{ id: 8, username: stored[0], email: stored[1], full_name: stored[3], role: stored[4], status: 'active' }]];
    throw new Error('Unexpected query');
  });
  const input = { ...valid(), username: ' New_USER ', email: ' NEW@EXAMPLE.TEST ', full_name: "  Literal '); DROP TABLE users; --  " };
  const result = await registration.register(input);
  assert.equal(result.username, 'new_user');
  assert.equal(result.email, 'new@example.test');
  assert.equal(result.role, 'viewer');
  assert.equal(stored[3], input.full_name.trim());
  assert.equal(stored[4], 'viewer');
  assert.ok(stored[2].startsWith('scrypt$'));
  assert.equal(await verifyPassword(input.password, stored[2]), true);
  assert.equal(calls.length, 3);
  assert.equal(calls.some(sql => /members|user_sessions/.test(sql)), false);
  assert.equal(JSON.stringify(result).includes('password'), false);
});

for (const [field, value] of [
  ['full_name', ' '], ['full_name', 'a'.repeat(151)], ['full_name', {}],
  ['username', 'aa'], ['username', "x' OR 1=1 --"], ['username', 'a'.repeat(51)], ['username', []],
  ['email', 'bad-email'], ['email', 'a'.repeat(190) + '@x.test'], ['email', {}],
  ['password', 'short'], ['password', 'a'.repeat(1025)], ['password', {}],
  ['confirm_password', 'different'], ['confirm_password', undefined]
]) {
  test(`registration rejects invalid ${field}: ${typeof value === 'string' ? value.length : typeof value}`, async t => {
    const mock = t.mock.method(users, 'createUser', async () => { throw new Error('Should not write'); });
    await assert.rejects(registration.register({ ...valid(), [field]: value }), err => err.statusCode === 400 && typeof err.errors[field] === 'string');
    assert.equal(mock.mock.callCount(), 0);
  });
}
for (const extra of [{ role: 'admin' }, { role: 'manager' }, { status: 'active' }, { club_id: 1 }, { password_hash: 'unsafe' }]) {
  test('registration rejects privileged or unknown property ' + Object.keys(extra)[0] + ':' + Object.values(extra)[0], async t => {
    const mock = t.mock.method(users, 'createUser', async () => {});
    await assert.rejects(registration.register({ ...valid(), ...extra }), { statusCode: 400 });
    assert.equal(mock.mock.callCount(), 0);
  });
}
for (const body of [null, [], 'invalid']) test('registration rejects non-object ' + JSON.stringify(body), async () => {
  await assert.rejects(registration.register(body), { statusCode: 400 });
});
for (const source of [{ statusCode: 409 }, { code: 'ER_DUP_ENTRY', sqlMessage: 'internal index details' }]) {
  test('registration maps duplicate conflict safely ' + JSON.stringify(source), async t => {
    t.mock.method(users, 'createUser', async () => { throw Object.assign(new Error('internal SQL'), source); });
    await assert.rejects(registration.register(valid()), err => err.statusCode === 409 && err.errors.username && err.errors.email && !err.message.includes('SQL'));
  });
}

async function api(body, origin) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin === false ? {} : { Origin: origin || base }) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
  } finally { await new Promise(resolve => server.close(resolve)); }
}
test('public registration responds 201 without session or CSRF token', async t => {
  t.mock.method(users, 'createUser', async input => ({ id: 1, ...input, password_hash: 'must-not-return' }));
  const result = await api(valid());
  assert.equal(result.status, 201);
  assert.equal(result.body.data.user.role, 'viewer');
  assert.equal(result.cookie, null);
  assert.equal(result.body.data.csrfToken, undefined);
  assert.equal(JSON.stringify(result.body).includes('password'), false);
});
test('registration API reports field validation and duplicate status', async t => {
  assert.equal((await api({ ...valid(), confirm_password: 'wrong' })).status, 400);
  t.mock.method(users, 'createUser', async () => { throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }); });
  assert.equal((await api(valid())).status, 409);
});
test('registration API rejects cross-origin requests before writing', async t => {
  const mock = t.mock.method(users, 'createUser', async () => {});
  assert.equal((await api(valid(), 'https://untrusted.example')).status, 403);
  assert.equal(mock.mock.callCount(), 0);
});
test('production registration rejects missing Origin/Referer', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try { assert.equal((await api(valid(), false)).status, 403); }
  finally { process.env.NODE_ENV = previous; }
});

function response() {
  const res = new EventEmitter();
  res.headers = {};
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; return res; };
  return res;
}
test('registration rate limit counts successful/invalid attempts, supplies Retry-After and resets', () => {
  let time = 1000, accepted = 0;
  const limiter = createRegistrationLimiter({ now: () => time, limit: 2, windowMs: 1000 });
  const send = () => { const res = response(); limiter({ ip: 'test' }, res, () => accepted++); res.emit('close'); return res; };
  send(); send();
  assert.equal(send().statusCode, 429);
  assert.equal(accepted, 2);
  assert.equal(send().headers['Retry-After'], '1');
  time += 1001;
  send(); assert.equal(accepted, 3);
});
test('registration limiter caps concurrent hashing and releases on response close', () => {
  const limiter = createRegistrationLimiter({ maxConcurrent: 2 });
  const first = response(), second = response(), blocked = response();
  let accepted = 0;
  limiter({ ip: 'one' }, first, () => accepted++);
  limiter({ ip: 'two' }, second, () => accepted++);
  limiter({ ip: 'three' }, blocked, () => accepted++);
  assert.equal(blocked.statusCode, 429);
  first.emit('close');
  limiter({ ip: 'three' }, response(), () => accepted++);
  assert.equal(accepted, 3);
});
test('registration limiter caps tracked IPs and reclaims expired records', () => {
  let time = 1000;
  const limiter = createRegistrationLimiter({ now: () => time, maxEntries: 1, windowMs: 1000 });
  const first = response(); limiter({ ip: 'one' }, first, () => {}); first.emit('close');
  const second = response(); limiter({ ip: 'two' }, second, () => {});
  assert.equal(second.statusCode, 429);
  time += 1001;
  let accepted = false; limiter({ ip: 'two' }, response(), () => { accepted = true; });
  assert.equal(accepted, true);
});
