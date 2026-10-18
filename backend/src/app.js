const express = require('express');
const path = require('path');
const clubsRouter = require('./routes/clubs');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const resourceRouter = require('./routes/resources');
const resourceService = require('./services/resources.service');
const { requireAuth } = require('./middleware/auth');
const pool = require('./config/database');
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});


if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 'loopback');
} else if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== 'false') {
  app.set('trust proxy', process.env.TRUST_PROXY);
} else {
  app.set('trust proxy', false);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    application: 'Club Management',
    message: 'Server is running'
  });
});

app.use('/api/clubs', clubsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clubs', resourceRouter('clubs', true));
app.use('/api/manage/clubs', resourceRouter('clubs'));
for (const name of ['members', 'activities', 'meetings', 'contributions']) app.use(`/api/${name}`, resourceRouter(name));
app.get('/api/catalog', requireAuth, (req, res) => res.json({ success: true, data: require('./domain/resources') }));
app.get('/api/dashboard', requireAuth, async (req, res) => res.json({ success: true, data: await resourceService.dashboard() }));

app.get('/api/ready', async (req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'ready' }); } catch { res.status(503).json({ status: 'unavailable', database: 'unavailable' }); }
});

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Tài nguyên API không tồn tại'
  });
});

app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') { err.statusCode = 409; err.message = 'Dữ liệu đã tồn tại'; }
  if (['ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2'].includes(err.code)) { err.statusCode = 409; err.message = 'Dữ liệu liên kết không hợp lệ'; }
  if (['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DATA_TOO_LONG', 'ER_TRUNCATED_WRONG_VALUE'].includes(err.code)) { err.statusCode = 400; err.message = 'Dữ liệu vượt giới hạn hoặc không hợp lệ'; }
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(err.code)) { err.statusCode = 409; err.message = 'Dữ liệu đang được cập nhật đồng thời. Vui lòng kiểm tra và thử lại.'; }
  const statusNum = err.status || err.statusCode;
  const status = Number.isInteger(statusNum) && statusNum >= 400 && statusNum < 600 ? statusNum : 500;
  const message = status === 500 && process.env.NODE_ENV === 'production'
    ? 'Đã xảy ra lỗi hệ thống'
    : (err.message || 'Đã xảy ra lỗi hệ thống');

  const responseBody = {
    success: false,
    message
  };

  if (err.errors && typeof err.errors === 'object') {
    responseBody.errors = err.errors;
  }

  res.status(status).json(responseBody);
});

module.exports = app;
