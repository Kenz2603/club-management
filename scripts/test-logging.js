const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const suffix = randomBytes(6).toString('hex');
const name = 'club-management-logging-test-' + suffix;
const directory = path.resolve('artifacts', name);
const root = path.resolve('.').replaceAll('\\', '/');
const containers = [];
let networkCreated = false;

function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Logging test Docker command failed');
  return result.stdout.trim();
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 75; attempt++) {
    try {
      if (await check()) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Logging runtime verification timed out');
}

function start(service, args) {
  const container = name + '-' + service;
  docker(['run', '-d', '--name', container, '--network', name, '--network-alias', service, '--label', 'club-management.disposable-logging=true', ...args]);
  containers.push(container);
  return container;
}

async function main() {
  fs.mkdirSync(path.join(directory, 'backend'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'nginx'), { recursive: true });
  const fixture = spawnSync(process.execPath, ['-e', "require('./backend/src/middleware/observability').logger('error','http_request',{request_id:'logging-test',method:'GET',route:'/api/health',status:500,password:'DO_NOT_LOG',cookie:'DO_NOT_LOG',authorization:'DO_NOT_LOG'})"], { encoding: 'utf8' });
  assert.equal(fixture.status, 0);
  assert.ok(!fixture.stdout.includes('DO_NOT_LOG'));
  fs.writeFileSync(path.join(directory, 'backend', 'fixture-json.log'), JSON.stringify({ log: fixture.stdout, stream: 'stdout', time: new Date().toISOString() }) + '\n');
  fs.writeFileSync(path.join(directory, 'nginx', 'club-management.access.log'), JSON.stringify({ method: 'GET', status: 404 }) + '\n');
  fs.writeFileSync(path.join(directory, 'nginx', 'club-management.error.log'), 'upstream error while reading /DO_NOT_LOG?token=DO_NOT_LOG\n');
  try {
    docker(['network', 'create', '--label', 'club-management.disposable-logging=true', name]);
    networkCreated = true;
    const loki = start('loki', ['--tmpfs', '/loki:uid=10001,gid=10001,size=256m', '-p', '127.0.0.1::3100', '-v', root + '/monitoring/loki/loki.yml:/etc/loki/loki.yml:ro', 'grafana/loki:3.5.5', '-config.file=/etc/loki/loki.yml']);
    const base = 'http://127.0.0.1:' + docker(['port', loki, '3100/tcp']).split(':').pop();
    await waitFor(async () => (await fetch(base + '/ready', { signal: AbortSignal.timeout(2000) })).ok);
    start('alloy', ['--tmpfs', '/var/lib/alloy:size=64m', '-v', root + '/monitoring/alloy/config.alloy:/etc/alloy/config.alloy:ro', '-v', directory.replaceAll('\\', '/') + '/backend:/var/log/club/backend:ro', '-v', directory.replaceAll('\\', '/') + '/nginx:/var/log/club/nginx:ro', 'grafana/alloy:v1.11.0', 'run', '--storage.path=/var/lib/alloy', '/etc/alloy/config.alloy']);
    async function query(logql) {
      const params = new URLSearchParams({ query: logql, start: String(BigInt(Date.now() - 600000) * 1000000n), end: String(BigInt(Date.now() + 60000) * 1000000n), limit: '100' });
      const response = await fetch(base + '/loki/api/v1/query_range?' + params, { signal: AbortSignal.timeout(3000) });
      assert.equal(response.ok, true);
      const data = await response.json();
      assert.equal(data.status, 'success');
      return data.data.result.flatMap(stream => stream.values.map(value => value[1]));
    }
    const checks = [
      ['backend errors', '{service="backend"} | json | level="error"'],
      ['HTTP 4xx and 5xx', '{service=~"backend|nginx"} | json | status >= 400'],
      ['sanitized Nginx errors', '{service="nginx",stream="error"} |= "nginx_error"']
    ];
    for (const [label, logql] of checks) {
      let lines;
      await waitFor(async () => { lines = await query(logql); return lines.length > 0; });
      assert.ok(lines.every(line => !line.includes('DO_NOT_LOG')));
      if (label === 'HTTP 4xx and 5xx') {
        await waitFor(async () => { lines = await query(logql); return lines.some(line => line.includes('404')) && lines.some(line => line.includes('500')); });
      }
      console.log('Loki/Alloy runtime: ' + label + ' PASS');
    }
  } finally {
    for (const container of containers.reverse()) docker(['rm', '-f', container]);
    if (networkCreated) docker(['network', 'rm', name]);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
