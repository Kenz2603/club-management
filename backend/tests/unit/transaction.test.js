const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/database');
const transaction = require('../../src/utils/transaction');

function setup(t) {
  const calls = [];
  const connection = {};
  for (const name of ['beginTransaction', 'commit', 'rollback']) {
    connection[name] = t.mock.fn(async () => { calls.push(name); });
  }
  connection.release = t.mock.fn(() => { calls.push('release'); });
  t.mock.method(pool, 'getConnection', async () => connection);
  return { connection, calls };
}

test('transaction commits the result and releases once', async (t) => {
  const { connection, calls } = setup(t);
  const result = { saved: true };
  assert.equal(await transaction(async (received) => {
    assert.equal(received, connection);
    calls.push('work');
    return result;
  }), result);
  assert.deepEqual(calls, ['beginTransaction', 'work', 'commit', 'release']);
});

for (const phase of ['beginTransaction', 'work', 'commit']) {
  for (const rollbackFailure of ['reject', 'throw']) {
    test(`transaction preserves ${phase} error when rollback ${rollbackFailure}s`, async (t) => {
      const { connection, calls } = setup(t);
      const original = new Error(`${phase} failed`);
      const rollbackError = new Error('rollback failed');
      if (phase !== 'work') {
        connection[phase] = t.mock.fn(async () => {
          calls.push(phase);
          throw original;
        });
      }
      const failRollback = () => {
        calls.push('rollback');
        throw rollbackError;
      };
      connection.rollback = t.mock.fn(rollbackFailure === 'reject' ? async () => failRollback() : failRollback);
      await assert.rejects(transaction(async () => {
        calls.push('work');
        if (phase === 'work') throw original;
      }), error => error === original);
      assert.equal(connection.rollback.mock.callCount(), 1);
      assert.equal(connection.release.mock.callCount(), 1);
      assert.equal(calls.at(-1), 'release');
      if (phase !== 'commit') assert.equal(connection.commit.mock.callCount(), 0);
      if (phase === 'beginTransaction') assert.ok(!calls.includes('work'));
    });
  }
}

test('transaction rolls back work errors before releasing', async (t) => {
  const { calls } = setup(t);
  const original = new Error('work failed');
  await assert.rejects(transaction(async () => {
    calls.push('work');
    throw original;
  }), error => error === original);
  assert.deepEqual(calls, ['beginTransaction', 'work', 'rollback', 'release']);
});

test('transaction preserves the original error even when rollback and release fail', async (t) => {
  const { connection } = setup(t);
  const original = new Error('work failed');
  connection.rollback = t.mock.fn(async () => { throw new Error('rollback failed'); });
  connection.release = t.mock.fn(() => { throw new Error('release failed'); });
  await assert.rejects(transaction(async () => { throw original; }), error => error === original);
  assert.equal(connection.release.mock.callCount(), 1);
});

test('transaction preserves falsy thrown values when cleanup fails', async (t) => {
  const { connection } = setup(t);
  connection.release = t.mock.fn(() => { throw new Error('release failed'); });
  let caught = false;
  try {
    await transaction(async () => { throw null; });
  } catch (error) {
    caught = true;
    assert.equal(error, null);
  }
  assert.equal(caught, true);
  assert.equal(connection.rollback.mock.callCount(), 1);
  assert.equal(connection.release.mock.callCount(), 1);
});

test('transaction surfaces release failure after a successful commit', async (t) => {
  const { connection } = setup(t);
  const releaseError = new Error('release failed');
  connection.release = t.mock.fn(() => { throw releaseError; });
  await assert.rejects(transaction(async () => 'saved'), error => error === releaseError);
  assert.equal(connection.commit.mock.callCount(), 1);
  assert.equal(connection.rollback.mock.callCount(), 0);
  assert.equal(connection.release.mock.callCount(), 1);
});

test('transaction does not run work when acquiring a connection fails', async (t) => {
  const original = new Error('acquire failed');
  t.mock.method(pool, 'getConnection', async () => { throw original; });
  const work = t.mock.fn();
  await assert.rejects(transaction(work), error => error === original);
  assert.equal(work.mock.callCount(), 0);
});
