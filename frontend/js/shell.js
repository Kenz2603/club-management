(() => {
  const paths = {
    layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
    home: 'm3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
    dashboard: 'M3 3h7v7H3zM14 3h7v11h-7zM3 14h7v7H3zM14 18h7v3h-7z',
    clubs: 'M4 21V5l8-3 8 3v16M2 21h20M8 8h1m6 0h1M8 12h1m6 0h1M10 21v-5h4v5',
    members: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    activities: 'm13 2-3 8H4l7 12 3-8h6L13 2Z',
    meetings: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM8 14h3m3 3h3',
    contributions: 'M3 6h18v14H3V6Zm0 0V4h15M16 11h5v5h-5v-5Z',
    profile: 'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    users: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6',
    menu: 'M4 6h16M4 12h16M4 18h16',
    x: 'm6 6 12 12M6 18 18 6',
    plus: 'M12 5v14M5 12h14',
    chevronRight: 'm9 5 7 7-7 7',
    logout: 'M9 3H4v18h5M14 8l5 4-5 4M8 12h11',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z'
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', paths[name] || paths.layers);
    svg.append(path);
    return svg;
  }
  function decorate(root = document) {
    root.querySelectorAll('[data-icon]').forEach(node => {
      if (!node.querySelector('svg')) node.prepend(icon(node.dataset.icon));
    });
  }
  function mount(user, page) {
    const name = user.full_name || user.username;
    const roles = { admin: 'Quản trị viên', manager: 'Quản lý', viewer: 'Người xem' };
    document.getElementById('identity-name').textContent = name;
    document.getElementById('identity-role').textContent = roles[user.role] || user.role;
    document.getElementById('avatar').textContent = name.trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase();
    const navigation = document.getElementById('navigation');
    navigation.replaceChildren();
    const pages = { dashboard: 'Tổng quan', clubs: 'Câu lạc bộ', members: 'Thành viên', activities: 'Hoạt động', meetings: 'Lịch họp', contributions: 'Đóng góp', profile: 'Hồ sơ', ...(user.role === 'admin' ? { users: 'Tài khoản' } : {}) };
    for (const [key, label] of Object.entries(pages)) {
      const link = document.createElement('a');
      link.href = key + '.html';
      link.dataset.icon = key;
      link.append(document.createTextNode(label));
      if (key === page) link.setAttribute('aria-current', 'page');
      navigation.append(link);
    }
    decorate(navigation);
  }
  document.addEventListener('DOMContentLoaded', () => {
    const theme = document.getElementById('theme-toggle');
    function themeLabel() {
      if (!theme) return;
      const dark = document.documentElement.dataset.theme === 'dark';
      theme.replaceChildren(icon(dark ? 'sun' : 'moon'));
      theme.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    }
    themeLabel();
    theme?.addEventListener('click', () => {
      document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('club-theme', document.documentElement.dataset.theme); } catch {}
      themeLabel();
    });
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    function closeMenu() {
      document.body.classList.remove('nav-open');
      toggle?.setAttribute('aria-expanded', 'false');
      if (sidebar?.contains(document.activeElement)) toggle.focus();
    }
    toggle?.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      if (open) sidebar.querySelector('a')?.focus();
    });
    document.getElementById('sidebar-scrim')?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
      if (event.key === 'Tab' && document.body.classList.contains('nav-open')) {
        const links = [...sidebar.querySelectorAll('a, button')];
        if (event.shiftKey && document.activeElement === links[0]) { event.preventDefault(); links.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === links.at(-1)) { event.preventDefault(); links[0].focus(); }
      }
    });
    matchMedia('(min-width: 1025px)').addEventListener('change', closeMenu);
    const skip = document.createElement('a');
    skip.href = '#main';
    skip.className = 'skip-link';
    skip.textContent = 'Đến nội dung chính';
    const main = document.querySelector('main');
    if (main) { main.id = 'main'; main.tabIndex = -1; document.body.prepend(skip); }
    decorate();
    document.querySelectorAll('.table-responsive').forEach(node => { node.tabIndex = 0; node.setAttribute('aria-label', 'Bảng dữ liệu, cuộn ngang để xem thêm'); });
  });
  window.ClubUI = { icon, decorate, mount };
})();
