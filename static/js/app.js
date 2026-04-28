// Auto-dismiss flash messages after 4 seconds
document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 400); }, 4000);
});

// Mobile sidebar toggle
(function () {
  const ham = document.getElementById('hamburger');
  const closeBtn = document.getElementById('sidebar-close');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (!ham || !sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }
  ham.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
  });
})();

// Searchable device picker
document.querySelectorAll('.device-picker').forEach(picker => {
  const input = picker.querySelector('.device-picker-input');
  const hidden = picker.querySelector('input[type=hidden]');
  const dropdown = picker.querySelector('.picker-dropdown');
  const options = Array.from(picker.querySelectorAll('.picker-option'));
  let focusedIdx = -1;

  function showDropdown(query) {
    const q = query.toLowerCase();
    let visible = 0;
    focusedIdx = -1;
    options.forEach(opt => {
      const text = (opt.dataset.label || '').toLowerCase();
      const show = !q || text.includes(q);
      opt.style.display = show ? '' : 'none';
      opt.classList.remove('focused');
      if (show) visible++;
    });
    let noRes = dropdown.querySelector('.picker-no-results');
    if (visible === 0) {
      if (!noRes) { noRes = document.createElement('li'); noRes.className = 'picker-no-results'; noRes.textContent = 'No devices found'; dropdown.appendChild(noRes); }
      noRes.style.display = '';
    } else if (noRes) {
      noRes.style.display = 'none';
    }
    dropdown.classList.add('open');
  }

  function selectOption(opt) {
    hidden.value = opt.dataset.value;
    input.value = opt.querySelector('.picker-option-label').textContent;
    input.classList.add('has-value');
    dropdown.classList.remove('open');
    focusedIdx = -1;
  }

  function clearSelection() {
    hidden.value = '';
    input.classList.remove('has-value');
  }

  input.addEventListener('input', () => { clearSelection(); showDropdown(input.value); });
  input.addEventListener('focus', () => showDropdown(input.value));

  input.addEventListener('keydown', e => {
    const visible = options.filter(o => o.style.display !== 'none');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIdx = Math.min(focusedIdx + 1, visible.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIdx = Math.max(focusedIdx - 1, 0);
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      selectOption(visible[focusedIdx]);
      return;
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      return;
    }
    visible.forEach((o, i) => o.classList.toggle('focused', i === focusedIdx));
    if (focusedIdx >= 0) visible[focusedIdx].scrollIntoView({ block: 'nearest' });
  });

  options.forEach(opt => {
    opt.addEventListener('mousedown', e => { e.preventDefault(); selectOption(opt); });
  });

  document.addEventListener('click', e => {
    if (!picker.contains(e.target)) dropdown.classList.remove('open');
  });

  // Handle pre-selected value (e.g. from ?device_id= param)
  const presel = picker.querySelector('.picker-option[data-preselect]');
  if (presel) selectOption(presel);
});
