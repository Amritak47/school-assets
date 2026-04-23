const VIEWS = {
  dashboard: { module: Dashboard, title: 'Dashboard', addLabel: null },
  devices: { module: Devices, title: 'Devices', addLabel: 'Add Device' },
  accessories: { module: Accessories, title: 'Accessories', addLabel: 'Add Accessory' },
  licences: { module: Licences, title: 'Licences', addLabel: 'Add Licence' },
  budget: { module: Budget, title: 'Budget & Planning', addLabel: null },
  maintenance: { module: Maintenance, title: 'Maintenance', addLabel: 'Add Record' },
  checkout: { module: Checkout, title: 'Check In / Out', addLabel: 'Check Out Device' },
  audit: { module: Audit, title: 'Term Audit', addLabel: 'Start Audit' },
  vendors: { module: Vendors, title: 'Vendors', addLabel: 'Add Vendor' },
  export: { module: Export, title: 'Backup & Export', addLabel: null },
};

const App = {
  _current: 'dashboard',

  init() {
    DB.ensureSeeded();
    initModalEvents();
    this._bindNav();
    this._bindMenu();
    this._bindAdd();
    this.navigate('dashboard');
    this.updateBadges();
    this._updateStorage();
  },

  navigate(view) {
    if (!VIEWS[view]) return;
    this._current = view;

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');

    const cfg = VIEWS[view];
    document.getElementById('page-title').textContent = cfg.title;

    const addBtn = document.getElementById('add-btn');
    if (cfg.addLabel) {
      addBtn.style.display = '';
      addBtn.querySelector('span') ? (addBtn.lastChild.textContent = ' ' + cfg.addLabel) : null;
      addBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${H.escape(cfg.addLabel)}`;
    } else {
      addBtn.style.display = 'none';
    }

    cfg.module.render();
    this._updateStorage();
  },

  _bindNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });
  },

  _bindMenu() {
    const btn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    btn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
  },

  _bindAdd() {
    document.getElementById('add-btn').addEventListener('click', () => {
      const cfg = VIEWS[this._current];
      if (cfg && cfg.module.addNew) cfg.module.addNew();
    });
  },

  updateBadges() {
    const counts = {
      devices: DB.getAll(CFG.KEYS.DEVICES).length,
      accessories: DB.getAll(CFG.KEYS.ACCESSORIES).length,
      licences: DB.getAll(CFG.KEYS.LICENCES).filter(l => H.isExpiringSoon(l.renewalDate, CFG.LICENCE_WARN_DAYS) || H.isExpired(l.renewalDate)).length,
    };

    Object.entries(counts).forEach(([key, val]) => {
      const badge = document.getElementById(`badge-${key}`);
      if (badge) {
        badge.textContent = val;
        badge.style.display = val > 0 ? '' : 'none';
      }
    });
  },

  _updateStorage() {
    const kb = DB.getSizeKB();
    const max = 5120;
    const pct = Math.min(kb / max * 100, 100);
    document.getElementById('storage-val').textContent = kb + ' KB';
    document.getElementById('storage-fill').style.width = pct + '%';
    document.getElementById('storage-fill').style.background = pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--orange)' : 'var(--accent)';
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
