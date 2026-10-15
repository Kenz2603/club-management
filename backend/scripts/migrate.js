const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pool = require('../src/config/database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');
const MANIFEST_PATH = path.resolve(__dirname, '../../database/schema/baseline-001-005.json');
const ADVISORY_LOCK_NAME = 'club_management_migrations';

function computeChecksum(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getAppliedMigrations(connection) {
  const [tables] = await connection.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "schema_migrations"'
  );
  if (tables.length === 0) {
    return new Map();
  }
  const [rows] = await connection.query('SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version ASC');
  const map = new Map();
  for (const row of rows) {
    map.set(row.version, row);
  }
  return map;
}

async function runStatus() {
  const connection = await pool.getConnection();
  try {
    const files = getMigrationFiles();
    const appliedMap = await getAppliedMigrations(connection);

    process.stdout.write('\n=== MIGRATION STATUS ===\n');
    process.stdout.write(`Database: ${process.env.MYSQL_DATABASE}\n`);
    process.stdout.write(`Total migration files found: ${files.length}\n\n`);

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = computeChecksum(content);
      const applied = appliedMap.get(file);

      if (!applied) {
        process.stdout.write(`[PENDING] ${file}\n`);
      } else if (applied.checksum !== currentChecksum) {
        process.stdout.write(`[CHECKSUM MISMATCH] ${file} (applied: ${applied.checksum.slice(0, 10)}..., current: ${currentChecksum.slice(0, 10)}...)\n`);
      } else {
        process.stdout.write(`[APPLIED] ${file} at ${applied.applied_at}\n`);
      }
    }
    process.stdout.write('\n');
    return true;
  } finally {
    connection.release();
  }
}

async function runVerify() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    process.stderr.write(`Manifest file not found: ${MANIFEST_PATH}\n`);
    return false;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const connection = await pool.getConnection();
  let hasErrors = false;

  try {
    process.stdout.write('\n=== SCHEMA VERIFICATION ===\n');
    for (const [tableName, tableSpec] of Object.entries(manifest.tables)) {
      const [columns] = await connection.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
        [tableName]
      );

      if (columns.length === 0) {
        process.stderr.write(`[MISSING TABLE] Table '${tableName}' does not exist\n`);
        hasErrors = true;
        continue;
      }

      const existingCols = new Set(columns.map(c => c.column_name || c.COLUMN_NAME));
      for (const expectedCol of tableSpec.columns) {
        if (!existingCols.has(expectedCol)) {
          process.stderr.write(`[MISSING COLUMN] Table '${tableName}' is missing column '${expectedCol}'\n`);
          hasErrors = true;
        }
      }

      if (!hasErrors) {
        process.stdout.write(`[OK] Table '${tableName}' matches manifest\n`);
      }
    }

    if (hasErrors) {
      process.stderr.write('\nSchema verification FAILED.\n');
      return false;
    }

    process.stdout.write('\nSchema verification PASSED: All baseline tables match manifest.\n');
    return true;
  } finally {
    connection.release();
  }
}

async function runBaseline(confirm) {
  if (!confirm) {
    process.stdout.write('[DRY-RUN] Missing --confirm. Use "node backend/scripts/migrate.js baseline --confirm" to apply.\n');
    return false;
  }

  const verified = await runVerify();
  if (!verified) {
    process.stderr.write('Cannot baseline: Schema verification failed.\n');
    return false;
  }

  const connection = await pool.getConnection();
  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 10) as lockAcquired', [ADVISORY_LOCK_NAME]);
    if (!lockRows[0] || lockRows[0].lockAcquired !== 1) {
      process.stderr.write('Failed to acquire advisory lock. Another operation may be running.\n');
      return false;
    }
    await ensureMigrationTable(connection);
    const appliedMap = await getAppliedMigrations(connection);

    const baselineFiles = ['001_create_clubs.sql', '002_create_members.sql', '003_create_activities.sql', '004_create_contributions.sql', '005_create_meetings.sql'];

    for (const file of baselineFiles) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      if (!fs.existsSync(filePath)) {
        process.stderr.write(`Baseline file not found: ${file}\n`);
        return false;
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const checksum = computeChecksum(content);

      if (appliedMap.has(file)) {
        process.stdout.write(`[ALREADY BASELINED] ${file}\n`);
      } else {
        await connection.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
          [file, checksum]
        );
        process.stdout.write(`[BASELINED] ${file}\n`);
      }
    }

    process.stdout.write('\nBaseline recorded successfully in schema_migrations.\n');
    return true;
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [ADVISORY_LOCK_NAME]);
    connection.release();
  }
}

function getExpectedTablesForMigration(file) {
  if (file === '006_create_users.sql') {
    return ['users'];
  }
  if (file === '007_create_user_sessions.sql') {
    return ['user_sessions'];
  }
  return [];
}

async function runUp(confirm) {
  if (!confirm) {
    process.stdout.write('[DRY-RUN] Missing --confirm. Use "node backend/scripts/migrate.js up --confirm" to apply pending migrations.\n');
    await runStatus();
    return false;
  }

  const connection = await pool.getConnection();
  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 10) as lockAcquired', [ADVISORY_LOCK_NAME]);
    if (!lockRows[0] || lockRows[0].lockAcquired !== 1) {
      process.stderr.write('Failed to acquire advisory lock. Another migration may be running.\n');
      return false;
    }

    await ensureMigrationTable(connection);
    const appliedMap = await getAppliedMigrations(connection);
    const files = getMigrationFiles();

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = computeChecksum(content);
      const applied = appliedMap.get(file);

      if (applied && applied.checksum !== currentChecksum) {
        process.stderr.write(`[ERROR] Checksum mismatch in applied migration ${file}. Migration aborted.\n`);
        return false;
      }
    }

    for (const file of files) {
      if (appliedMap.has(file)) {
        continue;
      }

      const expectedTables = getExpectedTablesForMigration(file);
      for (const expectedTable of expectedTables) {
        const [existing] = await connection.query(
          'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
          [expectedTable]
        );
        if (existing.length > 0) {
          process.stderr.write(`[CRITICAL SCHEMA DRIFT] Table '${expectedTable}' exists but migration '${file}' is not recorded. Manual resolution required.\n`);
          return false;
        }
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const checksum = computeChecksum(content);

      process.stdout.write(`Applying migration: ${file} ...\n`);
      await connection.query(content);
      await connection.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
        [file, checksum]
      );
      process.stdout.write(`Successfully applied: ${file}\n`);
    }

    process.stdout.write('\nAll pending migrations applied successfully.\n');
    return true;
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [ADVISORY_LOCK_NAME]);
    connection.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  const confirm = args.includes('--confirm');

  let success = false;
  try {
    if (command === 'status') {
      success = await runStatus();
    } else if (command === 'verify') {
      success = await runVerify();
    } else if (command === 'baseline') {
      success = await runBaseline(confirm);
    } else if (command === 'up') {
      success = await runUp(confirm);
    } else {
      process.stderr.write(`Unknown command: ${command}. Allowed commands: status, verify, baseline, up\n`);
      success = false;
    }
  } catch (err) {
    process.stderr.write(`Migration error: ${err.message}\n`);
    success = false;
  } finally {
    await pool.end();
  }

  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  computeChecksum,
  runStatus,
  runVerify,
  runBaseline,
  runUp
};
