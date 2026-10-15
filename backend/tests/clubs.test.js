const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const pool = require('../src/config/database');

const originalExecute = pool.execute;

test('GET /api/clubs returns club list', async () => {
  pool.execute = async () => [[
    {
      id: 1,
      name: 'CLB Tin hoc',
      description: null,
      founded_date: null,
      status: 'active',
      created_at: '2026-10-15',
      updated_at: '2026-10-15'
    }
  ]];

  const app = require('../src/app');
  const server = http.createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/clubs`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].name, 'CLB Tin hoc');
  } finally {
    pool.execute = originalExecute;
    try {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    } finally {
      await pool.end();
    }
  }
});
