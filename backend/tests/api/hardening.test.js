const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../src/app');
const pool = require('../../src/config/database');
let server, base;
test.before(async () => { server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(resolve => server.close(resolve)); });

test('readiness returns 503 without a DB',async()=>assert.equal((await fetch(base+'/api/ready')).status,503));

test('readiness returns 200 when the database query succeeds', async t => {
  t.mock.method(pool, 'query', async sql => {
    assert.equal(sql, 'SELECT 1');
    return [[{ ready: 1 }]];
  });
  const response = await fetch(base + '/api/ready');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'ready' });
});
test('security headers present',async()=>{const response=await fetch(base+'/');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('x-powered-by'),null);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);});
