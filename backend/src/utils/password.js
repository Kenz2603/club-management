const crypto = require('node:crypto');
const util = require('node:util');

const scryptAsync = util.promisify(crypto.scrypt);

const DEFAULT_SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024
};

const DUMMY_SALT = Buffer.alloc(16, 0x42);
const DUMMY_KEY = Buffer.alloc(64, 0x42);

async function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length < 8 || plainPassword.length > 1024) {
    throw new Error('Password must be a string with at least 8 characters');
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(plainPassword, salt, 64, DEFAULT_SCRYPT_OPTIONS);

  return `scrypt$N=${DEFAULT_SCRYPT_OPTIONS.N},r=${DEFAULT_SCRYPT_OPTIONS.r},p=${DEFAULT_SCRYPT_OPTIONS.p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') {
    return false;
  }

  const paramsStr = parts[1];
  const saltHex = parts[2];
  const keyHex = parts[3];

  const paramsMatch = paramsStr.match(/^N=(\d+),r=(\d+),p=(\d+)$/);
  if (!paramsMatch) {
    return false;
  }

  const N = parseInt(paramsMatch[1], 10);
  const r = parseInt(paramsMatch[2], 10);
  const p = parseInt(paramsMatch[3], 10);

  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(keyHex, 'hex');

  if (salt.length !== 16 || expectedKey.length !== 64) {
    return false;
  }

  if (N !== DEFAULT_SCRYPT_OPTIONS.N || r !== 8 || p !== 1 || plainPassword.length > 1024) return false;
  const derivedKey = await scryptAsync(plainPassword, salt, 64, { N, r, p, maxmem: 32 * 1024 * 1024 });

  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedKey, expectedKey);
}

async function dummyVerifyPassword(plainPassword) {
  const safePassword = typeof plainPassword === 'string' ? plainPassword : 'dummy';
  const derivedKey = await scryptAsync(safePassword, DUMMY_SALT, 64, DEFAULT_SCRYPT_OPTIONS);
  crypto.timingSafeEqual(derivedKey, DUMMY_KEY);
  return false;
}

module.exports = {
  hashPassword,
  verifyPassword,
  dummyVerifyPassword
};
