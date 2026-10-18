const app = require('./app');
const pool = require('./config/database');
const { cleanExpiredSessions } = require('./services/auth.service');
const { logger } = require('./middleware/observability');
const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => logger('info', 'server_started'));
const cleanup = setInterval(cleanExpiredSessions, 3600000);
cleanup.unref();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  clearInterval(cleanup);
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
