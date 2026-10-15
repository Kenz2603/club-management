document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const alertBox = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');

  async function checkExistingAuth() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.user) {
          if (result.data.user.role === 'admin') {
            window.location.href = 'users.html';
          } else {
            window.location.href = 'index.html';
          }
        }
      }
    } catch {}
  }

  function showError(message) {
    alertText.textContent = message;
    alertBox.classList.remove('hidden');
  }

  function hideError() {
    alertBox.classList.add('hidden');
    alertText.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang đăng nhập...';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        showError(result.message || 'Đăng nhập không thành công');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng nhập';
        return;
      }

      if (result.data && result.data.user && result.data.user.role === 'admin') {
        window.location.href = 'users.html';
      } else {
        window.location.href = 'index.html';
      }
    } catch {
      showError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng nhập';
    }
  });

  checkExistingAuth();
});
