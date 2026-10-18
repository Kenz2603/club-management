const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../src/app');
let server, base;
test.before(async () => { server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(resolve => server.close(resolve)); });

test('metrics contains HTTP counter without query content',async()=>{await fetch(base+'/api/health?password=DO_NOT_LOG');const response=await fetch(base+'/metrics');const text=await response.text();assert.match(text,/club_http_requests_total/);assert.ok(!text.includes('DO_NOT_LOG'));});
