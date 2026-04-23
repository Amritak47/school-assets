const Accessories = {
  _filter: { search: '', type: '' },

  render() {
    const el = document.getElementById('view-accessories');
    el.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="acc-search" placeholder="Search by ID, type, device…" value="${H.escape(this._filter.search)}">
          </div>
          <select id="acc-type" class="filter-select">
            <option value="">All Types</option>
            ${CFG.ACCESSORY_TYPES.map(t => `<option value="${H.escape(t)}" ${this._filter.type === t ? 'selected' : ''}>${H.escape(t)}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <span class="rec-count" id="acc-count"></span>
          <button class="btn btn-ghost btn-sm" id="acc-export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>
      </div>
      <div id="acc-table-wrap"></div>
    `;

    document.getElementById('acc-search').oninput = H.debounce(e => {
      this._filter.search = e.target.value;
      this._renderTable();
    }, 200);
    document.getElementById('acc-type').onchange = e => {
      this._filter.type = e.target.value;
      this._renderTable();
    };
    document.getElementById('acc-export-btn').onclick = () => this._exportCSV();

    this._renderTable();
  },

  _filtered() {
    let rows = DB.getAll(CFG.KEYS.ACCESSORIES);
    const s = this._filter.search.toLowerCase();
    if (s) rows = rows.filter(a =>
      (a.autoId || '').toLowerCase().includes(s) ||
      (a.type || '').toLowerCase().includes(s) ||
      (a.notes || '').toLowerCase().includes(s) ||
      (a.deviceId || '').toLowerCase().includes(s)
    );
    if (this._filter.type) rows = rows.filter(a => a.type === this._filter.type);
    return rows;
  },

  _renderTable() {
    const rows = this._filtered();
    document.getElementById('acc-count').textContent = `${rows.length} item${rows.length !== 1 ? 's' : ''}`;

    const html = `
      <table class="table">
        <thead><tr>
          <th>ID</th>
          <th>Type</th>
          <th>Qty</th>
          <th>Linked Device</th>
          <th>Condition</th>
          <th>Purchase Date</th>
          <th>Notes</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.length === 0
            ? `<tr><td colspan="8" class="empty-cell">No accessories recorded</td></tr>`
            : rows.map(a => this._row(a)).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('acc-table-wrap').innerHTML = html;
  },

  _row(a) {
    const dev = a.deviceId ? DB.getById(CFG.KEYS.DEVICES, a.deviceId) : null;
    return `<tr>
      <td><strong class="mono">${H.escape(a.autoId || a.id)}</strong></td>
      <td>${H.escape(a.type)}</td>
      <td>${a.quantity || 1}</td>
      <td>${dev ? H.escape(dev.assetTag || dev.hostname || dev.deviceType) : '<span class="muted">Unlinked</span>'}</td>
      <td>${H.conditionBadge(a.condition)}</td>
      <td>${H.formatDate(a.purchaseDate)}</td>
      <td class="muted">${H.escape(a.notes || '—')}</td>
      <td class="action-cell">
        <button class="icon-btn" title="Edit" onclick="Accessories.openForm('${a.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn icon-btn-danger" title="Delete" onclick="Accessories.confirmDelete('${a.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>`;
  },

  openForm(id) {
    const a = id ? DB.getById(CFG.KEYS.ACCESSORIES, id) : {};
    const devices = DB.getAll(CFG.KEYS.DEVICES);
    const deviceOpts = devices.map(d => ({
      label: `${d.assetTag || d.hostname || d.deviceType}`,
      value: d.id
    }));

    const fields = [
      { name: 'type', label: 'Accessory Type', type: 'select', options: CFG.ACCESSORY_TYPES, value: a.type || '' },
      { name: 'quantity', label: 'Quantity', type: 'number', value: a.quantity || 1, placeholder: '1' },
      { name: 'condition', label: 'Condition', type: 'select', options: CFG.CONDITIONS, value: a.condition || 'Good' },
      { name: 'deviceId', label: 'Link to Device (optional)', type: 'select',
        options: ['— Not linked —', ...deviceOpts.map(o => o.label)],
        value: a.deviceId ? (deviceOpts.find(o => o.value === a.deviceId)?.label || '') : '',
      },
      { name: 'purchaseDate', label: 'Purchase Date', type: 'date', value: a.purchaseDate || '' },
      { name: 'purchasePrice', label: 'Purchase Price (AUD)', type: 'number', value: a.purchasePrice || '' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: a.notes || '', span2: true },
    ];

    Modal.show(id ? 'Edit Accessory' : 'Add Accessory', buildForm(fields), () => this._save(id, devices, deviceOpts), id ? 'Save Changes' : 'Add');
  },

  _save(id, devices, deviceOpts) {
    const body = document.getElementById('modal-body');
    const data = getFormData(body);

    if (!data.type || data.type === '— Not linked —') {
      if (!data.type) { Toast.show('Please select an accessory type', 'error'); return; }
    }

    const linkedLabel = data.deviceId;
    const linkedDevice = deviceOpts.find(o => o.label === linkedLabel);

    const existing = id ? DB.getById(CFG.KEYS.ACCESSORIES, id) : null;
    const autoId = existing?.autoId || DB.genAccId(data.type);

    const item = {
      ...data,
      id: id || DB.genId('ACC'),
      autoId,
      quantity: parseInt(data.quantity) || 1,
      deviceId: linkedDevice ? linkedDevice.value : '',
    };

    DB.save(CFG.KEYS.ACCESSORIES, item);
    Modal.hide();
    Toast.show(id ? 'Accessory updated' : 'Accessory added');
    this.render();
    App.updateBadges();
  },

  confirmDelete(id) {
    const a = DB.getById(CFG.KEYS.ACCESSORIES, id);
    Confirm.show('Delete Accessory', `Delete ${a ? (a.autoId || a.type) : 'this accessory'}?`, () => {
      DB.remove(CFG.KEYS.ACCESSORIES, id);
      Toast.show('Accessory deleted', 'info');
      this.render();
      App.updateBadges();
    });
  },

  addNew() {
    this.openForm(null);
  },

  _exportCSV() {
    const rows = DB.getAll(CFG.KEYS.ACCESSORIES);
    const headers = ['Auto ID','Type','Quantity','Condition','Linked Device','Purchase Date','Price','Notes'];
    const lines = [headers.map(H.csvCell).join(',')];
    rows.forEach(a => {
      const dev = a.deviceId ? DB.getById(CFG.KEYS.DEVICES, a.deviceId) : null;
      lines.push([
        a.autoId, a.type, a.quantity || 1, a.condition,
        dev ? (dev.assetTag || dev.hostname || dev.deviceType) : '',
        a.purchaseDate, a.purchasePrice, a.notes
      ].map(H.csvCell).join(','));
    });
    H.downloadFile(lines.join('\n'), 'accessories.csv', 'text/csv');
  }
};
