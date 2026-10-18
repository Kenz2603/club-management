const mysql = require('mysql2/promise');

const requiredVariables = [
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD'
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000,
  queueLimit: 100,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  timezone: '+00:00',
  connectTimeout: 5000,
  enableKeepAlive: true
});

module.exports = pool;
