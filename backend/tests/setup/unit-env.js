process.env.MYSQL_DATABASE = 'club_test_mock';
process.env.MYSQL_USER = 'mock_user';
process.env.MYSQL_PASSWORD = 'mock_password';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = '';
process.env.COOKIE_SECURE = 'false';
process.env.TRUST_PROXY = 'false';
process.env.SESSION_TTL_HOURS = '8';
if (process.env.NODE_TEST_CONTEXT) {
const pool = require('../../src/config/database');
const blocked = async () => { throw new Error('Real database connections are prohibited in mock tests'); };
pool.query = blocked;
pool.execute = blocked;
pool.getConnection = async () => {
  if (!pool.query.mock) return blocked();
  return { query: (...args) => pool.query(...args), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
};

require('node:test').after(async () => { await pool.end(); });

}
