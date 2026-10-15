const { verifyCsrfToken } = require('../utils/session');
const { isValidOrigin } = require('../utils/origin-validator');

function verifyCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  if (!isValidOrigin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Yêu cầu từ nguồn không tin cậy (Cross-Origin Request Blocked)'
    });
  }

  if (req.session && req.session.csrfSecret && req.session.id) {
    const clientToken = req.headers['x-csrf-token'];
    if (!clientToken || !verifyCsrfToken(clientToken, req.session.csrfSecret, req.session.id)) {
      return res.status(403).json({
        success: false,
        message: 'Mã xác thực CSRF không hợp lệ hoặc bị thiếu'
      });
    }
  }

  next();
}

module.exports = {
  verifyCsrf
};
