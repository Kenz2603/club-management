const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loginRateLimiter,
  recordFailedLogin,
  recordSuccessfulLogin,
  normalizeIdentifier,
  getClientIp,
  MAX_MAP_SIZE,
  _resetAllForTesting
} = require('../../src/middleware/rate-limiter');

test.beforeEach(() => {
  _resetAllForTesting();
});

test('normalizeIdentifier trims and converts to lowercase', () => {
  assert.equal(normalizeIdentifier('  AdminUser@example.COM  '), 'adminuser@example.com');
  assert.equal(normalizeIdentifier(''), '');
  assert.equal(normalizeIdentifier(null), '');
});

test('getClientIp retrieves IP from req.ip or fallback', () => {
  assert.equal(getClientIp({ ip: '192.168.1.10', socket: {} }), '192.168.1.10');
  assert.equal(getClientIp({ socket: { remoteAddress: '10.0.0.1' } }), '10.0.0.1');
  assert.equal(getClientIp({ socket: {} }), '127.0.0.1');
});

test('loginRateLimiter passes when within limits', () => {
  const req = {
    ip: '127.0.0.1',
    body: { username: 'user1' }
  };
  let nextCalled = false;
  const res = {
    status: () => res,
    json: () => {}
  };

  loginRateLimiter(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('loginRateLimiter blocks when account attempts reach 5', () => {
  const ip = '1.2.3.4';
  const username = 'targetuser';

  for (let i = 0; i < 5; i++) {
    recordFailedLogin(ip, username);
  }

  const req = {
    ip: '1.2.3.5',
    body: { username }
  };

  let statusCode = 0;
  let responseBody = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseBody = data;
        }
      };
    }
  };

  loginRateLimiter(req, res, () => {
    assert.fail('Should not call next when rate limited');
  });

  assert.equal(statusCode, 429);
  assert.equal(responseBody.success, false);
  assert.match(responseBody.message, /tài khoản/i);
});

test('loginRateLimiter blocks when IP attempts reach 20', () => {
  const ip = '10.20.30.40';

  for (let i = 0; i < 20; i++) {
    recordFailedLogin(ip, `different_user_${i}`);
  }

  const req = {
    ip,
    body: { username: 'any_user' }
  };

  let statusCode = 0;
  let responseBody = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseBody = data;
        }
      };
    }
  };

  loginRateLimiter(req, res, () => {
    assert.fail('Should not call next when IP rate limited');
  });

  assert.equal(statusCode, 429);
  assert.equal(responseBody.success, false);
  assert.match(responseBody.message, /địa chỉ/i);
});

test('recordSuccessfulLogin clears account attempts', () => {
  const ip = '127.0.0.1';
  const username = 'successUser';

  for (let i = 0; i < 4; i++) {
    recordFailedLogin(ip, username);
  }

  recordSuccessfulLogin(username);

  let nextCalled = false;
  loginRateLimiter(
    { ip: '127.0.0.1', body: { username } },
    { status: () => {}, json: () => {} },
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
});

test('rate limiter memory ceiling enforces MAX_MAP_SIZE and fails closed without infinite growth', () => {
  assert.equal(MAX_MAP_SIZE, 10000);

  for (let i = 0; i < MAX_MAP_SIZE; i++) {
    const octet3 = Math.floor(i / 256);
    const octet4 = i % 256;
    recordFailedLogin(`10.0.${octet3}.${octet4}`, `user_${i}`);
  }

  const overflowIp = '192.168.254.254';
  let statusCode = 0;
  let responseBody = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseBody = data;
        }
      };
    }
  };

  loginRateLimiter(
    { ip: overflowIp, body: { username: 'overflow_user' } },
    res,
    () => {
      assert.fail('Should fail closed when rate limiter memory ceiling is reached');
    }
  );

  assert.equal(statusCode, 429);
  assert.equal(responseBody.success, false);

  recordFailedLogin(overflowIp, 'overflow_user');
});

test('rate limiter handles concurrent requests cleanly', async () => {
  const username = 'concurrent_test_user';
  const ip = '172.20.0.1';

  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(new Promise((resolve) => {
      let passed = false;
      const res = {
        status: () => ({ json: () => { resolve(false); } })
      };
      loginRateLimiter({ ip, body: { username } }, res, () => {
        passed = true;
        resolve(true);
      });
    }));
  }

  const results = await Promise.all(promises);
  assert.ok(results.every(r => r === true));

  for (let i = 0; i < 5; i++) {
    recordFailedLogin(ip, username);
  }

  const blockedPromises = [];
  for (let i = 0; i < 5; i++) {
    blockedPromises.push(new Promise((resolve) => {
      let code = 0;
      const res = {
        status: (c) => {
          code = c;
          return { json: () => { resolve(code); } };
        }
      };
      loginRateLimiter({ ip, body: { username } }, res, () => {
        resolve(200);
      });
    }));
  }

  const blockedResults = await Promise.all(blockedPromises);
  assert.ok(blockedResults.every(code => code === 429));
});
