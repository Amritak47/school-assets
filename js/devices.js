const Devices = {
  _filter: { search: '', type: '', status: '', condition: '' },
  _sort: { col: 'assetTag', dir: 1 },

  render() {
    const el = document.getElementById('view-devices');
    el.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="dev-search" placeholder="Search asset tag, serial, hostname, user…" value="${H.escape(this._filter.search)}">
          </div>
          <select id="dev-type" class="filter-select">
            <option value="">All Types</option>
            ${CFG.DEVICE_TYPES.map(t => `<option value="${H.escape(t)}" ${this._filter.type === t ? 'selected' : ''}>${H.escape(t)}</option>`).join('')}
          </select>
          <select id="dev-status" class="filter-select">
            <option value="">All Statuses</option>
            ${CFG.STATUSES.map(s => `<option value="${s}" ${this._filter.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
          </select>
          <select id="dev-cond" class="filter-select">
            <option value="">All Conditions</option>
            ${CFG.CONDITIONS.map(c => `<option value="${c}" ${this._filter.condition === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <span class="rec-count" id="dev-count"></span>
          <button class="btn btn-ghost btn-sm" id="dev-export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>
      </div>
      <div id="dev-table-wrap"></div>
    `;

    this._bindFilters();
    this._renderTable();
  },

  _bindFilters() {
    const search = document.getElementById('dev-search');
    const type = document.getElementById('dev-type');
    const status = document.getElementById('dev-status');
    const cond = document.getElementById('dev-cond');

    const refresh = H.debounce(() => this._renderTable(), 200);
    search.oninput = () => { this._filter.search = search.value; refresh(); };
    type.onchange = () => { this._filter.type = type.value; this._renderTable(); };
    status.onchange = () => { this._filter.status = status.value; this._renderTable(); };
    cond.onchange = () => { this._filter.condition = cond.value; this._renderTable(); };

    document.getElementById('dev-export-btn').onclick = () => this._exportCSV();
  },

  _filtered() {
    let rows = DB.getAll(CFG.KEYS.DEVICES);
    const s = this._filter.search.toLowerCase();
    if (s) rows = rows.filter(d =>
      (d.assetTag || '').toLowerCase().includes(s) ||
      (d.serialNumber || '').toLowerCase().includes(s) ||
      (d.hostname || '').toLowerCase().includes(s) ||
      (d.assignedTo || '').toLowerCase().includes(s) ||
      (d.make || '').toLowerCase().includes(s) ||
      (d.model || '').toLowerCase().includes(s)
    );
    if (this._filter.type) rows = rows.filter(d => d.deviceType === this._filter.type);
    if (this._filter.status) rows = rows.filter(d => d.status === this._filter.status);
    if (this._filter.condition) rows = rows.filter(d => d.condition === this._filter.condition);

    const { col, dir } = this._sort;
    rows = [...rows].sort((a, b) => {
      const av = (a[col] || '').toString().toLowerCase();
      const bv = (b[col] || '').toString().toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return rows;
  },

  _renderTable() {
    const rows = this._filtered();
    document.getElementById('dev-count').textContent = `${rows.length} device${rows.length !== 1 ? 's' : ''}`;

    const cols = [
      { key: 'assetTag', label: 'Asset Tag' },
      { key: 'deviceType', label: 'Type' },
      { key: 'make', label: 'Make / Model' },
      { key: 'assignedTo', label: 'Assigned To' },
      { key: 'status', label: 'Status' },
      { key: 'condition', label: 'Condition' },
      { key: 'warrantyExpiry', label: 'Warranty' },
    ];

    const th = (col) => {
      const active = this._sort.col === col.key;
      const arrow = active ? (this._sort.dir === 1 ? ' ▲' : ' ▼') : '';
      return `<th class="sortable${active ? ' sorted' : ''}" data-col="${col.key}">${col.label}${arrow}</th>`;
    };

    const html = `
      <table class="table">
        <thead><tr>
          ${cols.map(th).join('')}
          <th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.length === 0
            ? `<tr><td colspan="${cols.length + 1}" class="empty-cell">No devices found</td></tr>`
            : rows.map(d => this._row(d)).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('dev-table-wrap').innerHTML = html;

    document.querySelectorAll('#dev-table-wrap th.sortable').forEach(th => {
      th.onclick = () => {
        const col = th.dataset.col;
        if (this._sort.col === col) this._sort.dir *= -1;
        else { this._sort.col = col; this._sort.dir = 1; }
        this._renderTable();
      };
    });
  },

  _row(d) {
    const age = H.deviceAge(d.purchaseDate);
    const ageWarn = age !== null && age >= CFG.DEVICE_AGE_WARN_YEARS;
    return `<tr class="${ageWarn ? 'row-warn' : ''}">
      <td><strong>${H.escape(d.assetTag || '—')}</strong>${d.hostname ? `<br><span class="muted small">${H.escape(d.hostname)}</span>` : ''}</td>
      <td>${H.escape(d.deviceType)}</td>
      <td>${H.escape(d.make || '')} ${H.escape(d.model || '')}<br><span class="muted small">${H.escape(d.serialNumber || '')}</span></td>
      <td>${d.assignedTo ? H.escape(d.assignedTo) : '<span class="muted">—</span>'}</td>
      <td>${H.statusBadge(d.status)}</td>
      <td>${H.conditionBadge(d.condition)}</td>
      <td>${H.warrantyStatus(d.warrantyExpiry) || (d.warrantyExpiry ? H.formatDate(d.warrantyExpiry) : '<span class="muted">—</span>')}</td>
      <td class="action-cell">
        <button class="icon-btn" title="View" onclick="Devices.openDetail('${d.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="icon-btn" title="Edit" onclick="Devices.openForm('${d.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn icon-btn-danger" title="Delete" onclick="Devices.confirmDelete('${d.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>`;
  },

  openForm(id) {
    const d = id ? DB.getById(CFG.KEYS.DEVICES, id) : {};
    const isIpad = (d && d.deviceType === 'iPad');
    const fields = this._buildFields(d || {}, isIpad);
    Modal.show(id ? 'Edit Device' : 'Add Device', buildForm(fields), () => this._save(id), id ? 'Save Changes' : 'Add Device');

    document.getElementById('f_deviceType').onchange = function() {
      const bodyEl = document.getElementById('modal-body');
      const current = getFormData(bodyEl.querySelector('form') || bodyEl);
      const isIp = this.value === 'iPad';
      const newFields = Devices._buildFields({ ...current, deviceType: this.value }, isIp);
      bodyEl.innerHTML = buildForm(newFields);
      document.getElementById('f_deviceType').value = this.value;
      document.getElementById('f_deviceType').onchange = arguments.callee;
    };
  },

  _buildFields(d, isIpad) {
    return [
      { type: 'section', label: 'Identification' },
      { name: 'deviceType', label: 'Device Type', type: 'select', options: CFG.DEVICE_TYPES, value: d.deviceType || '' },
      { name: 'assetTag', label: 'Asset Tag', value: d.assetTag || '', placeholder: 'e.g. MPS-LT-001' },
      { name: 'serialNumber', label: 'Serial Number', value: d.serialNumber || '' },
      { name: 'hostname', label: 'Hostname / Computer Name', value: d.hostname || '', placeholder: 'e.g. MPS-LAPTOP-001' },
      { name: 'make', label: 'Make', type: 'select', options: CFG.MAKES, value: d.make || '' },
      { name: 'model', label: 'Model', value: d.model || '', placeholder: 'e.g. Latitude 3420' },

      { type: 'section', label: 'Assignment & Status' },
      { name: 'assignedTo', label: 'Assigned To', value: d.assignedTo || '', placeholder: 'Name or role' },
      { name: 'location', label: 'Location', type: 'select', options: CFG.LOCATIONS, value: d.location || '' },
      { name: 'status', label: 'Status', type: 'select', options: CFG.STATUSES, value: d.status || 'available' },
      { name: 'condition', label: 'Condition', type: 'select', options: CFG.CONDITIONS, value: d.condition || 'Good' },

      { type: 'section', label: isIpad ? 'iPad Details' : 'Technical Details' },
      ...(isIpad ? [
        { name: 'osVersion', label: 'OS Version', value: d.osVersion || '', placeholder: 'e.g. iPadOS 17.4' },
        { name: 'storage', label: 'Storage', type: 'select', options: CFG.STORAGE_OPTIONS, value: d.storage || '' },
        { name: 'mdmEnrolled', label: 'JAMF / MDM Enrolled', type: 'checkbox', value: d.mdmEnrolled },
        { name: 'caseLoan', label: 'Case Loaned', type: 'checkbox', value: d.caseLoan },
        { name: 'chargerType', label: 'Charger Type', type: 'select', options: CFG.CHARGER_TYPES, value: d.chargerType || '' },
        { name: 'chargerIncluded', label: 'Charger Included', type: 'checkbox', value: d.chargerIncluded },
      ] : [
        { name: 'osVersion', label: 'OS Version', type: 'select', options: CFG.OS_VERSIONS, value: d.osVersion || '' },
        { name: 'storage', label: 'Storage', type: 'select', options: CFG.STORAGE_OPTIONS, value: d.storage || '' },
        { name: 'domainJoined', label: 'Domain Joined', type: 'checkbox', value: d.domainJoined },
        { name: 'bitlockerEnabled', label: 'BitLocker Enabled', type: 'checkbox', value: d.bitlockerEnabled },
        { name: 'mdmEnrolled', label: 'JAMF / MDM Enrolled', type: 'checkbox', value: d.mdmEnrolled },
        { name: 'lastReimaged', label: 'Last Reimaged', type: 'date', value: d.lastReimaged || '' },
      ]),

      { type: 'section', label: 'Purchase & Warranty' },
      { name: 'purchaseDate', label: 'Purchase Date', type: 'date', value: d.purchaseDate || '' },
      { name: 'purchasePrice', label: 'Purchase Price (AUD)', type: 'number', value: d.purchasePrice || '', placeholder: '0.00' },
      { name: 'supplier', label: 'Supplier / Vendor', value: d.supplier || '' },
      { name: 'fundingSource', label: 'Funding Source', type: 'select', options: CFG.FUNDING, value: d.fundingSource || '' },
      { name: 'warrantyExpiry', label: 'Warranty Expiry', type: 'date', value: d.warrantyExpiry || '' },
      { name: 'poNumber', label: 'PO Number', value: d.poNumber || '' },

      { type: 'section', label: 'Notes' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: d.notes || '', span2: true },
    ];
  },

  _save(id) {
    const body = document.getElementById('modal-body');
    const data = getFormData(body);

    if (!data.deviceType) { Toast.show('Please select a device type', 'error'); return; }
    if (!data.assetTag && !data.serialNumber && !data.hostname) {
      Toast.show('Please enter at least an asset tag, serial number, or hostname', 'error');
      return;
    }

    const item = { ...data, id: id || DB.genId('DEV') };
    DB.save(CFG.KEYS.DEVICES, item);
    Modal.hide();
    Toast.show(id ? 'Device updated' : 'Device added');
    this.render();
    App.updateBadges();
  },

  confirmDelete(id) {
    const d = DB.getById(CFG.KEYS.DEVICES, id);
    Confirm.show('Delete Device', `Delete ${d ? (d.assetTag || d.hostname || d.deviceType) : 'this device'}? This cannot be undone.`, () => {
      DB.remove(CFG.KEYS.DEVICES, id);
      Toast.show('Device deleted', 'info');
      this.render();
      App.updateBadges();
    });
  },

  openDetail(id) {
    const d = DB.getById(CFG.KEYS.DEVICES, id);
    if (!d) return;
    const age = H.deviceAge(d.purchaseDate);
    const accessories = DB.getAll(CFG.KEYS.ACCESSORIES).filter(a => a.deviceId === id);
    const maintenanceLog = DB.getAll(CFG.KEYS.MAINTENANCE).filter(m => m.deviceId === id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const html = `
      <div class="detail-grid">
        <div class="detail-section">
          <div class="detail-title">Identification</div>
          <div class="detail-row"><span>Asset Tag</span><strong>${H.escape(d.assetTag || '—')}</strong></div>
          <div class="detail-row"><span>Serial No.</span><strong>${H.escape(d.serialNumber || '—')}</strong></div>
          <div class="detail-row"><span>Hostname</span><strong>${H.escape(d.hostname || '—')}</strong></div>
          <div class="detail-row"><span>Type</span><strong>${H.escape(d.deviceType)}</strong></div>
          <div class="detail-row"><span>Make / Model</span><strong>${H.escape(d.make || '')} ${H.escape(d.model || '')}</strong></div>
        </div>
        <div class="detail-section">
          <div class="detail-title">Assignment</div>
          <div class="detail-row"><span>Assigned To</span><strong>${H.escape(d.assignedTo || '—')}</strong></div>
          <div class="detail-row"><span>Location</span><strong>${H.escape(d.location || '—')}</strong></div>
          <div class="detail-row"><span>Status</span>${H.statusBadge(d.status)}</div>
          <div class="detail-row"><span>Condition</span>${H.conditionBadge(d.condition)}</div>
        </div>
        <div class="detail-section">
          <div class="detail-title">Technical</div>
          <div class="detail-row"><span>OS</span><strong>${H.escape(d.osVersion || '—')}</strong></div>
          <div class="detail-row"><span>Storage</span><strong>${H.escape(d.storage || '—')}</strong></div>
          ${d.deviceType !== 'iPad' ? `
          <div class="detail-row"><span>Domain</span>${H.yesNo(d.domainJoined)}</div>
          <div class="detail-row"><span>BitLocker</span>${H.yesNo(d.bitlockerEnabled)}</div>
          <div class="detail-row"><span>Last Reimaged</span><strong>${H.formatDate(d.lastReimaged)}</strong></div>
          ` : `
          <div class="detail-row"><span>JAMF MDM</span>${H.yesNo(d.mdmEnrolled)}</div>
          <div class="detail-row"><span>Case Loaned</span>${H.yesNo(d.caseLoan)}</div>
          <div class="detail-row"><span>Charger Type</span><strong>${H.escape(d.chargerType || '—')}</strong></div>
          `}
        </div>
        <div class="detail-section">
          <div class="detail-title">Purchase & Warranty</div>
          <div class="detail-row"><span>Purchased</span><strong>${H.formatDate(d.purchaseDate)}</strong></div>
          <div class="detail-row"><span>Age</span><strong>${age !== null ? age + ' years' : '—'}</strong></div>
          <div class="detail-row"><span>Price</span><strong>${H.formatCurrency(d.purchasePrice)}</strong></div>
          <div class="detail-row"><span>Supplier</span><strong>${H.escape(d.supplier || '—')}</strong></div>
          <div class="detail-row"><span>Funding</span><strong>${H.escape(d.fundingSource || '—')}</strong></div>
          <div class="detail-row"><span>Warranty</span>${H.warrantyStatus(d.warrantyExpiry) || H.formatDate(d.warrantyExpiry)}</div>
          <div class="detail-row"><span>PO Number</span><strong>${H.escape(d.poNumber || '—')}</strong></div>
        </div>
      </div>

      ${d.notes ? `<div class="detail-notes"><strong>Notes:</strong> ${H.escape(d.notes)}</div>` : ''}

      ${accessories.length > 0 ? `
        <div class="detail-section" style="margin-top:1rem">
          <div class="detail-title">Linked Accessories (${accessories.length})</div>
          ${accessories.map(a => `<div class="detail-row"><span>${H.escape(a.autoId || a.id)}</span><strong>${H.escape(a.type)}${a.quantity > 1 ? ` ×${a.quantity}` : ''}</strong></div>`).join('')}
        </div>` : ''}

      ${maintenanceLog.length > 0 ? `
        <div class="detail-section" style="margin-top:1rem">
          <div class="detail-title">Maintenance History</div>
          <table class="table" style="margin-top:0.5rem">
            <thead><tr><th>Date</th><th>Type</th><th>Tech</th><th>Cost</th><th>Notes</th></tr></thead>
            <tbody>
              ${maintenanceLog.map(m => `<tr>
                <td>${H.formatDate(m.date)}</td>
                <td>${H.escape(m.type)}</td>
                <td>${H.escape(m.technician || '—')}</td>
                <td>${H.formatCurrency(m.cost)}</td>
                <td class="muted">${H.escape(m.notes || '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      <div id="qr-wrap" style="margin-top:1rem;text-align:center"></div>
    `;

    Modal.show(`Device: ${d.assetTag || d.hostname || d.deviceType}`, html, null, 'Close');
    document.getElementById('modal-save').style.display = 'none';

    setTimeout(() => {
      const qrWrap = document.getElementById('qr-wrap');
      if (qrWrap && typeof QRCode !== 'undefined') {
        const qrText = [d.assetTag, d.serialNumber, d.hostname, d.deviceType].filter(Boolean).join(' | ');
        new QRCode(qrWrap, { text: qrText, width: 100, height: 100, colorDark: '#22C55E', colorLight: '#0F172A' });
      }
    }, 100);
  },

  addNew() {
    this.openForm(null);
  },

  _exportCSV() {
    const rows = this._filtered();
    const headers = ['Asset Tag','Serial','Hostname','Type','Make','Model','Assigned To','Location','Status','Condition','OS','Storage','Domain','BitLocker','Purchase Date','Price','Warranty Expiry','Funding','Supplier','PO','Notes'];
    const lines = [headers.map(H.csvCell).join(',')];
    rows.forEach(d => {
      lines.push([
        d.assetTag, d.serialNumber, d.hostname, d.deviceType, d.make, d.model,
        d.assignedTo, d.location, d.status, d.condition, d.osVersion, d.storage,
        d.domainJoined ? 'Yes' : 'No', d.bitlockerEnabled ? 'Yes' : 'No',
        d.purchaseDate, d.purchasePrice, d.warrantyExpiry, d.fundingSource,
        d.supplier, d.poNumber, d.notes
      ].map(H.csvCell).join(','));
    });
    H.downloadFile(lines.join('\n'), 'devices.csv', 'text/csv');
  }
};
