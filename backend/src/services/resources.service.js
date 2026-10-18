const pool = require('../config/database');
const resources = require('../domain/resources');
const v = require('../utils/validation');
const transaction = require('../utils/transaction');

function definition(name) {
  if (!Object.hasOwn(resources, name)) v.fail('Tài nguyên không tồn tại', 404);
  return resources[name];
}

function date(value, time) {
  if (typeof value !== 'string') v.fail('Ngày giờ không hợp lệ');
  const input = value.replace('T', ' ');
  const pattern = time ? /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(input)) v.fail('Định dạng ngày giờ không hợp lệ');
  const normalized = time ? (input.length === 16 ? input + ':00' : input) : input;
  const parsed = new Date((time ? normalized.replace(' ', 'T') : normalized + 'T00:00:00') + 'Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, time ? 19 : 10).replace('T', ' ') !== normalized) v.fail('Ngày giờ không tồn tại');
  return normalized;
}

function validate(name, body, existing) {
  const spec = definition(name);
  if (!body || typeof body !== 'object' || Array.isArray(body)) v.fail('Dữ liệu phải là object');
  for (const key of Object.keys(body)) if (!Object.hasOwn(spec.fields, key)) v.fail(`Trường không được phép: ${key}`);
  const data = {};
  for (const [key, field] of Object.entries(spec.fields)) {
    let value = body[key];
    if (value === undefined) {
      if (existing) continue;
      value = field.default ?? null;
    }
    if (value === null || value === '') {
      if (field.required || field.type === 'enum') v.fail(`Thiếu ${key}`);
      data[key] = null;
      continue;
    }
    if (field.type === 'text') value = v.text(value, key, field.max);
    if (field.type === 'id') value = v.id(value, key);
    if (field.type === 'email') value = v.email(value);
    if (field.type === 'enum' && !field.values.includes(value)) v.fail(`${key} không hợp lệ`);
    if (field.type === 'date' || field.type === 'datetime') value = date(value, field.type === 'datetime');
    if (field.type === 'integer') {
      if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 4294967295) v.fail(`${key} phải là số nguyên dương`);
      value = Number(value);
    }
    if (field.type === 'money') {
      if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0) v.fail('Số tiền phải dương, tối đa 10 chữ số nguyên và 2 chữ số thập phân');
      value = String(value);
    }
    data[key] = value;
  }
  const merged = { ...existing, ...data };
  if (merged.start_time && merged.end_time && merged.end_time <= merged.start_time) v.fail('Thời gian kết thúc phải sau bắt đầu');
  if (existing && !Object.keys(data).length) v.fail('Không có trường cần cập nhật');
  return data;
}

function filters(name, query) {
  const spec = definition(name);
  const conditions = [];
  const params = [];
  if (query.q) {
    const search = v.text(query.q, 'Tìm kiếm', 200).replace(/[\\%_]/g, '\\$&');
    conditions.push('(' + spec.search.map(key => `r.${key} LIKE ?`).join(' OR ') + ')');
    params.push(...spec.search.map(() => `%${search}%`));
  }
  for (const key of ['status', 'role']) {
    if (query[key] !== undefined && spec.fields[key]) {
      if (!spec.fields[key].values.includes(query[key])) v.fail(`Bộ lọc ${key} không hợp lệ`);
      conditions.push(`r.${key} = ?`); params.push(query[key]);
    }
  }
  for (const key of ['club_id', 'member_id']) if (query[key] !== undefined) {
    if (spec.fields[key]) { conditions.push(`r.${key} = ?`); params.push(v.id(query[key], key)); }
    else if (name === 'contributions' && key === 'club_id') { conditions.push('r.member_id IN (SELECT id FROM members WHERE club_id = ?)'); params.push(v.id(query[key])); }
  }
  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

async function list(name, query = {}) {
  definition(name);
  const { page, limit } = v.page(query);
  const { where, params } = filters(name, query);
  const [count] = await pool.query(`SELECT COUNT(*) AS total FROM ${name} r ${where}`, params);
  const [rows] = await pool.query(`SELECT r.* FROM ${name} r ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  return { rows, pagination: { page, limit, total: Number(count[0].total), totalPages: Math.max(1, Math.ceil(Number(count[0].total) / limit)) } };
}

async function get(name, id, connection = pool, lock = false) {
  definition(name); v.id(id);
  const [rows] = await connection.query(`SELECT * FROM ${name} WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!rows.length) v.fail('Không tìm thấy bản ghi', 404);
  return rows[0];
}

async function save(name, body, id) {
  const spec = definition(name);
  return transaction(async connection => {
    const existing = id ? await get(name, id, connection, true) : null;
    const data = validate(name, body, existing);
    if (spec.reference) {
      const [field, table] = spec.reference;
      const parent = await get(table, data[field] ?? existing?.[field], connection, true);
      const isArchive = id && Object.keys(data).length === 1 && data.status === spec.inactive;
      if (name === 'contributions' && !isArchive) {
        const club = await get('clubs', parent.club_id, connection, true);
        if (club.status === 'inactive') v.fail('Câu lạc bộ đã ngừng hoạt động', 409);
      }
      if (parent.status === 'inactive' && !isArchive) v.fail('Không thể ghi dữ liệu vào câu lạc bộ/thành viên đã ngừng hoạt động', 409);
    }
    const keys = Object.keys(data);
    if (id) await connection.query(`UPDATE ${name} SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`, [...Object.values(data), id]);
    else {
      const [result] = await connection.query(`INSERT INTO ${name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, Object.values(data));
      id = result.insertId;
    }
    return get(name, id, connection);
  });
}

async function archive(name, id) {
  return save(name, { status: definition(name).inactive }, id);
}

async function summary(query = {}) {
  const { where, params } = filters('contributions', query);
  const [rows] = await pool.query(`SELECT r.status, COUNT(*) AS count, CAST(SUM(r.amount) AS CHAR) AS total FROM contributions r ${where} GROUP BY r.status`, params);
  return rows;
}

async function dashboard() {
  const [totals] = await pool.query(`SELECT (SELECT COUNT(*) FROM clubs) AS clubs, (SELECT COUNT(*) FROM members) AS members, (SELECT COUNT(*) FROM activities) AS activities, (SELECT COUNT(*) FROM meetings) AS meetings, (SELECT CAST(COALESCE(SUM(amount),0) AS CHAR) FROM contributions WHERE status = 'confirmed') AS confirmed_contributions`);
  const [upcoming] = await pool.query("SELECT id, club_id, title, location, start_time, end_time FROM meetings WHERE status = 'scheduled' AND start_time >= NOW() ORDER BY start_time, id LIMIT 10");
  return { ...totals[0], upcoming_meetings: upcoming };
}

module.exports = { validate, filters, list, get, save, archive, summary, dashboard };
