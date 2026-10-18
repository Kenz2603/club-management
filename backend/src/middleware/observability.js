const { randomUUID } = require('node:crypto');
const buckets = [0.01, 0.05, 0.1, 0.5, 1, 5];
const series = new Map();
const started = Date.now();

function logger(level, event, fields = {}) {
  const safe = {};
  for (const key of ['request_id', 'method', 'route', 'status', 'duration_ms', 'code', 'user_id']) if (fields[key] !== undefined) safe[key] = fields[key];
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...safe }) + '\n');
}

function routeName(req) {
  const path = req.originalUrl.split('?')[0];
  if (/^\/api\/(health|ready|dashboard)$/.test(path)) return path;
  if (/^\/api\/auth\/(login|logout|me|csrf|password)$/.test(path)) return path;
  if (/^\/api\/(manage\/clubs|clubs|users|members|activities|meetings|contributions)(\/[0-9]+)?(\/(status|reset-password|summary))?$/.test(path)) return path.replace(/\/[0-9]+/g, '/:id');
  return path.startsWith('/api/') ? '/api/unmatched' : 'static';
}

function observability(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/metrics') return;
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = routeName(req);
    const method = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method) ? req.method : 'OTHER';
    const key = `${method}|${route}|${res.statusCode}`;
    const value = series.get(key) || { count: 0, sum: 0, buckets: buckets.map(() => 0) };
    value.count++; value.sum += duration;
    buckets.forEach((limit, i) => { if (duration <= limit) value.buckets[i]++; });
    series.set(key, value);
    if (process.env.NODE_ENV !== 'test') logger(res.statusCode >= 500 ? 'error' : 'info', 'http_request', { request_id: req.requestId, method, route, status: res.statusCode, duration_ms: Math.round(duration * 1000) });
  });
  next();
}

function metrics(req, res) {
  const ip = req.socket.remoteAddress || '';
  if (!/^(::1|127\.|::ffff:127\.|10\.|::ffff:10\.|192\.168\.|::ffff:192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return res.sendStatus(403);
  const lines = ['# TYPE club_http_requests_total counter', '# TYPE club_http_request_duration_seconds histogram'];
  for (const [key, value] of series) {
    const [method, route, status] = key.split('|');
    const labels = `method="${method}",route="${route}",status="${status}"`;
    lines.push(`club_http_requests_total{${labels}} ${value.count}`);
    buckets.forEach((limit, i) => lines.push(`club_http_request_duration_seconds_bucket{${labels},le="${limit}"} ${value.buckets[i]}`));
    lines.push(`club_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${value.count}`, `club_http_request_duration_seconds_sum{${labels}} ${value.sum}`, `club_http_request_duration_seconds_count{${labels}} ${value.count}`);
  }
  const memory = process.memoryUsage();
  lines.push('# TYPE club_process_uptime_seconds gauge', `club_process_uptime_seconds ${(Date.now() - started) / 1000}`, '# TYPE club_process_resident_memory_bytes gauge', `club_process_resident_memory_bytes ${memory.rss}`, '# TYPE club_process_heap_used_bytes gauge', `club_process_heap_used_bytes ${memory.heapUsed}`, '# TYPE club_process_cpu_seconds_total counter', `club_process_cpu_seconds_total ${(process.cpuUsage().user + process.cpuUsage().system) / 1e6}`);
  res.type('text/plain; version=0.0.4').send(lines.join('\n') + '\n');
}

module.exports = { logger, observability, metrics };
