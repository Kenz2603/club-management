const pool = require('../config/database');
const { hashPassword } = require('../utils/password');

async function listUsers({ page = 1, limit = 20, q = '', role = '', status = '' } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];

  if (q && typeof q === 'string' && q.trim().length > 0) {
    conditions.push('(username LIKE ? OR email LIKE ? OR full_name LIKE ?)');
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (role && ['admin', 'manager', 'viewer'].includes(role)) {
    conditions.push('role = ?');
    params.push(role);
  }

  if (status && ['active', 'disabled'].includes(status)) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
  const [countResult] = await pool.query(countQuery, params);
  const total = countResult[0] ? Number(countResult[0].total) : 0;
  const totalPages = Math.ceil(total / safeLimit) || 1;

  const listQuery = `
    SELECT id, username, email, full_name, role, status, last_login_at, created_at, updated_at
    FROM users
    ${whereClause}
    ORDER BY id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;
  const [users] = await pool.query(listQuery, params);

  return {
    users,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages
    }
  };
}

async function getUserById(id) {
  const [rows] = await pool.query(
    'SELECT id, username, email, full_name, role, status, last_login_at, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) {
    const err = new Error('Không tìm thấy người dùng');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}

async function createUser({ username, email, password, full_name, role = 'viewer' }) {
  if (!username || !/^[a-zA-Z0-9_-]{3,50}$/.test(username)) {
    const err = new Error('Tên đăng nhập phải có từ 3 đến 50 ký tự, gồm chữ cái, số, gạch dưới hoặc gạch ngang');
    err.statusCode = 400;
    throw err;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Định dạng email không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    const err = new Error('Mật khẩu phải có tối thiểu 8 ký tự');
    err.statusCode = 400;
    throw err;
  }

  if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0 || full_name.length > 150) {
    const err = new Error('Họ và tên không được để trống và tối đa 150 ký tự');
    err.statusCode = 400;
    throw err;
  }

  if (!['admin', 'manager', 'viewer'].includes(role)) {
    const err = new Error('Vai trò không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  const [existing] = await pool.query(
    'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
    [username, email]
  );
  if (existing.length > 0) {
    const isUsername = existing[0].username === username;
    const err = new Error(isUsername ? 'Tên đăng nhập đã tồn tại trong hệ thống' : 'Email đã tồn tại trong hệ thống');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const [result] = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [username, email, passwordHash, full_name.trim(), role]
  );

  return getUserById(result.insertId);
}

async function updateUser(id, { full_name, email, role }, currentAdminId) {
  const targetUser = await getUserById(id);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (role && role !== targetUser.role && targetUser.role === 'admin') {
      const [lockedAdmins] = await connection.query(
        'SELECT id, role, status FROM users WHERE role = "admin" AND status = "active" FOR UPDATE'
      );
      const isTargetActiveAdmin = lockedAdmins.some(a => Number(a.id) === Number(id));
      if (isTargetActiveAdmin && lockedAdmins.length <= 1) {
        await connection.rollback();
        const err = new Error('Không thể hạ quyền quản trị viên duy nhất còn lại trong hệ thống');
        err.statusCode = 409;
        throw err;
      }
    }

    if (email && email !== targetUser.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await connection.rollback();
        const err = new Error('Định dạng email không hợp lệ');
        err.statusCode = 400;
        throw err;
      }
      const [existing] = await connection.query(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
        [email, id]
      );
      if (existing.length > 0) {
        await connection.rollback();
        const err = new Error('Email đã tồn tại trong hệ thống');
        err.statusCode = 409;
        throw err;
      }
    }

    const updatedFullName = full_name !== undefined ? full_name.trim() : targetUser.full_name;
    const updatedEmail = email !== undefined ? email.trim() : targetUser.email;
    const updatedRole = role !== undefined ? role : targetUser.role;

    if (updatedFullName.length === 0 || updatedFullName.length > 150) {
      await connection.rollback();
      const err = new Error('Họ và tên không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (!['admin', 'manager', 'viewer'].includes(updatedRole)) {
      await connection.rollback();
      const err = new Error('Vai trò không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    await connection.query(
      'UPDATE users SET full_name = ?, email = ?, role = ? WHERE id = ?',
      [updatedFullName, updatedEmail, updatedRole, id]
    );

    if (role && role !== targetUser.role) {
      await connection.query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [id]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return getUserById(id);
}

async function updateUserStatus(id, newStatus, currentAdminId) {
  if (!['active', 'disabled'].includes(newStatus)) {
    const err = new Error('Trạng thái không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  if (Number(id) === Number(currentAdminId) && newStatus === 'disabled') {
    const err = new Error('Không thể tự vô hiệu hóa tài khoản của chính mình');
    err.statusCode = 409;
    throw err;
  }

  const targetUser = await getUserById(id);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (newStatus === 'disabled' && targetUser.role === 'admin') {
      const [lockedAdmins] = await connection.query(
        'SELECT id, role, status FROM users WHERE role = "admin" AND status = "active" FOR UPDATE'
      );
      const isTargetActiveAdmin = lockedAdmins.some(a => Number(a.id) === Number(id));
      if (isTargetActiveAdmin && lockedAdmins.length <= 1) {
        await connection.rollback();
        const err = new Error('Không thể vô hiệu hóa quản trị viên duy nhất còn lại trong hệ thống');
        err.statusCode = 409;
        throw err;
      }
    }

    await connection.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);

    if (newStatus === 'disabled') {
      await connection.query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [id]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return getUserById(id);
}

async function resetUserPassword(id, newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    const err = new Error('Mật khẩu mới phải có tối thiểu 8 ký tự');
    err.statusCode = 400;
    throw err;
  }

  await getUserById(id);
  const passwordHash = await hashPassword(newPassword);

  await pool.query(
    'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?',
    [passwordHash, id]
  );

  await pool.query(
    'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [id]
  );

  return { success: true };
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword
};
