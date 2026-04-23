const Licences = {
  render() {
    const licences = DB.getAll(CFG.KEYS.LICENCES);
    const el = document.getElementById('view-licences');

    const totalCost = licences.reduce((s, l) => s + (Number(l.totalCost) || 0), 0);
    const expiringSoon = licences.filter(l => H.isExpiringSoon(l.renewalDate, CFG.LICENCE_WARN_DAYS) && !H.isExpired(l.renewalDate)).length;
    const expired = licences.filter(l => H.isExpired(l.renewalDate)).length;

    el.innerHTML = `
      <div class="sub-stats">
        <div class="sub-stat">
          <span class="sub-val">${licences.length}</span>
          <span class="sub-label">Total Licences</span>
        </div>
        <div class="sub-stat">
          <span class="sub-val">${H.formatCurrency(totalCost)}</span>
          <span class="sub-label">Annual Cost</span>
        </div>
        <div class="sub-stat ${expiringSoon > 0 ? 'sub-warn' : ''}">
          <span class="sub-val">${expiringSoon}</span>
          <span class="sub-label">Expiring Soon</span>
        </div>
        <div class="sub-stat ${expired > 0 ? 'sub-alert' : ''}">
          <span class="sub-val">${expired}</span>
          <span class="sub-label">Expired</span>
        </div>
      </div>

      <div class="toolbar" style="margin-top:0">
        <div class="toolbar-left">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="lic-search" placeholder="Search software, vendor…">
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-ghost btn-sm" id="lic-export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>
      </div>

      <table class="table">
        <thead><tr>
          <th>Software</th>
          <th>Vendor</th>
          <th>Type</th>
          <th>Seats</th>
          <th>Cost/Unit</th>
          <th>Total Cost</th>
          <th>Renewal</th>
          <th>Status</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="lic-tbody">
          ${licences.length === 0
            ? `<tr><td colspan="9" class="empty-cell">No licences recorded</td></tr>`
            : licences.map(l => this._row(l)).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('lic-search').oninput = H.debounce(e => {
      const s = e.target.value.toLowerCase();
      const all = DB.getAll(CFG.KEYS.LICENCES);
      const filtered = s ? all.filter(l =>
        (l.software || '').toLowerCase().includes(s) ||
        (l.vendor || '').toLowerCase().includes(s) ||
        (l.assignedTo || '').toLowerCase().includes(s)
      ) : all;
      document.getElementById('lic-tbody').innerHTML = filtered.length === 0
        ? `<tr><td colspan="9" class="empty-cell">No results</td></tr>`
        : filtered.map(l => this._row(l)).join('');
    }, 200);

    document.getElementById('lic-export-btn').onclick = () => this._exportCSV();
  },

  _row(l) {
    const status = H.warrantyStatus(l.renewalDate) || H.statusBadge(l.status || 'active');
    return `<tr>
      <td>
        <strong>${H.escape(l.software)}</strong>
        ${l.assignedTo ? `<br><span class="muted small">${H.escape(l.assignedTo)}</span>` : ''}
      </td>
      <td>${H.escape(l.vendor || '—')}</td>
      <td>${H.escape(l.licenceType || '—')}</td>
      <td>${l.seats || '—'}</td>
      <td>${l.costPerUnit ? H.formatCurrency(l.costPerUnit) : '—'}</td>
      <td><strong>${l.totalCost ? H.formatCurrency(l.totalCost) : '—'}</strong></td>
      <td>${H.formatDate(l.renewalDate)}</td>
      <td>${status}</td>
      <td class="action-cell">
        <button class="icon-btn" title="View notes" onclick="Licences.openDetail('${l.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="icon-btn" title="Edit" onclick="Licences.openForm('${l.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn icon-btn-danger" title="Delete" onclick="Licences.confirmDelete('${l.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>`;
  },

  openForm(id) {
    const l = id ? DB.getById(CFG.KEYS.LICENCES, id) : {};
    const fields = [
      { type: 'section', label: 'Software Details' },
      { name: 'software', label: 'Software Name', value: l.software || '', placeholder: 'e.g. Microsoft Windows' },
      { name: 'vendor', label: 'Vendor', type: 'select', options: CFG.VENDORS, value: l.vendor || '' },
      { name: 'licenceType', label: 'Licence Type', type: 'select', options: CFG.LICENCE_TYPES, value: l.licenceType || '' },
      { name: 'status', label: 'Status', type: 'select', options: ['active','expired','pending'], value: l.status || 'active' },
      { name: 'assignedTo', label: 'Assigned To', value: l.assignedTo || '', placeholder: 'e.g. All Windows Devices' },

      { type: 'section', label: 'Costs & Coverage' },
      { name: 'seats', label: 'Seats / Devices', type: 'number', value: l.seats || '', placeholder: '0' },
      { name: 'costPerUnit', label: 'Cost Per Unit (AUD)', type: 'number', value: l.costPerUnit || '', placeholder: '0.00' },
      { name: 'totalCost', label: 'Total Cost (AUD)', type: 'number', value: l.totalCost || '', placeholder: '0.00' },
      { name: 'billingYear', label: 'Billing Year', type: 'number', value: l.billingYear || new Date().getFullYear(), placeholder: '2026' },

      { type: 'section', label: 'Renewal' },
      { name: 'renewalDate', label: 'Renewal Date', type: 'date', value: l.renewalDate || '' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: l.notes || '', span2: true },
    ];

    Modal.show(id ? 'Edit Licence' : 'Add Licence', buildForm(fields), () => this._save(id), id ? 'Save Changes' : 'Add Licence');
  },

  _save(id) {
    const data = getFormData(document.getElementById('modal-body'));
    if (!data.software) { Toast.show('Software name is required', 'error'); return; }

    const item = { ...data, id: id || DB.genId('LIC') };
    DB.save(CFG.KEYS.LICENCES, item);
    Modal.hide();
    Toast.show(id ? 'Licence updated' : 'Licence added');
    this.render();
    App.updateBadges();
  },

  openDetail(id) {
    const l = DB.getById(CFG.KEYS.LICENCES, id);
    if (!l) return;
    const html = `
      <div class="detail-grid">
        <div class="detail-section">
          <div class="detail-title">Software</div>
          <div class="detail-row"><span>Name</span><strong>${H.escape(l.software)}</strong></div>
          <div class="detail-row"><span>Vendor</span><strong>${H.escape(l.vendor || '—')}</strong></div>
          <div class="detail-row"><span>Type</span><strong>${H.escape(l.licenceType || '—')}</strong></div>
          <div class="detail-row"><span>Assigned To</span><strong>${H.escape(l.assignedTo || '—')}</strong></div>
          <div class="detail-row"><span>Status</span>${H.statusBadge(l.status || 'active')}</div>
        </div>
        <div class="detail-section">
          <div class="detail-title">Costs</div>
          <div class="detail-row"><span>Seats</span><strong>${l.seats || '—'}</strong></div>
          <div class="detail-row"><span>Cost / Unit</span><strong>${H.formatCurrency(l.costPerUnit)}</strong></div>
          <div class="detail-row"><span>Total Cost</span><strong>${H.formatCurrency(l.totalCost)}</strong></div>
          <div class="detail-row"><span>Billing Year</span><strong>${l.billingYear || '—'}</strong></div>
          <div class="detail-row"><span>Renewal</span><strong>${H.formatDate(l.renewalDate)}</strong></div>
          <div class="detail-row"><span>Warranty</span>${H.warrantyStatus(l.renewalDate) || '—'}</div>
        </div>
      </div>
      ${l.notes ? `<div class="detail-notes"><strong>Notes:</strong> ${H.escape(l.notes)}</div>` : ''}
    `;
    Modal.show(`Licence: ${l.software}`, html, null, 'Close');
    document.getElementById('modal-save').style.display = 'none';
  },

  confirmDelete(id) {
    const l = DB.getById(CFG.KEYS.LICENCES, id);
    Confirm.show('Delete Licence', `Delete ${l ? l.software : 'this licence'}?`, () => {
      DB.remove(CFG.KEYS.LICENCES, id);
      Toast.show('Licence deleted', 'info');
      this.render();
    });
  },

  addNew() {
    this.openForm(null);
  },

  _exportCSV() {
    const rows = DB.getAll(CFG.KEYS.LICENCES);
    const headers = ['Software','Vendor','Type','Seats','Cost/Unit','Total','Billing Year','Renewal Date','Status','Assigned To','Notes'];
    const lines = [headers.map(H.csvCell).join(',')];
    rows.forEach(l => {
      lines.push([l.software, l.vendor, l.licenceType, l.seats, l.costPerUnit, l.totalCost, l.billingYear, l.renewalDate, l.status, l.assignedTo, l.notes].map(H.csvCell).join(','));
    });
    H.downloadFile(lines.join('\n'), 'licences.csv', 'text/csv');
  }
};
