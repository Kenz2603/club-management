const express = require('express');
const usersService = require('../services/users.service');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { verifyCsrf } = require('../middleware/csrf');

const legacyResponse = require('../utils/legacy-response');
const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, q, role, status } = req.query;
    const result = await usersService.listUsers({ page, limit, q, role, status });
    return res.status(200).json({
      success: true,
      data: result.users.map(legacyResponse),
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await usersService.getUserById(req.params.id);
    return res.status(200).json({
      success: true,
      data: legacyResponse(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', verifyCsrf, async (req, res, next) => {
  try {
    const newUser = await usersService.createUser(req.body || {});
    return res.status(201).json({
      success: true,
      data: legacyResponse(newUser)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', verifyCsrf, async (req, res, next) => {
  try {
    const updated = await usersService.updateUser(req.params.id, req.body || {}, req.user.id);
    return res.status(200).json({
      success: true,
      data: legacyResponse(updated)
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', verifyCsrf, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const updated = await usersService.updateUserStatus(req.params.id, status, req.user.id);
    return res.status(200).json({
      success: true,
      data: legacyResponse(updated)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reset-password', verifyCsrf, require('../middleware/sensitive-limiter'), async (req, res, next) => {
  try {
    const { new_password } = req.body || {};
    await usersService.resetUserPassword(req.params.id, new_password);
    return res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
