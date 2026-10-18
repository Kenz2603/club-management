const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../../src/services/resources.service');
const { parseCookies } = require('../../src/utils/cookies');
const { verifyCsrfToken, createCsrfToken } = require('../../src/utils/session');
const v = require('../../src/utils/validation');
const examples = {
 clubs:{name:'CLB Tin học'},
 members:{club_id:'1',full_name:'Thành viên',email:'member@example.test'},
 activities:{club_id:'1',title:'Hội thảo',start_time:'2026-11-01 01:00:00',end_time:'2026-11-01 03:00:00'},
 meetings:{club_id:'1',title:'Họp',start_time:'2026-11-01 01:00:00',end_time:'2026-11-01 03:00:00'},
 contributions:{member_id:'1',amount:'100.50',contribution_date:'2026-11-01'}
};
for(const[name,data]of Object.entries(examples)) {
 test(`${name}: valid payload and defaults`,()=>assert.ok(service.validate(name,data).status));
 test(`${name}: rejects mass assignment`,()=>assert.throws(()=>service.validate(name,{...data,id:100})));
 test(`${name}: rejects array body`,()=>assert.throws(()=>service.validate(name,[])));
 test(`${name}: rejects invalid status`,()=>assert.throws(()=>service.validate(name,{...data,status:'admin'})));
 test(`${name}: rejects empty patch`,()=>assert.throws(()=>service.validate(name,{},data)));
}
for(const value of ['0','-1','1 OR 1=1','18446744073709551616',{},null]) test(`invalid id ${JSON.stringify(value)}`,()=>assert.throws(()=>v.id(value)));
for(const value of ['0','-1','10.123','1e3','10000000000']) test(`invalid amount ${value}`,()=>assert.throws(()=>service.validate('contributions',{...examples.contributions,amount:value})));
test('impossible date rejected',()=>assert.throws(()=>service.validate('contributions',{...examples.contributions,contribution_date:'2026-02-30'})));
test('partial time update uses previous start',()=>assert.throws(()=>service.validate('activities',{end_time:'2026-10-01 00:00:00'},examples.activities)));
test('query uses bound parameters and literal wildcard escape',()=>{const result=service.filters('members',{q:"%' OR 1=1 --",club_id:'1'});assert.ok(!result.where.includes('OR 1=1 --'));assert.ok(result.params[0].includes('\\%'));});
test('malformed cookies do not throw or poison prototype',()=>{assert.equal(parseCookies('cm_session=%ZZ; a=ok').a,'ok');assert.equal(parseCookies('__proto__=evil').cm_session,undefined);});
test('non ASCII csrf is rejected without throw',()=>assert.equal(verifyCsrfToken('é'.repeat(64),'secret',1),false));
test('valid csrf remains compatible',()=>assert.equal(verifyCsrfToken(createCsrfToken('secret',1),'secret',1),true));
test('pagination refuses overflow and injection',()=>{assert.throws(()=>v.page({page:'1e309'}));assert.throws(()=>v.page({limit:'1;DROP'}));});
