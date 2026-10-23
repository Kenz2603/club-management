(() => {
  let preference;
  try { preference = localStorage.getItem('club-theme'); } catch {}
  document.documentElement.dataset.theme = preference === 'dark' || (!preference && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
})();
