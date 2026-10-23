document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const submit = document.getElementById('register-submit');
  const alert = document.getElementById('register-alert');
  const success = document.getElementById('register-success');
  const names = ['full_name', 'email', 'username', 'password', 'confirm_password'];
  const inputs = Object.fromEntries(names.map(name => [name, document.getElementById(name)]));
  let saving = false;
  function setError(name, message = '') {
    document.getElementById('error-' + name).textContent = message;
    inputs[name].setAttribute('aria-invalid', String(Boolean(message)));
  }
  function validate(name) {
    const value = inputs[name].value;
    let message = '';
    if (name === 'full_name' && (!value.trim() || value.trim().length > 150)) message = 'Nhập họ và tên, tối đa 150 ký tự';
    if (name === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || value.trim().length > 191)) message = 'Nhập email đúng định dạng';
    if (name === 'username' && !/^[a-zA-Z0-9_-]{3,50}$/.test(value.trim())) message = 'Tên đăng nhập gồm 3–50 chữ cái, số, gạch dưới hoặc gạch ngang';
    if (name === 'password' && (value.length < 8 || value.length > 1024)) message = 'Mật khẩu phải có từ 8 đến 1024 ký tự';
    if (name === 'confirm_password' && (!value || value !== inputs.password.value)) message = 'Xác nhận mật khẩu không khớp';
    setError(name, message);
    return !message;
  }
  for (const name of names) {
    inputs[name].addEventListener('blur', () => validate(name));
    inputs[name].addEventListener('input', () => {
      if (inputs[name].getAttribute('aria-invalid') === 'true') validate(name);
      if (name === 'password' && inputs.confirm_password.value) validate('confirm_password');
    });
  }
  document.querySelectorAll('[data-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = inputs[button.dataset.password];
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ẩn' : 'Hiện';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', `${show ? 'Ẩn' : 'Hiển thị'} ${button.dataset.password === 'password' ? 'mật khẩu' : 'mật khẩu xác nhận'}`);
    });
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    alert.classList.add('hidden');
    const invalid = names.filter(name => !validate(name));
    if (invalid.length) { inputs[invalid[0]].focus(); return; }
    const body = Object.fromEntries(names.map(name => [name, inputs[name].value]));
    saving = true;
    submit.disabled = true;
    submit.textContent = 'Đang tạo tài khoản...';
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) {
        const fields = names.filter(name => typeof result.errors?.[name] === 'string');
        for (const name of fields) setError(name, result.errors[name]);
        if (fields.length) inputs[fields[0]].focus();
        throw new Error(result.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
      }
      form.reset();
      form.classList.add('hidden');
      success.textContent = 'Đăng ký thành công! Đang chuyển đến trang đăng nhập...';
      success.classList.remove('hidden');
      setTimeout(() => window.location.replace('login.html?registered=1'), 1400);
    } catch (err) {
      alert.textContent = err instanceof TypeError || err instanceof SyntaxError ? 'Không thể kết nối máy chủ. Vui lòng thử lại.' : err.message;
      alert.classList.remove('hidden');
      saving = false;
      submit.disabled = false;
      submit.textContent = 'Tạo tài khoản';
    } finally {
      form.setAttribute('aria-busy', 'false');
    }
  });
});
