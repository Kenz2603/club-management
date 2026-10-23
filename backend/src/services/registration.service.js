const users = require('./users.service');
const validation = require('../utils/validation');

async function register(body) {
  const errors = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) validation.fail('Dữ liệu đăng ký không hợp lệ');
  const allowed = ['username', 'email', 'full_name', 'password', 'confirm_password'];
  if (Object.keys(body).some(key => !allowed.includes(key))) validation.fail('Chỉ được gửi thông tin đăng ký, không được chỉ định vai trò hoặc trạng thái');
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!/^[a-z0-9_-]{3,50}$/.test(username)) errors.username = 'Tên đăng nhập gồm 3–50 chữ cái, số, gạch dưới hoặc gạch ngang';
  let email, fullName;
  try { email = validation.email(body.email).toLowerCase(); } catch (err) { errors.email = err.message; }
  try { fullName = validation.text(body.full_name, 'Họ và tên', 150); } catch (err) { errors.full_name = err.message; }
  try { validation.password(body.password); } catch (err) { errors.password = err.message; }
  if (typeof body.confirm_password !== 'string' || body.confirm_password !== body.password) errors.confirm_password = 'Xác nhận mật khẩu không khớp';
  if (Object.keys(errors).length) {
    const err = new Error('Vui lòng kiểm tra thông tin đăng ký');
    err.statusCode = 400;
    err.errors = errors;
    throw err;
  }
  try {
    const user = await users.createUser({ username, email, full_name: fullName, password: body.password, role: 'viewer' });
    return { id: user.id, username: user.username, email: user.email, full_name: user.full_name, role: 'viewer' };
  } catch (err) {
    if (err.statusCode === 409 || err.code === 'ER_DUP_ENTRY') {
      const conflict = new Error('Tên đăng nhập hoặc email đã được sử dụng');
      conflict.statusCode = 409;
      conflict.errors = { username: conflict.message, email: conflict.message };
      throw conflict;
    }
    throw err;
  }
}

module.exports = { register };
