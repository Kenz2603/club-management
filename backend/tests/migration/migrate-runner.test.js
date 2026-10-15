const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const {
  computeChecksum,
  runStatus,
  runVerify,
  runBaseline,
  runUp
} = require('../../scripts/migrate');

test.after(async () => {
  await pool.end();
});

test('computeChecksum returns consistent sha256 hash regardless of CRLF or LF', () => {
  const contentLf = 'CREATE TABLE test (\n  id INT PRIMARY KEY\n);\n';
  const contentCrlf = 'CREATE TABLE test (\r\n  id INT PRIMARY KEY\r\n);\r\n';

  const hash1 = computeChecksum(contentLf);
  const hash2 = computeChecksum(contentCrlf);

  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
});

test('runBaseline refuses to run without --confirm flag', async () => {
  const result = await runBaseline(false);
  assert.equal(result, false);
});

test('runUp refuses to run without --confirm flag', async (t) => {
  const mockConnection = {
    query: async () => [[]],
    release: () => {}
  };
  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runUp(false);
  assert.equal(result, false);
});

test('runStatus runs successfully with clean database', async (t) => {
  const mockConnection = {
    query: async (sql) => {
      if (sql.includes('information_schema.tables')) {
        return [[]];
      }
      return [[]];
    },
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runStatus();
  assert.equal(result, true);
});

test('runUp aborts when advisory lock cannot be acquired', async (t) => {
  const mockConnection = {
    query: async (sql) => {
      if (sql.includes('SELECT GET_LOCK')) {
        return [[{ lock_acquired: 0 }]];
      }
      if (sql.includes('SELECT RELEASE_LOCK')) {
        return [[{}]];
      }
      return [[]];
    },
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runUp(true);
  assert.equal(result, false);
});

test('runUp detects checksum mismatch and halts', async (t) => {
  const mockConnection = {
    query: async (sql) => {
      if (sql.includes('SELECT GET_LOCK')) {
        return [[{ lock_acquired: 1 }]];
      }
      if (sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
        return [{}];
      }
      if (sql.includes('information_schema.tables')) {
        return [[{ table_name: 'schema_migrations' }]];
      }
      if (sql.includes('SELECT version, checksum, applied_at FROM schema_migrations')) {
        return [[{
          version: '001_create_clubs.sql',
          checksum: 'tampered_or_invalid_checksum_value_00000000000000000000000000000000',
          applied_at: new Date()
        }]];
      }
      if (sql.includes('SELECT RELEASE_LOCK')) {
        return [[{}]];
      }
      return [[]];
    },
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runUp(true);
  assert.equal(result, false);
});

test('runVerify returns true when all manifest tables and columns exist', async (t) => {
  const manifest = require('../../../database/schema/baseline-001-005.json');

  const mockConnection = {
    query: async (sql, params) => {
      const tableName = params && params[0];
      if (manifest.tables[tableName]) {
        return [manifest.tables[tableName].columns.map(col => ({ column_name: col }))];
      }
      return [[]];
    },
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runVerify();
  assert.equal(result, true);
});

test('runVerify returns false when schema has drift or missing table', async (t) => {
  const mockConnection = {
    query: async () => [[]],
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runVerify();
  assert.equal(result, false);
});

test('runBaseline aborts when advisory lock cannot be acquired', async (t) => {
  let releaseCalled = false;
  let schemaMigrationsTouched = false;

  const mockConnection = {
    query: async (sql) => {
      if (sql.includes('SELECT GET_LOCK')) {
        return [[{ lockAcquired: 0 }]];
      }
      if (sql.includes('schema_migrations')) {
        schemaMigrationsTouched = true;
      }
      return [[]];
    },
    release: () => {
      releaseCalled = true;
    }
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runBaseline(true);
  assert.equal(result, false);
  assert.equal(releaseCalled, true);
  assert.equal(schemaMigrationsTouched, false);
});

test('runBaseline registers baseline migrations and releases lock when acquired', async (t) => {
  const manifest = require('../../../database/schema/baseline-001-005.json');
  let lockReleased = false;
  const queries = [];

  const mockConnection = {
    query: async (sql, params) => {
      queries.push(sql);
      if (sql.includes('information_schema.columns')) {
        const tableName = params && params[0];
        if (manifest.tables[tableName]) {
          return [manifest.tables[tableName].columns.map(col => ({ column_name: col }))];
        }
      }
      if (sql.includes('SELECT GET_LOCK')) {
        return [[{ lockAcquired: 1 }]];
      }
      if (sql.includes('SELECT RELEASE_LOCK')) {
        lockReleased = true;
        return [[{}]];
      }
      return [[]];
    },
    release: () => {}
  };

  t.mock.method(pool, 'getConnection', async () => mockConnection);

  const result = await runBaseline(true);
  assert.equal(result, true);
  assert.equal(lockReleased, true);
  assert.ok(queries.some(q => q.includes('INSERT INTO schema_migrations')));
});
