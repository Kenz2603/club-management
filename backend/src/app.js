const express = require('express');
const path = require('path');
const clubsRouter = require('./routes/clubs');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const app = express();

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

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Tài nguyên API không tồn tại'
  });
});

app.use((err, req, res, next) => {
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
