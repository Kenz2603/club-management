const test = require('node:test');
const assert = require('node:assert/strict');
const legacyResponse = require('../../src/utils/legacy-response');
test('legacy dates retain ISO serialization and numeric IDs',()=>{
 const result=legacyResponse({id:1,founded_date:'2026-01-01',created_at:'2026-01-01 00:00:00',last_login_at:null});
 assert.equal(result.id,1);assert.equal(result.founded_date,'2026-01-01T00:00:00.000Z');assert.equal(result.created_at,'2026-01-01T00:00:00.000Z');assert.equal(result.last_login_at,null);
});
