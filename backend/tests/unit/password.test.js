const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, dummyVerifyPassword } = require('../../src/utils/password');

test('hashPassword generates valid scrypt format', async () => {
  const hash = await hashPassword('AdminPass123!');
  assert.match(hash, /^scrypt\$N=16384,r=8,p=1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
});

test('hashPassword throws when password is less than 8 characters', async () => {
  await assert.rejects(
    async () => {
      await hashPassword('short');
    },
    { message: 'Password must be a string with at least 8 characters' }
  );
});

test('verifyPassword returns true for matching password', async () => {
  const password = 'CorrectPassword999';
  const hash = await hashPassword(password);
  const isValid = await verifyPassword(password, hash);
  assert.equal(isValid, true);
});

test('verifyPassword returns false for wrong password', async () => {
  const hash = await hashPassword('OriginalPassword1');
  const isValid = await verifyPassword('WrongPassword2', hash);
  assert.equal(isValid, false);
});

test('verifyPassword returns false for invalid hash format or malformed string', async () => {
  assert.equal(await verifyPassword('password123', 'invalid-format'), false);
  assert.equal(await verifyPassword('password123', null), false);
  assert.equal(await verifyPassword(null, 'scrypt$N=16384,r=8,p=1$abc$def$'), false);
});

test('dummyVerifyPassword always returns false and executes scrypt', async () => {
  const result = await dummyVerifyPassword('randomPasswordAttempt');
  assert.equal(result, false);
});

test('hashPassword generates unique salt for repeated calls on the same password', async () => {
  const password = 'SamePasswordEveryTime123!';
  const hash1 = await hashPassword(password);
  const hash2 = await hashPassword(password);

  assert.notEqual(hash1, hash2);
  assert.equal(await verifyPassword(password, hash1), true);
  assert.equal(await verifyPassword(password, hash2), true);
});
