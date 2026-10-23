document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let csrfToken = '';
  let currentPage = 1;
  let currentLimit = 10;
  let searchTimeout = null;
  let modalTrigger = null;

  const userGreeting = document.getElementById('user-greeting');
  const logoutBtn = document.getElementById('logout-btn');

  const searchInput = document.getElementById('search-input');
  const filterRole = document.getElementById('filter-role');
  const filterStatus = document.getElementById('filter-status');
  const openCreateModalBtn = document.getElementById('open-create-modal-btn');

  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  const emptyState = document.getElementById('empty-state');
  const tableContainer = document.getElementById('table-container');
  const usersTbody = document.getElementById('users-tbody');
  const retryBtn = document.getElementById('retry-btn');

  const paginationBar = document.getElementById('pagination-bar');
  const paginationInfo = document.getElementById('pagination-info');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const pageCurrentIndicator = document.getElementById('page-current-indicator');
  const limitSelect = document.getElementById('limit-select');

  const userModal = document.getElementById('user-modal');
  const userModalTitle = document.getElementById('user-modal-title');
  const userForm = document.getElementById('user-form');
  const userModalAlert = document.getElementById('user-modal-alert');
  const userModalAlertText = document.getElementById('user-modal-alert-text');
  const userModalId = document.getElementById('user-modal-id');
  const userModalUsername = document.getElementById('user-modal-username');
  const userModalEmail = document.getElementById('user-modal-email');
  const userModalFullname = document.getElementById('user-modal-fullname');
  const userModalPasswordGroup = document.getElementById('user-modal-password-group');
  const userModalPassword = document.getElementById('user-modal-password');
  const userModalRole = document.getElementById('user-modal-role');
  const closeUserModal = document.getElementById('close-user-modal');
  const cancelUserModal = document.getElementById('cancel-user-modal');
  const saveUserBtn = document.getElementById('save-user-btn');

  const resetModal = document.getElementById('reset-modal');
  const resetModalTitle = document.getElementById('reset-modal-title');
  const resetForm = document.getElementById('reset-form');
  const resetModalAlert = document.getElementById('reset-modal-alert');
  const resetModalAlertText = document.getElementById('reset-modal-alert-text');
  const resetUserId = document.getElementById('reset-user-id');
  const resetNewPassword = document.getElementById('reset-new-password');
  const resetConfirmPassword = document.getElementById('reset-confirm-password');
  const closeResetModal = document.getElementById('close-reset-modal');
  const cancelResetModal = document.getElementById('cancel-reset-modal');
  const saveResetBtn = document.getElementById('save-reset-btn');

  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = type === 'error' ? 'toast toast-error' : 'toast toast-success';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        window.location.href = 'login.html';
        return;
      }
      const result = await response.json();
      if (!result.success || !result.data || !result.data.user) {
        window.location.href = 'login.html';
        return;
      }
      currentUser = result.data.user;
      csrfToken = result.data.csrfToken || '';

      if (currentUser.role !== 'admin') {
        window.location.href = 'index.html';
        return;
      }

      openCreateModalBtn.classList.remove('hidden');
      userGreeting.textContent = `${currentUser.full_name || currentUser.username} (${currentUser.role})`;
      window.ClubUI.mount(currentUser, 'users');
      loadUsers();
    } catch {
      window.location.href = 'login.html';
    }
  }

  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });
      if (!response.ok) { alert('Đăng xuất thất bại. Vui lòng thử lại.'); return; }
    } catch { alert('Không thể kết nối máy chủ.'); return; }
    {
      window.location.href = 'login.html';
    }
  });

  async function loadUsers() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    tableContainer.classList.add('hidden');
    paginationBar.classList.add('hidden');

    const q = searchInput.value.trim();
    const role = filterRole.value;
    const status = filterStatus.value;

    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(currentLimit)
    });
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (status) params.set('status', status);

    try {
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          window.location.href = 'login.html';
          return;
        }
        throw new Error('Không thể tải danh sách người dùng');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Lỗi từ máy chủ');
      }

      loadingState.classList.add('hidden');
      renderUsers(result.data, result.pagination);
    } catch (err) {
      loadingState.classList.add('hidden');
      errorState.classList.remove('hidden');
      errorMessage.textContent = err.message || 'Lỗi không xác định khi tải dữ liệu.';
    }
  }

  function renderUsers(users, pagination) {
    usersTbody.textContent = '';

    if (!Array.isArray(users) || users.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    tableContainer.classList.remove('hidden');

    users.forEach((user) => {
      const tr = document.createElement('tr');

      const tdId = document.createElement('td');
      tdId.textContent = String(user.id);

      const tdUsername = document.createElement('td');
      tdUsername.textContent = user.username;
      tdUsername.style.fontWeight = '600';

      const tdEmail = document.createElement('td');
      tdEmail.textContent = user.email;

      const tdFullname = document.createElement('td');
      tdFullname.textContent = user.full_name || '—';

      const tdRole = document.createElement('td');
      const roleBadge = document.createElement('span');
      roleBadge.className = `badge badge-${user.role}`;
      roleBadge.textContent = { admin: 'Quản trị viên', manager: 'Quản lý', viewer: 'Người xem' }[user.role] || user.role;
      tdRole.appendChild(roleBadge);

      const tdStatus = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = user.status === 'active' ? 'badge badge-active' : 'badge badge-disabled';
      statusBadge.textContent = user.status === 'active' ? 'Hoạt động' : user.status === 'disabled' ? 'Đã vô hiệu hóa' : user.status;
      tdStatus.appendChild(statusBadge);

      const tdCreatedAt = document.createElement('td');
      tdCreatedAt.textContent = user.created_at ? String(user.created_at).slice(0, 10) : '—';

      const tdActions = document.createElement('td');
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'action-buttons';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-outline btn-sm';
      editBtn.textContent = 'Sửa';
      editBtn.addEventListener('click', () => openEditModal(user));
      actionsDiv.appendChild(editBtn);

      const toggleStatusBtn = document.createElement('button');
      toggleStatusBtn.type = 'button';
      toggleStatusBtn.className = user.status === 'active' ? 'btn btn-warning btn-sm' : 'btn btn-secondary btn-sm';
      toggleStatusBtn.textContent = user.status === 'active' ? 'Khóa' : 'Kích hoạt';
      toggleStatusBtn.addEventListener('click', () => toggleUserStatus(user));
      actionsDiv.appendChild(toggleStatusBtn);

      const resetPwdBtn = document.createElement('button');
      resetPwdBtn.type = 'button';
      resetPwdBtn.className = 'btn btn-outline btn-sm';
      resetPwdBtn.textContent = 'Đặt lại MK';
      resetPwdBtn.addEventListener('click', () => openResetModal(user));
      actionsDiv.appendChild(resetPwdBtn);

      tdActions.appendChild(actionsDiv);

      tr.appendChild(tdId);
      tr.appendChild(tdUsername);
      tr.appendChild(tdEmail);
      tr.appendChild(tdFullname);
      tr.appendChild(tdRole);
      tr.appendChild(tdStatus);
      tr.appendChild(tdCreatedAt);
      tr.appendChild(tdActions);

      usersTbody.appendChild(tr);
    });

    if (pagination && pagination.totalPages > 0) {
      paginationBar.classList.remove('hidden');
      paginationInfo.textContent = `Tổng cộng ${pagination.total} tài khoản`;
      pageCurrentIndicator.textContent = `Trang ${pagination.page} / ${pagination.totalPages}`;
      prevPageBtn.disabled = pagination.page <= 1;
      nextPageBtn.disabled = pagination.page >= pagination.totalPages;
    }
  }

  function openCreateModal() {
    modalTrigger = document.activeElement;
    userModalTitle.textContent = 'Thêm tài khoản mới';
    userModalId.value = '';
    userModalUsername.value = '';
    userModalUsername.disabled = false;
    userModalEmail.value = '';
    userModalFullname.value = '';
    userModalPassword.value = '';
    userModalPassword.required = true;
    userModalPasswordGroup.classList.remove('hidden');
    userModalRole.value = 'viewer';
    userModalAlert.classList.add('hidden');
    userModalAlertText.textContent = '';
    userModal.classList.remove('hidden');
    userModalUsername.focus();
  }

  function openEditModal(user) {
    modalTrigger = document.activeElement;
    userModalTitle.textContent = `Cập nhật tài khoản #${user.id} (${user.username})`;
    userModalId.value = String(user.id);
    userModalUsername.value = user.username;
    userModalUsername.disabled = true;
    userModalEmail.value = user.email;
    userModalFullname.value = user.full_name || '';
    userModalPassword.value = '';
    userModalPassword.required = false;
    userModalPasswordGroup.classList.add('hidden');
    userModalRole.value = user.role;
    userModalAlert.classList.add('hidden');
    userModalAlertText.textContent = '';
    userModal.classList.remove('hidden');
    userModalEmail.focus();
  }

  function closeUserModalFunc() {
    userModal.classList.add('hidden');
    modalTrigger?.focus();
  }

  closeUserModal.addEventListener('click', closeUserModalFunc);
  cancelUserModal.addEventListener('click', closeUserModalFunc);
  openCreateModalBtn.addEventListener('click', openCreateModal);

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    userModalAlert.classList.add('hidden');

    const id = userModalId.value;
    const isEdit = Boolean(id);

    const email = userModalEmail.value.trim();
    const fullName = userModalFullname.value.trim();
    const role = userModalRole.value;

    saveUserBtn.disabled = true;
    saveUserBtn.textContent = 'Đang lưu...';

    try {
      let response;
      if (isEdit) {
        response = await fetch(`/api/users/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            email,
            full_name: fullName,
            role
          })
        });
      } else {
        const username = userModalUsername.value.trim();
        const password = userModalPassword.value;

        if (password.length < 8) {
          throw new Error('Mật khẩu phải có tối thiểu 8 ký tự');
        }

        response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            username,
            email,
            full_name: fullName,
            password,
            role
          })
        });
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Lưu thất bại');
      }

      closeUserModalFunc();
      showToast(isEdit ? 'Cập nhật tài khoản thành công' : 'Tạo tài khoản mới thành công');
      loadUsers();
    } catch (err) {
      userModalAlertText.textContent = err.message || 'Lỗi khi lưu thông tin';
      userModalAlert.classList.remove('hidden');
    } finally {
      saveUserBtn.disabled = false;
      saveUserBtn.textContent = 'Lưu';
    }
  });

  async function toggleUserStatus(user) {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    const actionText = nextStatus === 'active' ? 'kích hoạt lại' : 'vô hiệu hóa';

    if (!confirm(`Bạn có chắc muốn ${actionText} tài khoản "${user.username}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ status: nextStatus })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể đổi trạng thái');
      }

      showToast(`Đã ${actionText} tài khoản thành công`);
      loadUsers();
    } catch (err) {
      showToast(err.message || 'Lỗi khi đổi trạng thái', 'error');
    }
  }

  function openResetModal(user) {
    modalTrigger = document.activeElement;
    resetModalTitle.textContent = `Đặt lại mật khẩu: ${user.username}`;
    resetUserId.value = String(user.id);
    resetNewPassword.value = '';
    resetConfirmPassword.value = '';
    resetModalAlert.classList.add('hidden');
    resetModalAlertText.textContent = '';
    resetModal.classList.remove('hidden');
    resetNewPassword.focus();
  }

  function closeResetModalFunc() {
    resetModal.classList.add('hidden');
    modalTrigger?.focus();
  }

  closeResetModal.addEventListener('click', closeResetModalFunc);
  cancelResetModal.addEventListener('click', closeResetModalFunc);

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetModalAlert.classList.add('hidden');

    const id = resetUserId.value;
    const pwd = resetNewPassword.value;
    const confirmPwd = resetConfirmPassword.value;

    if (pwd.length < 8) {
      resetModalAlertText.textContent = 'Mật khẩu mới phải có tối thiểu 8 ký tự';
      resetModalAlert.classList.remove('hidden');
      return;
    }

    if (pwd !== confirmPwd) {
      resetModalAlertText.textContent = 'Xác nhận mật khẩu không khớp';
      resetModalAlert.classList.remove('hidden');
      return;
    }

    saveResetBtn.disabled = true;
    saveResetBtn.textContent = 'Đang xử lý...';

    try {
      const response = await fetch(`/api/users/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ new_password: pwd })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Đặt lại mật khẩu thất bại');
      }

      closeResetModalFunc();
      showToast('Đặt lại mật khẩu thành công. Các phiên đăng nhập cũ của tài khoản đã bị hủy.');
    } catch (err) {
      resetModalAlertText.textContent = err.message || 'Lỗi khi đặt lại mật khẩu';
      resetModalAlert.classList.remove('hidden');
    } finally {
      saveResetBtn.disabled = false;
      saveResetBtn.textContent = 'Xác nhận';
    }
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadUsers();
    }, 300);
  });

  filterRole.addEventListener('change', () => {
    currentPage = 1;
    loadUsers();
  });

  filterStatus.addEventListener('change', () => {
    currentPage = 1;
    loadUsers();
  });

  limitSelect.addEventListener('change', (e) => {
    currentLimit = parseInt(e.target.value, 10) || 10;
    currentPage = 1;
    loadUsers();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadUsers();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    currentPage += 1;
    loadUsers();
  });

  retryBtn.addEventListener('click', loadUsers);

  document.addEventListener('keydown', event => {
    const modal = [userModal, resetModal].find(node => !node.classList.contains('hidden'));
    if (!modal) return;
    if (event.key === 'Escape') {
      if (modal === userModal) closeUserModalFunc(); else closeResetModalFunc();
    }
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button, input, select')].filter(node => !node.disabled && node.type !== 'hidden' && node.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    }
  });

  checkAuth();
});
