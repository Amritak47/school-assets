const H = {
  formatDate(str) {
    if (!str) return '—';
    try {
      const d = new Date(str);
      if (isNaN(d)) return str;
      return d.toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return str; }
  },

  formatCurrency(n) {
    if (n == null || n === '') return '—';
    return new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', minimumFractionDigits:0 }).format(Number(n));
  },

  daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / 86400000);
  },

  isExpired(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  },

  isExpiringSoon(dateStr, days) {
    if (!dateStr) return false;
    const d = this.daysUntil(dateStr);
    return d !== null && d >= 0 && d <= days;
  },

  deviceAge(purchaseDate) {
    if (!purchaseDate) return null;
    const years = (new Date() - new Date(purchaseDate)) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(years * 10) / 10;
  },

  statusBadge(status) {
    const map = {
      assigned: ['badge-blue','Assigned'],
      available: ['badge-green','Available'],
      maintenance: ['badge-orange','Maintenance'],
      retired: ['badge-gray','Retired'],
      active: ['badge-green','Active'],
      expired: ['badge-red','Expired'],
      pending: ['badge-orange','Pending Renewal'],
      out: ['badge-orange','Checked Out'],
      returned: ['badge-green','Returned'],
    };
    const [cls, label] = map[status] || ['badge-gray', status || '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  conditionBadge(condition) {
    const map = {
      New: 'badge-cyan', Excellent: 'badge-green', Good: 'badge-green',
      Fair: 'badge-orange', Poor: 'badge-red'
    };
    const cls = map[condition] || 'badge-gray';
    return `<span class="badge ${cls}">${condition || '—'}</span>`;
  },

  escape(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  csvCell(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
    return s;
  },

  downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  opts(arr, selected = '', placeholder = '— Select —') {
    const ph = placeholder ? `<option value="">${H.escape(placeholder)}</option>` : '';
    return ph + arr.map(v => `<option value="${H.escape(v)}" ${v === selected ? 'selected' : ''}>${H.escape(v)}</option>`).join('');
  },

  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  yesNo(val) {
    if (val === true || val === 'true' || val === 'yes') return '<span class="badge badge-green">Yes</span>';
    if (val === false || val === 'false' || val === 'no') return '<span class="badge badge-gray">No</span>';
    return '<span class="badge badge-gray">—</span>';
  },

  warrantyStatus(dateStr) {
    if (!dateStr) return '';
    if (this.isExpired(dateStr)) return '<span class="badge badge-red">Expired</span>';
    if (this.isExpiringSoon(dateStr, CFG.WARRANTY_WARN_DAYS)) {
      return `<span class="badge badge-orange">Expires in ${this.daysUntil(dateStr)}d</span>`;
    }
    return '<span class="badge badge-green">Valid</span>';
  }
};
