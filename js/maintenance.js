const Maintenance = {
  _filter: { search: '', type: '' },

  render() {
    const el = document.getElementById('view-maintenance');
    el.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="mnt-search" placeholder="Search device, technician, notes…" value="${H.escape(this._filter.search)}">
          </div>
          <select id="mnt-type" class="filter-select">
            <option value="">All Types</option>
            ${CFG.MAINTENANCE_TYPES.map(t => `<option value="${H.escape(t)}" ${this._filter.type === t ? 'selected' : ''}>${H.escape(t)}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <span class="rec-count" id="mnt-count"></span>
          <button class="btn btn-ghost btn-sm" id="mnt-export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>
      </div>
      <div id="mnt-table-wrap"></div>
    `;

    document.getElementById('mnt-search').oninput = H.debounce(e => {
      this._filter.search = e.target.value;
      this._renderTable();
    }, 200);
    document.getElementById('mnt-type').onchange = e => {
      this._filter.type = e.target.value;
      this._renderTable();
    };
    document.getElementById('mnt-export-btn').onclick = () => this._exportCSV();

    this._renderTable();
  },

  _filtered() {
    const all = DB.getAll(CFG.KEYS.MAINTENANCE);
    const s = this._filter.search.toLowerCase();
    let rows = all;
    if (s) rows = rows.filter(m => {
      const dev = m.deviceId ? DB.getById(CFG.KEYS.DEVICES, m.deviceId) : null;
      return (dev && ((dev.assetTag || '').toLowerCase().includes(s) || (dev.hostname || '').toLowerCase().includes(s))) ||
        (m.technician || '').toLowerCase().includes(s) ||
        (m.notes || '').toLowerCase().includes(s);
    });
    if (this._filter.type) rows = rows.filter(m => m.type === this._filter.type);
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  _renderTable() {
    const rows = this._filtered();
    document.getElementById('mnt-count').textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

    const html = `
      <table class="table">
        <thead><tr>
          <th>Date</th>
          <th>Device</th>
          <th>Type</th>
          <th>Technician</th>
          <th>Cost</th>
          <th>Status After</th>
          <th>Notes</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.length === 0
            ? `<tr><td colspan="8" class="empty-cell">No maintenance records found</td></tr>`
            : rows.map(m => this._row(m)).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('mnt-table-wrap').innerHTML = html;
  },

  _row(m) {
    const dev = m.deviceId ? DB.getById(CFG.KEYS.DEVICES, m.deviceId) : null;
    return `<tr>
      <td>${H.formatDate(m.date)}</td>
      <td>${dev ? `<strong>${H.escape(dev.assetTag || dev.hostname || dev.deviceType)}</strong><br><span class="muted small">${H.escape(dev.deviceType)}</span>` : '<span class="muted">Unknown</span>'}</td>
      <td>${H.escape(m.type || '—')}</td>
      <td>${H.escape(m.technician || '—')}</td>
      <td>${m.cost ? H.formatCurrency(m.cost) : '<span class="muted">—</span>'}</td>
      <td>${m.statusAfter ? H.statusBadge(m.statusAfter) : '<span class="muted">—</span>'}</td>
      <td class="muted">${H.escape(m.notes || '—')}</td>
      <td class="action-cell">
        <button class="icon-btn" title="Edit" onclick="Maintenance.openForm('${m.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn icon-btn-danger" title="Delete" onclick="Maintenance.confirmDelete('${m.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>`;
  },

  openForm(id, preDeviceId) {
    const m = id ? DB.getById(CFG.KEYS.MAINTENANCE, id) : { deviceId: preDeviceId || '' };
    const devices = DB.getAll(CFG.KEYS.DEVICES);
    const deviceOpts = devices.map(d => ({
      label: `${d.assetTag || d.hostname || d.deviceType} — ${d.deviceType}`,
      value: d.id
    }));

    const selectedDev = m.deviceId ? deviceOpts.find(o => o.value === m.deviceId) : null;

    const fields = [
      { type: 'section', label: 'Maintenance Details' },
      { name: 'deviceId', label: 'Device', type: 'select',
        options: ['— Select Device —', ...deviceOpts.map(o => o.label)],
        value: selectedDev ? selectedDev.label : ''
      },
      { name: 'date', label: 'Date', type: 'date', value: m.date || new Date().toISOString().slice(0,10) },
      { name: 'type', label: 'Maintenance Type', type: 'select', options: CFG.MAINTENANCE_TYPES, value: m.type || '' },
      { name: 'technician', label: 'Technician', value: m.technician || '', placeholder: 'Name' },
      { name: 'cost', label: 'Cost (AUD)', type: 'number', value: m.cost || '', placeholder: '0.00' },
      { name: 'statusAfter', label: 'Device Status After', type: 'select', options: ['— No Change —', ...CFG.STATUSES], value: m.statusAfter || '' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: m.notes || '', span2: true },
    ];

    Modal.show(id ? 'Edit Maintenance Record' : 'Add Maintenance Record', buildForm(fields), () => this._save(id, deviceOpts), id ? 'Save Changes' : 'Add Record');
  },

  _save(id, deviceOpts) {
    const data = getFormData(document.getElementById('modal-body'));

    const devLabel = data.deviceId;
    const linkedDevice = deviceOpts.find(o => o.label === devLabel);

    if (!linkedDevice) { Toast.show('Please select a device', 'error'); return; }

    const item = {
      ...data,
      id: id || DB.genId('MNT'),
      deviceId: linkedDevice.value,
      statusAfter: data.statusAfter === '— No Change —' ? '' : data.statusAfter
    };

    if (item.statusAfter) {
      const dev = DB.getById(CFG.KEYS.DEVICES, item.deviceId);
      if (dev) DB.save(CFG.KEYS.DEVICES, { ...dev, status: item.statusAfter });
    }

    DB.save(CFG.KEYS.MAINTENANCE, item);
    Modal.hide();
    Toast.show(id ? 'Record updated' : 'Maintenance record added');
    this.render();
  },

  confirmDelete(id) {
    Confirm.show('Delete Record', 'Delete this maintenance record?', () => {
      DB.remove(CFG.KEYS.MAINTENANCE, id);
      Toast.show('Record deleted', 'info');
      this.render();
    });
  },

  addNew() {
    this.openForm(null);
  },

  _exportCSV() {
    const rows = DB.getAll(CFG.KEYS.MAINTENANCE).sort((a,b) => new Date(b.date) - new Date(a.date));
    const headers = ['Date','Asset Tag','Device Type','Maintenance Type','Technician','Cost','Status After','Notes'];
    const lines = [headers.map(H.csvCell).join(',')];
    rows.forEach(m => {
      const dev = m.deviceId ? DB.getById(CFG.KEYS.DEVICES, m.deviceId) : null;
      lines.push([
        m.date, dev ? (dev.assetTag || dev.hostname || '') : '', dev ? dev.deviceType : '',
        m.type, m.technician, m.cost, m.statusAfter, m.notes
      ].map(H.csvCell).join(','));
    });
    H.downloadFile(lines.join('\n'), 'maintenance.csv', 'text/csv');
  }
};
