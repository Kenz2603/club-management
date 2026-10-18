const pool = require('../config/database');
const { hashSessionToken } = require('../utils/session');
const { parseCookies } = require('../utils/cookies');

const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

async function authenticate(req, res, next) {
  if (req.user !== undefined) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.cm_session;

  if (!sessionToken) {
    req.user = null;
    req.session = null;
    return next();
  }

  const tokenHash = hashSessionToken(sessionToken);

  try {
    const [rows] = await pool.query(
      `SELECT s.id as session_id, s.user_id, s.csrf_secret, s.expires_at, s.revoked_at, s.last_active_at,
              u.id, u.username, u.email, u.full_name, u.role, u.status
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      req.user = null;
      req.session = null;
      return next();
    }

    const sessionData = rows[0];

    if (sessionData.status !== 'active') {
      await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?', [sessionData.session_id]);
      req.user = null;
      req.session = null;
      return next();
    }

    req.user = {
      id: sessionData.id,
      username: sessionData.username,
      email: sessionData.email,
      full_name: sessionData.full_name,
      role: sessionData.role
    };

    req.session = {
      id: sessionData.session_id,
      csrfSecret: sessionData.csrf_secret,
      expiresAt: sessionData.expires_at
    };

    const lastActive = sessionData.last_active_at ? new Date(typeof sessionData.last_active_at === 'string' ? sessionData.last_active_at.replace(' ', 'T') + 'Z' : sessionData.last_active_at).getTime() : 0;
    if (Date.now() - lastActive > LAST_ACTIVE_THROTTLE_MS) {
      pool.query('UPDATE user_sessions SET last_active_at = NOW() WHERE id = ?', [sessionData.session_id]).catch(() => {});
    }

    next();
  } catch (error) {
    req.user = null;
    req.session = null;
    next(error);
  }
}

function requireAuth(req, res, next) {
  return authenticate(req, res, (err) => {
    if (err) {
      return next(err);
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để truy cập tài nguyên'
      });
    }
    next();
  });
}

module.exports = {
  authenticate,
  requireAuth
};
