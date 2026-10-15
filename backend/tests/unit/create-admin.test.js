const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const { main, parseArgs } = require('../../scripts/create-admin');

test.after(async () => {
  await pool.end();
});

test('parseArgs parses CLI flags and options', () => {
  const args = ['--username', 'admin', '--email', 'admin@example.com', '--full-name', 'Super Admin'];
  const parsed = parseArgs(args);

  assert.equal(parsed.username, 'admin');
  assert.equal(parsed.email, 'admin@example.com');
  assert.equal(parsed['full-name'], 'Super Admin');
});

test('parseArgs handles boolean flags', () => {
  const args = ['--confirm', '--verbose'];
  const parsed = parseArgs(args);

  assert.equal(parsed.confirm, true);
  assert.equal(parsed.verbose, true);
});

test('main rejects passing password via --password CLI argument and returns 1', async () => {
  const code = await main({ password: 'insecure_password' });
  assert.equal(code, 1);
});

test('main returns 1 when required arguments are missing', async () => {
  const code = await main({ username: 'admin' });
  assert.equal(code, 1);
});

test('main returns 1 on invalid username format', async () => {
  process.env.ADMIN_PASSWORD = 'ValidPassword123!';
  try {
    const code = await main({ username: 'a', email: 'valid@example.com', name: 'Valid Name' });
    assert.equal(code, 1);
  } finally {
    delete process.env.ADMIN_PASSWORD;
  }
});

test('main releases connection and closes pool on database error', async () => {
  process.env.ADMIN_PASSWORD = 'ValidPassword123!';
  let releaseCalled = false;
  let poolEnded = false;

  const mockPool = {
    getConnection: async () => ({
      query: async () => {
        throw new Error('Database connection failed');
      },
      release: () => {
        releaseCalled = true;
      }
    }),
    end: async () => {
      poolEnded = true;
    }
  };

  try {
    const code = await main(
      { username: 'validadmin', email: 'valid@example.com', name: 'Valid Admin' },
      mockPool
    );
    assert.equal(code, 1);
    assert.equal(releaseCalled, true);
    assert.equal(poolEnded, true);
  } finally {
    delete process.env.ADMIN_PASSWORD;
  }
});

test('main releases connection and closes pool on conflict error', async () => {
  process.env.ADMIN_PASSWORD = 'ValidPassword123!';
  let releaseCalled = false;
  let poolEnded = false;

  const mockPool = {
    getConnection: async () => ({
      query: async (sql) => {
        if (sql.includes('SELECT id, username, email FROM users')) {
          return [[{ id: 1, username: 'validadmin', email: 'valid@example.com' }]];
        }
        return [[]];
      },
      release: () => {
        releaseCalled = true;
      }
    }),
    end: async () => {
      poolEnded = true;
    }
  };

  try {
    const code = await main(
      { username: 'validadmin', email: 'valid@example.com', name: 'Valid Admin' },
      mockPool
    );
    assert.equal(code, 1);
    assert.equal(releaseCalled, true);
    assert.equal(poolEnded, true);
  } finally {
    delete process.env.ADMIN_PASSWORD;
  }
});

test('main creates admin and releases resources on success', async () => {
  process.env.ADMIN_PASSWORD = 'ValidPassword123!';
  let releaseCalled = false;
  let poolEnded = false;
  let insertExecuted = false;

  const mockPool = {
    getConnection: async () => ({
      query: async (sql) => {
        if (sql.includes('SELECT id, username, email FROM users')) {
          return [[]];
        }
        if (sql.includes('INSERT INTO users')) {
          insertExecuted = true;
          return [{ insertId: 10 }];
        }
        return [[]];
      },
      release: () => {
        releaseCalled = true;
      }
    }),
    end: async () => {
      poolEnded = true;
    }
  };

  try {
    const code = await main(
      { username: 'newadmin', email: 'newadmin@example.com', name: 'New Administrator' },
      mockPool
    );
    assert.equal(code, 0);
    assert.equal(insertExecuted, true);
    assert.equal(releaseCalled, true);
    assert.equal(poolEnded, true);
  } finally {
    delete process.env.ADMIN_PASSWORD;
  }
});
