function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function id(value, name = 'ID') {
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isSafeInteger(value))) fail(`${name} không hợp lệ`);
  const text = String(value ?? '');
  if (!/^[1-9]\d{0,19}$/.test(text) || BigInt(text) > 18446744073709551615n) fail(`${name} không hợp lệ`);
  return text;
}

function text(value, name, max, optional = false) {
  if (optional && (value === null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${name} phải có từ 1 đến ${max} ký tự`);
  return value.trim();
}

function email(value) {
  const result = text(value, 'Email', 191);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Định dạng email không hợp lệ');
  return result;
}

function password(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 1024) fail('Mật khẩu phải có từ 8 đến 1024 ký tự');
  return value;
}

function page(query = {}) {
  const parse = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value))) fail('Phân trang không hợp lệ');
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) fail('Phân trang vượt giới hạn');
    return number;
  };
  return { page: parse(query.page, 1, 1000000), limit: parse(query.limit, 20, 100) };
}

module.exports = { fail, id, text, email, password, page };
