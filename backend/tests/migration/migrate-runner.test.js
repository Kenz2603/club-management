const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const { computeChecksum, runStatus, runVerify, runBaseline, runUp } = require('../../scripts/migrate');
const { manifest, verifySchema } = require('../../scripts/schema-verifier');
function schemaRows(sql, params) {
  const spec = manifest[params?.[0]];
  if (!spec) return null;
  if (sql.includes('information_schema.columns')) return [Object.entries(spec.columns).map(([name, column]) => ({name, type:column.type, nullable:column.nullable?'YES':'NO', default_value:column.default, extra:(column.auto?'auto_increment ':'')+(column.update?'on update CURRENT_TIMESTAMP':'')}))];
  if (sql.includes('information_schema.statistics')) return [Object.entries(spec.indexes).flatMap(([name,index])=>index.columns.map((column_name,i)=>({name,column_name,non_unique:index.unique?0:1,sequence:i+1})))];
  if (sql.includes('information_schema.key_column_usage')) return [spec.foreign.map(key=>({name:key.name,column_name:key.column,target_table:key.table,target_column:key.target,update_rule:key.update,delete_rule:key.delete}))];
  if (sql.includes('information_schema.check_constraints')) return [Object.entries(spec.checks).map(([name,clause])=>({name,clause,enforced:'YES'}))];
  return null;
}
function connection(t, handler = () => null) {
  const queries=[];
  const conn={query:async(sql,params)=>{queries.push(sql);const custom=handler(sql,params);if(custom)return custom;return schemaRows(sql,params)||[[]];},release:()=>{conn.released=true;}};
  t.mock.method(pool,'getConnection',async()=>conn);
  return {conn,queries};
}
test('checksum normalizes line endings',()=>assert.equal(computeChecksum('a\r\nb'),computeChecksum('a\nb')));
test('baseline requires explicit confirm',async()=>assert.equal(await runBaseline(false),false));
test('up without confirm only reads status',async t=>{const{queries}=connection(t);assert.equal(await runUp(false),false);assert.ok(queries.every(sql=>!sql.includes('CREATE TABLE')));});
test('status reads empty ledger',async t=>{connection(t);assert.equal(await runStatus(),true);});
test('up cannot write without advisory lock',async t=>{const{queries}=connection(t,sql=>sql.includes('GET_LOCK')?[[{lockAcquired:0}]]:null);assert.equal(await runUp(true),false);assert.ok(!queries.some(sql=>sql.includes('CREATE TABLE')));});
test('checksum mismatch is checked after acquiring lock',async t=>{const{queries}=connection(t,sql=>sql.includes('GET_LOCK')?[[{lockAcquired:1}]]:sql.includes('information_schema.tables')?[[{table_name:'schema_migrations'}]]:sql.includes('SELECT version, checksum')?[[{version:'001_create_clubs.sql',checksum:'invalid'}]]:null);assert.equal(await runUp(true),false);assert.ok(queries.some(sql=>sql.includes('SELECT version, checksum')));assert.ok(!queries.some(sql=>sql.startsWith('CREATE TABLE IF NOT EXISTS clubs')));});
test('strict verify accepts exact schema including keys and checks',async t=>{connection(t);assert.equal(await runVerify(true),true);});
test('strict verify rejects missing columns',async t=>{connection(t,sql=>sql.includes('information_schema.columns')?[[]]:null);assert.equal(await runVerify(),false);});
test('strict verify rejects missing unique index',async t=>{const{conn}=connection(t,sql=>sql.includes('information_schema.statistics')?[[]]:null);assert.ok((await verifySchema(conn,['users'])).some(error=>error.includes('uq_users_username')));});
test('strict verify rejects unenforced CHECK',async t=>{const{conn}=connection(t,sql=>sql.includes('information_schema.check_constraints')?[[{name:'chk_activities_time',clause:'end_time > start_time',enforced:'NO'}]]:null);assert.ok((await verifySchema(conn,['activities'])).some(error=>error.includes('check constraint')));});
test('baseline reaches lock check only after strict schema success',async t=>{const{queries}=connection(t,sql=>sql.includes('GET_LOCK')?[[{lockAcquired:0}]]:null);assert.equal(await runBaseline(true),false);assert.ok(queries.some(sql=>sql.includes('GET_LOCK')));assert.ok(!queries.some(sql=>sql.includes('INSERT INTO schema_migrations')));});
test('baseline records verified schema and releases lock',async t=>{const{conn,queries}=connection(t,sql=>sql.includes('GET_LOCK')?[[{lockAcquired:1}]]:null);assert.equal(await runBaseline(true),true);assert.equal(queries.filter(sql=>sql.includes('INSERT INTO schema_migrations')).length,5);assert.ok(queries.some(sql=>sql.includes('RELEASE_LOCK')));assert.ok(conn.released);});
