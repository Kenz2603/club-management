const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const pool = require('../../src/config/database');
const app = require('../../src/app');

test.after(async () => {
  await pool.end();
});

test('GET /api/health returns health status', async () => {
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(body, {
      status: 'ok',
      application: 'Club Management',
      message: 'Server is running'
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

test('GET /api/clubs returns legacy contract without pagination', async (t) => {
  let executedSql = '';

  t.mock.method(pool, 'execute', async (sql) => {
    executedSql = sql;
    return [[
      {
        id: 1,
        name: 'CLB Tin hoc',
        description: 'Cau lac bo hoc thuat',
        founded_date: '2026-01-01',
        status: 'active',
        created_at: '2026-01-01 10:00:00',
        updated_at: '2026-01-01 10:00:00'
      }
    ]];
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/clubs`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.data), true);
    assert.equal(body.pagination, undefined);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 1);
    assert.equal(body.data[0].name, 'CLB Tin hoc');
    assert.equal(body.data[0].status, 'active');
    assert.equal(executedSql, 'SELECT id, name, description, founded_date, status, created_at, updated_at FROM clubs ORDER BY id DESC');
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

test('GET /api/clubs returns 500 when database query fails', async (t) => {
  t.mock.method(pool, 'execute', async () => {
    throw new Error('Database connection failed');
  });

  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/clubs`);
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(body, {
      success: false,
      message: 'Unable to fetch clubs'
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
