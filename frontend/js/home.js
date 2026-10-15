document.addEventListener('DOMContentLoaded', () => {
  const healthBadge = document.getElementById('system-health');
  const healthText = document.getElementById('health-text');
  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  const emptyState = document.getElementById('empty-state');
  const clubsGrid = document.getElementById('clubs-grid');
  const refreshBtn = document.getElementById('refresh-btn');
  const retryBtn = document.getElementById('retry-btn');

  async function checkHealth() {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      const data = await response.json();
      healthBadge.className = 'health-badge health-ok';
      healthText.textContent = data.message || 'Hệ thống hoạt động';
    } catch {
      healthBadge.className = 'health-badge health-error';
      healthText.textContent = 'Mất kết nối hệ thống';
    }
  }

  function renderClubs(clubs) {
    clubsGrid.textContent = '';

    if (!Array.isArray(clubs) || clubs.length === 0) {
      clubsGrid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    clubsGrid.classList.remove('hidden');

    clubs.forEach((club) => {
      const card = document.createElement('article');
      card.className = 'club-card';

      const header = document.createElement('div');
      header.className = 'club-card-header';

      const name = document.createElement('h3');
      name.className = 'club-name';
      name.textContent = club.name || 'Chưa đặt tên';

      const statusBadge = document.createElement('span');
      const isActive = club.status === 'active';
      statusBadge.className = isActive ? 'badge badge-active' : 'badge badge-inactive';
      statusBadge.textContent = isActive ? 'Hoạt động' : 'Tạm dừng';

      header.appendChild(name);
      header.appendChild(statusBadge);

      const desc = document.createElement('p');
      desc.className = 'club-desc';
      desc.textContent = club.description || 'Chưa có mô tả cho câu lạc bộ này.';

      const meta = document.createElement('div');
      meta.className = 'club-meta';

      const dateSpan = document.createElement('span');
      dateSpan.textContent = club.founded_date ? `Thành lập: ${club.founded_date}` : 'Ngày thành lập: N/A';

      const idSpan = document.createElement('span');
      idSpan.textContent = `Mã CLB: #${club.id}`;

      meta.appendChild(dateSpan);
      meta.appendChild(idSpan);

      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(meta);

      clubsGrid.appendChild(card);
    });
  }

  async function loadClubs() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    clubsGrid.classList.add('hidden');

    try {
      const response = await fetch('/api/clubs');
      if (!response.ok) {
        throw new Error('Không thể lấy danh sách câu lạc bộ');
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Lỗi dữ liệu từ máy chủ');
      }
      loadingState.classList.add('hidden');
      renderClubs(result.data);
    } catch (err) {
      loadingState.classList.add('hidden');
      errorState.classList.remove('hidden');
      errorMessage.textContent = err.message || 'Lỗi không xác định khi tải dữ liệu.';
    }
  }

  refreshBtn.addEventListener('click', () => {
    checkHealth();
    loadClubs();
  });

  retryBtn.addEventListener('click', () => {
    checkHealth();
    loadClubs();
  });

  checkHealth();
  loadClubs();
});
