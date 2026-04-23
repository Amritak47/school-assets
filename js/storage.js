const DB = {
  getAll(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  },

  getById(key, id) {
    return this.getAll(key).find(item => item.id === id) || null;
  },

  save(key, item) {
    const all = this.getAll(key);
    const idx = all.findIndex(i => i.id === item.id);
    const now = new Date().toISOString();
    const updated = { ...item, updatedAt: now };
    if (idx === -1) {
      const created = { ...updated, createdAt: now };
      localStorage.setItem(key, JSON.stringify([...all, created]));
      return created;
    }
    const next = [...all];
    next[idx] = updated;
    localStorage.setItem(key, JSON.stringify(next));
    return updated;
  },

  remove(key, id) {
    const filtered = this.getAll(key).filter(i => i.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
  },

  exportAll() {
    const data = {};
    Object.entries(CFG.KEYS).forEach(([k, v]) => {
      data[v] = this.getAll(v);
    });
    return { version: 1, exportedAt: new Date().toISOString(), data };
  },

  importAll(payload) {
    if (!payload.data) throw new Error('Invalid backup file');
    Object.entries(payload.data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
  },

  clearAll() {
    Object.values(CFG.KEYS).forEach(k => localStorage.removeItem(k));
  },

  getSizeKB() {
    let total = 0;
    Object.values(CFG.KEYS).forEach(k => {
      const v = localStorage.getItem(k);
      if (v) total += v.length;
    });
    return Math.round(total / 1024 * 10) / 10;
  },

  genId(prefix) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${prefix}-${ts}${rand}`;
  },

  genAccId(type) {
    const map = {
      'HDMI Cable': 'CBL-HDMI',
      'USB-C Cable': 'CBL-USBC',
      'USB-A Cable': 'CBL-USBA',
      'DisplayPort Cable': 'CBL-DP',
      'Power Cable': 'CBL-PWR',
      'Charging Adapter': 'CHG',
      'USB-C Charger': 'CHG-C',
      'Lightning Cable': 'CBL-LTN',
      'Docking Station': 'DOCK',
      'USB Hub': 'HUB',
      'Keyboard': 'KBD',
      'Mouse': 'MSE',
      'Webcam': 'CAM',
      'Headset': 'SET',
      'Laptop Bag': 'BAG',
      'Tablet Case': 'CASE',
      'Monitor Stand': 'STND',
    };
    const prefix = map[type] || 'ACC';
    const all = DB.getAll(CFG.KEYS.ACCESSORIES);
    const existing = all.map(a => a.autoId).filter(Boolean);
    let n = 1;
    while (existing.includes(`${prefix}-${String(n).padStart(3,'0')}`)) n++;
    return `${prefix}-${String(n).padStart(3,'0')}`;
  },

  ensureSeeded() {
    const licences = this.getAll(CFG.KEYS.LICENCES);
    if (licences.length === 0) {
      const now = new Date().toISOString();
      const seeded = CFG.SEED_LICENCES.map(l => ({ ...l, createdAt: now, updatedAt: now }));
      localStorage.setItem(CFG.KEYS.LICENCES, JSON.stringify(seeded));
    }
  }
};
