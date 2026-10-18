const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const mysql = require('mysql2/promise');
const { verifySchema } = require('../backend/scripts/schema-verifier');

const suffix = randomBytes(6).toString('hex');
const source = `club-management-backup-test-${suffix}-mysql`;
const target = `club-management-restore-${suffix}`;
const password = randomBytes(24).toString('hex');
const directory = path.resolve('artifacts', 'backup-test-' + suffix);
const env = { ...process.env, MYSQL_DATABASE: 'club_management_test', MYSQL_USER: 'club_backup_test', MYSQL_PASSWORD: password, MYSQL_ROOT_PASSWORD: password, DB_HOST: '127.0.0.1' };
const created = [];
const bash = process.env.BASH_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');

function docker(args) {
  const result = spawnSync('docker', args, { env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Backup test Docker command failed');
  return result.stdout.trim();
}

function script(file, variables, succeeds = true) {
  const result = spawnSync(bash, [file], { env: { ...env, ...variables }, encoding: 'utf8' });
  assert.equal(result.status === 0, succeeds, `Unexpected exit status for ${file}`);
}

async function start(name, restore = false) {
  docker(['run', '-d', '--name', name, '--label', 'club-management.disposable-backup=true', ...(restore ? ['--label', 'club-management.restore-test=true'] : []), '--tmpfs', '/var/lib/mysql:rw,size=768m', '-p', '127.0.0.1::3306', '-e', 'MYSQL_DATABASE', '-e', 'MYSQL_USER', '-e', 'MYSQL_PASSWORD', '-e', 'MYSQL_ROOT_PASSWORD', 'mysql:8.4']);
  created.push(name);
  const port = Number(docker(['port', name, '3306/tcp']).split(':').pop());
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const connection = await mysql.createConnection({ host: '127.0.0.1', port, user: env.MYSQL_USER, password, database: env.MYSQL_DATABASE });
      return { connection, port };
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Disposable backup database did not become ready');
}

async function main() {
  fs.mkdirSync(directory, { recursive: true });
  let sourceConnection, targetConnection;
  try {
    const origin = await start(source);
    sourceConnection = origin.connection;
    const migrated = spawnSync(process.execPath, ['backend/scripts/migrate.js', 'up', '--confirm'], { env: { ...env, DB_PORT: String(origin.port) }, encoding: 'utf8' });
    assert.equal(migrated.status, 0, 'Isolated backup source migrations failed');
    await sourceConnection.query('INSERT INTO clubs (name) VALUES (?), (?)', ['Backup fixture one', 'Backup fixture two']);
    const restored = await start(target, true);
    targetConnection = restored.connection;
    script('scripts/backup.sh', { MYSQL_CONTAINER: source, BACKUP_DIR: directory.replaceAll('\\', '/') });
    const files = fs.readdirSync(directory).filter(name => name.endsWith('.sql'));
    assert.equal(files.length, 1);
    const backup = path.join(directory, files[0]).replaceAll('\\', '/');
    const variables = { RESTORE_CONTAINER: target, BACKUP_FILE: backup, CONFIRM_RESTORE: target };
    script('scripts/restore-test.sh', { ...variables, CONFIRM_RESTORE: 'wrong-target' }, false);
    console.log('Backup safety: mismatched confirmation rejected PASS');
    const contents = fs.readFileSync(backup);
    fs.appendFileSync(backup, '\nSELECT 1;\n');
    script('scripts/restore-test.sh', variables, false);
    fs.writeFileSync(backup, contents);
    console.log('Backup safety: modified dump rejected by checksum PASS');
    script('scripts/restore-test.sh', variables);
    assert.deepEqual(await verifySchema(targetConnection), []);
    const [rows] = await targetConnection.query('SELECT name FROM clubs ORDER BY id');
    assert.deepEqual(rows.map(row => row.name), ['Backup fixture one', 'Backup fixture two']);
    const [ledger] = await targetConnection.query('SELECT COUNT(*) AS total FROM schema_migrations');
    assert.equal(Number(ledger[0].total), 7);
    console.log('Backup runtime: dump, restore, seven-table schema, ledger and data PASS');
    script('scripts/restore-test.sh', variables, false);
    assert.equal(Number((await targetConnection.query('SELECT COUNT(*) AS total FROM clubs'))[0][0].total), 2);
    console.log('Backup safety: nonempty restore target rejected PASS');
  } finally {
    await Promise.allSettled([sourceConnection?.end(), targetConnection?.end()]);
    for (const name of created.reverse()) {
      const label = docker(['inspect', '--format', '{{index .Config.Labels "club-management.disposable-backup"}}', name]);
      if (label === 'true') docker(['rm', '-f', name]);
    }
  }
}

main().catch(() => { console.error('Isolated backup/restore verification FAILED'); process.exitCode = 1; });
