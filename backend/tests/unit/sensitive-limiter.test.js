const test = require('node:test');
const assert = require('node:assert/strict');
const limiter = require('../../src/middleware/sensitive-limiter');
test('password operations are capped per user', () => {
 let allowed=0,status=0;
 const res={setHeader:()=>{},status:code=>{status=code;return{json:()=>{}};}};
 for(let i=0;i<11;i++) limiter({user:{id:'limiter-test-user'}},res,()=>allowed++);
 assert.equal(allowed,10); assert.equal(status,429);
 limiter({user:{id:'other-test-user'}},res,()=>allowed++);
 assert.equal(allowed,11);
});
