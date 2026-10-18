const express = require('express');
const service = require('../services/resources.service');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { verifyCsrf } = require('../middleware/csrf');

function resourceRouter(name, legacy = false) {
  const router = express.Router();
  router.use(requireAuth);
  if (!legacy) router.get('/', async (req, res) => {
    const result = await service.list(name, req.query);
    res.json({ success: true, data: result.rows, pagination: result.pagination });
  });
  if (name === 'contributions') router.get('/summary', async (req, res) => res.json({ success: true, data: await service.summary(req.query) }));
  router.get('/:id', async (req, res) => res.json({ success: true, data: await service.get(name, req.params.id) }));
  router.use(requireRole('admin', 'manager'), verifyCsrf);
  router.post('/', async (req, res) => res.status(201).json({ success: true, data: await service.save(name, req.body) }));
  router.put('/:id', async (req, res) => res.json({ success: true, data: await service.save(name, req.body, req.params.id) }));
  router.patch('/:id/status', async (req, res) => res.json({ success: true, data: await service.save(name, { status: req.body?.status }, req.params.id) }));
  router.delete('/:id', async (req, res) => res.json({ success: true, data: await service.archive(name, req.params.id), message: 'Đã ngừng hoạt động hoặc hủy; lịch sử được giữ lại' }));
  return router;
}

module.exports = resourceRouter;
