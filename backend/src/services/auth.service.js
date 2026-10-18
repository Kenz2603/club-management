const transaction = require('../utils/transaction');
const validation = require('../utils/validation');
const pool = require('../config/database');
const {
  generateSessionToken,
  hashSessionToken,
  generateCsrfSecret,
  createCsrfToken,
  calculateSessionExpiry
} = require('../utils/session');
const passwordUtils = require('../utils/password');
const {
  getClientIp,
  normalizeIdentifier,
  recordFailedLogin,
  recordSuccessfulLogin
} = require('../middleware/rate-limiter');

async function login(identifier, plainPassword, req) {
  const ip = getClientIp(req);
  const normalized = normalizeIdentifier(identifier);

  if (!normalized || typeof plainPassword !== 'string' || plainPassword.length === 0 || plainPassword.length > 1024 || normalized.length > 191) {
    recordFailedLogin(ip, normalized);
    const err = new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    err.statusCode = 401;
    throw err;
  }

  const [rows] = await pool.query(
    'SELECT id, username, email, password_hash, full_name, role, status FROM users WHERE username = ? OR email = ? LIMIT 1',
    [normalized, normalized]
  );

  if (rows.length === 0) {
    await passwordUtils.dummyVerifyPassword(plainPassword);
    recordFailedLogin(ip, normalized);
    const err = new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    err.statusCode = 401;
    throw err;
  }

  const { id: userId, password_hash: passwordHash, status } = rows[0];
  const isMatch = await passwordUtils.verifyPassword(plainPassword, passwordHash);

  if (!isMatch) {
    recordFailedLogin(ip, normalized);
    const err = new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    err.statusCode = 401;
    throw err;
  }

  if (status !== 'active') {
    recordFailedLogin(ip, normalized);
    const err = new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    err.statusCode = 401;
    throw err;
  }

  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const csrfSecret = generateCsrfSecret();
  const expiresAt = calculateSessionExpiry();
  const userAgent = req.headers['user-agent'] ? req.headers['user-agent'].slice(0, 255) : null;

  const result = await transaction(async (connection) => {
    const [currentRows] = await connection.query(
      'SELECT id, username, email, password_hash, full_name, role, status FROM users WHERE username = ? OR email = ? LIMIT 1 FOR UPDATE',
      [normalized, normalized]
    );
    const user = currentRows[0];
    if (!user || String(user.id) !== String(userId) || user.status !== 'active' || user.password_hash !== passwordHash) {
      recordFailedLogin(ip, normalized);
      const err = new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
      err.statusCode = 401;
      throw err;
    }

    const [sessionResult] = await connection.query(
      `INSERT INTO user_sessions (user_id, token_hash, csrf_secret, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, tokenHash, csrfSecret, ip, userAgent, expiresAt]
    );

    const sessionId = sessionResult.insertId;
    const csrfToken = createCsrfToken(csrfSecret, sessionId);

    await connection.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      sessionToken,
      csrfToken
    };
  });
  recordSuccessfulLogin(normalized);
  return result;
}

async function logout(sessionId) {
  if (!sessionId) {
    return;
  }
  await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?', [sessionId]);
}

async function changePassword(userId, currentPassword, newPassword, currentSessionId) {
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 1024) {
    const err = new Error('Mật khẩu mới phải có tối thiểu 8 ký tự');
    err.statusCode = 400;
    throw err;
  }

  validation.password(newPassword);
  return transaction(async (connection) => {
    const [rows] = await connection.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    if (!rows.length) validation.fail('Không tìm thấy người dùng', 404);
    if (!await passwordUtils.verifyPassword(currentPassword, rows[0].password_hash)) validation.fail('Mật khẩu hiện tại không chính xác');
    const hashedNew = await passwordUtils.hashPassword(newPassword);
    await connection.query('UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?', [hashedNew, userId]);
    await connection.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND id != ? AND revoked_at IS NULL', [userId, currentSessionId || 0]);
  });
}

async function cleanExpiredSessions() {
  await pool.query(
    `DELETE FROM user_sessions
     WHERE expires_at < NOW()
        OR (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 7 DAY))`
  ).catch(() => {});
}

module.exports = {
  login,
  logout,
  changePassword,
  cleanExpiredSessions
};
