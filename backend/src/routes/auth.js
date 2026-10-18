const express = require('express');
const authService = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { loginRateLimiter } = require('../middleware/rate-limiter');
const { getSessionCookieOptions, getClearCookieOptions } = require('../utils/cookies');
const { createCsrfToken } = require('../utils/session');

const router = express.Router();

router.post('/login', loginRateLimiter, verifyCsrf, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await authService.login(username, password, req);

    res.cookie('cm_session', result.sessionToken, getSessionCookieOptions(req));

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        csrfToken: result.csrfToken
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    if (req.session && req.session.id) {
      await authService.logout(req.session.id);
    }
    res.clearCookie('cm_session', getClearCookieOptions());
    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const csrfToken = createCsrfToken(req.session.csrfSecret, req.session.id);
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
      csrfToken
    }
  });
});

router.get('/csrf', requireAuth, (req, res) => {
  const csrfToken = createCsrfToken(req.session.csrfSecret, req.session.id);
  return res.status(200).json({
    success: true,
    data: {
      csrfToken
    }
  });
});

router.put('/password', requireAuth, verifyCsrf, require('../middleware/sensitive-limiter'), async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    await authService.changePassword(req.user.id, current_password, new_password, req.session.id);
    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
