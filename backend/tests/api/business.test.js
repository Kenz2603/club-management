const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../src/app');
const pool = require('../../src/config/database');
const { createCsrfToken, hashSessionToken } = require('../../src/utils/session');
let server,base;
test.before(async()=>{server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));});
function auth(t, role) {
  assert.ok(['viewer', 'manager', 'admin'].includes(role));
  const token = `test-session-${role}`;
  const csrfSecret = `test-csrf-${role}`;
  const records = {
    clubs: { id: 1, name: 'Test club', status: 'active' },
    members: { id: 1, club_id: 1, full_name: 'Test member', status: 'active' }
  };
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM user_sessions s')) {
      assert.deepEqual(params, [hashSessionToken(token)]);
      return [[{
        session_id: 1,
        user_id: 1,
        id: 1,
        role: role,
        status: 'active',
        csrf_secret: csrfSecret,
        expires_at: new Date(Date.now() + 3600000),
        revoked_at: null,
        last_active_at: new Date(),
        username: `test_${role}`,
        email: `${role}@example.test`,
        full_name: `Test ${role}`
      }]];
    }
    if (sql.startsWith('SELECT COUNT(*) AS total FROM ')) return [[{ total: 0 }]];
    if (sql.startsWith('SELECT r.* FROM ')) return [[]];
    const insert = sql.match(/^INSERT INTO (clubs|members|activities|meetings|contributions) \(([^)]+)\) VALUES /);
    if (insert) {
      const columns = insert[2].split(', ').map(column => column.trim());
      assert.equal(columns.length, params.length);
      records[insert[1]] = { id: 2, ...Object.fromEntries(columns.map((column, index) => [column, params[index]])) };
      return [{ insertId: 2 }];
    }
    const select = sql.match(/^SELECT \* FROM (clubs|members|activities|meetings|contributions) WHERE id = \?(?: FOR UPDATE)?$/);
    if (select) {
      const row = records[select[1]];
      return [row && Number(params[0]) === row.id ? [row] : []];
    }
    assert.fail(`Unexpected mock query: ${sql}`);
  });
  return {
    Cookie: `cm_session=${token}`,
    'X-CSRF-Token': createCsrfToken(csrfSecret, 1),
    Origin: base,
    'Content-Type': 'application/json'
  };
}

const payloads = {
  'manage/clubs': { name: 'Test club' },
  members: { club_id: 1, full_name: 'Test member', email: 'member@example.test' },
  activities: { club_id: 1, title: 'Test activity', start_time: '2099-01-01 01:00:00', end_time: '2099-01-01 02:00:00' },
  meetings: { club_id: 1, title: 'Test meeting', start_time: '2099-01-01 01:00:00', end_time: '2099-01-01 02:00:00' },
  contributions: { member_id: 1, amount: '100.50', contribution_date: '2099-01-01' }
};

function assertNoBusinessWrite() {
  assert.equal(pool.query.mock.calls.filter(call => /^(INSERT INTO|UPDATE|DELETE FROM) /.test(call.arguments[0])).length, 0);
}

for (const role of ['viewer', 'manager', 'admin']) {
  test(`auth mock preserves the ${role} role through session authentication`, async t => {
    const headers = auth(t, role);
    const response = await fetch(base + '/api/auth/me', { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.user.role, role);
    assert.equal(body.data.user.username, `test_${role}`);
    assert.equal(body.data.csrfToken, headers['X-CSRF-Token']);
  });
}

for(const resource of ['manage/clubs','members','activities','meetings','contributions']) {
 test(`${resource}: unauthenticated list denied`,async()=>assert.equal((await fetch(base+'/api/'+resource)).status,401));
 test(`${resource}: unauthenticated write denied`, async () => {
   const response = await fetch(base + '/api/' + resource, {
     method: 'POST',
     headers: { Origin: base, 'Content-Type': 'application/json' },
     body: JSON.stringify(payloads[resource])
   });
   assert.equal(response.status, 401);
 });
 test(`${resource}: viewer can read`,async t=>assert.equal((await fetch(base+'/api/'+resource,{headers:auth(t,'viewer')})).status,200));
 for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
   test(`${resource}: viewer cannot ${method} with valid CSRF and Origin`, async t => {
     const suffix = method === 'POST' ? '' : method === 'PATCH' ? '/1/status' : '/1';
     const response = await fetch(base + '/api/' + resource + suffix, {
       method, headers: auth(t, 'viewer'), body: JSON.stringify(payloads[resource])
     });
     assert.equal(response.status, 403);
     assert.equal((await response.json()).message, 'Bạn không có quyền thực hiện thao tác này');
     assertNoBusinessWrite();
   });
 }
 for (const role of ['manager', 'admin']) {
   test(`${resource}: ${role} can write with valid CSRF and Origin`, async t => {
     const response = await fetch(base + '/api/' + resource, {
       method: 'POST', headers: auth(t, role), body: JSON.stringify(payloads[resource])
     });
     assert.equal(response.status, 201);
     const body = await response.json();
     assert.equal(body.success, true);
     assert.equal(body.data.id, 2);
     for (const [key, value] of Object.entries(payloads[resource])) {
       assert.equal(String(body.data[key]), String(value));
     }
     const writes = pool.query.mock.calls.filter(call => call.arguments[0].startsWith('INSERT INTO '));
     assert.equal(writes.length, 1);
   });
   test(`${resource}: ${role} bad input returns 400`, async t => {
     const response = await fetch(base + '/api/' + resource, {
       method: 'POST', headers: auth(t, role), body: '{}'
     });
     assert.equal(response.status, 400);
     assertNoBusinessWrite();
   });
   for (const csrf of ['missing', 'invalid']) {
     test(`${resource}: ${role} ${csrf} CSRF denied`, async t => {
       const headers = auth(t, role);
       if (csrf === 'missing') delete headers['X-CSRF-Token'];
       else headers['X-CSRF-Token'] = '0'.repeat(64);
       const response = await fetch(base + '/api/' + resource, {
         method: 'POST', headers, body: JSON.stringify(payloads[resource])
       });
       assert.equal(response.status, 403);
       assert.match((await response.json()).message, /CSRF/);
       assertNoBusinessWrite();
     });
   }
   for (const origin of ['missing', 'foreign']) {
     test(`${resource}: ${role} ${origin} Origin denied`, async t => {
       const headers = auth(t, role);
       if (origin === 'missing') delete headers.Origin;
       else headers.Origin = 'https://attacker.invalid';
       const response = await fetch(base + '/api/' + resource, {
         method: 'POST', headers, body: JSON.stringify(payloads[resource])
       });
       assert.equal(response.status, 403);
       assert.match((await response.json()).message, /Cross-Origin Request Blocked/);
       assertNoBusinessWrite();
     });
   }
 }
}
test('malformed session cookie returns 401 and server stays alive',async()=>{assert.equal((await fetch(base+'/api/auth/me',{headers:{Cookie:'cm_session=%ZZ'}})).status,401);assert.equal((await fetch(base+'/api/health')).status,200);});
