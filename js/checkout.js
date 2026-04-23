const Checkout = {
  _tab: 'active',

  render() {
    const all = DB.getAll(CFG.KEYS.CHECKOUT);
    const active = all.filter(c => c.status === 'out');
    const history = all.filter(c => c.status === 'returned').sort((a,b) => new Date(b.returnedAt) - new Date(a.returnedAt));

    const el = document.getElementById('view-checkout');
    el.innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${this._tab === 'active' ? 'active' : ''}" onclick="Checkout._switchTab('active')">
          Currently Out <span class="tab-count">${active.length}</span>
        </button>
        <button class="tab-btn ${this._tab === 'history' ? 'active' : ''}" onclick="Checkout._switchTab('history')">
          History <span class="tab-count">${history.length}</span>
        </button>
      </div>
      <div id="co-content"></div>
    `;

    this._renderTab(active, history);
  },

  _switchTab(tab) {
    this._tab = tab;
    this.render();
  },

  _renderTab(active, history) {
    const el = document.getElementById('co-content');

    if (this._tab === 'active') {
      if (active.length === 0) {
        el.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p>No devices currently checked out</p></div>`;
        return;
      }
      el.innerHTML = `
        <table class="table">
          <thead><tr>
            <th>Device</th><th>Checked Out To</th><th>Date Out</th><th>Expected Return</th><th>Days Out</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${active.map(c => {
              const dev = c.deviceId ? DB.getById(CFG.KEYS.DEVICES, c.deviceId) : null;
              const daysOut = c.checkedOutAt ? Math.floor((new Date() - new Date(c.checkedOutAt)) / 86400000) : '—';
              const overdue = c.expectedReturn && H.isExpired(c.expectedReturn);
              return `<tr class="${overdue ? 'row-warn' : ''}">
                <td>${dev ? `<strong>${H.escape(dev.assetTag || dev.hostname || dev.deviceType)}</strong><br><span class="muted small">${H.escape(dev.deviceType)}</span>` : '<span class="muted">Unknown</span>'}</td>
                <td>${H.escape(c.borrowerName || '—')}</td>
                <td>${H.formatDate(c.checkedOutAt)}</td>
                <td>${c.expectedReturn ? `${H.formatDate(c.expectedReturn)}${overdue ? ' <span class="badge badge-red">Overdue</span>' : ''}` : '<span class="muted">—</span>'}</td>
                <td>${typeof daysOut === 'number' ? daysOut + 'd' : '—'}</td>
                <td class="action-cell">
                  <button class="btn btn-sm btn-primary" onclick="Checkout.returnDevice('${c.id}')">Return</button>
                  <button class="icon-btn icon-btn-danger" title="Delete" onclick="Checkout.confirmDelete('${c.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } else {
      el.innerHTML = `
        <table class="table">
          <thead><tr>
            <th>Device</th><th>Borrowed By</th><th>Checked Out</th><th>Returned</th><th>Duration</th><th>Notes</th>
          </tr></thead>
          <tbody>
            ${history.length === 0
              ? `<tr><td colspan="6" class="empty-cell">No return history yet</td></tr>`
              : history.slice(0, 50).map(c => {
                  const dev = c.deviceId ? DB.getById(CFG.KEYS.DEVICES, c.deviceId) : null;
                  const duration = (c.checkedOutAt && c.returnedAt)
                    ? Math.floor((new Date(c.returnedAt) - new Date(c.checkedOutAt)) / 86400000) + 'd'
                    : '—';
                  return `<tr>
                    <td>${dev ? H.escape(dev.assetTag || dev.hostname || dev.deviceType) : '<span class="muted">Unknown</span>'}</td>
                    <td>${H.escape(c.borrowerName || '—')}</td>
                    <td>${H.formatDate(c.checkedOutAt)}</td>
                    <td>${H.formatDate(c.returnedAt)}</td>
                    <td>${duration}</td>
                    <td class="muted">${H.escape(c.notes || '—')}</td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>`;
    }
  },

  openForm(id) {
    const devices = DB.getAll(CFG.KEYS.DEVICES).filter(d => d.status === 'available');
    const allDevices = DB.getAll(CFG.KEYS.DEVICES);

    const deviceOpts = allDevices.map(d => ({
      label: `${d.assetTag || d.hostname || d.deviceType} [${d.status}]`,
      value: d.id
    }));

    const fields = [
      { type: 'section', label: 'Checkout Details' },
      { name: 'deviceId', label: 'Device', type: 'select',
        options: ['— Select Device —', ...deviceOpts.map(o => o.label)],
        value: ''
      },
      { name: 'borrowerName', label: 'Borrower Name', value: '', placeholder: 'Student or staff name' },
      { name: 'borrowerClass', label: 'Class / Room (optional)', value: '', placeholder: 'e.g. Room 3' },
      { name: 'checkedOutAt', label: 'Date Out', type: 'date', value: new Date().toISOString().slice(0,10) },
      { name: 'expectedReturn', label: 'Expected Return', type: 'date', value: '' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: '', span2: true },
    ];

    Modal.show('Check Out Device', buildForm(fields), () => this._save(deviceOpts), 'Check Out');
  },

  _save(deviceOpts) {
    const data = getFormData(document.getElementById('modal-body'));
    const linked = deviceOpts.find(o => o.label === data.deviceId);
    if (!linked) { Toast.show('Please select a device', 'error'); return; }
    if (!data.borrowerName) { Toast.show('Borrower name is required', 'error'); return; }

    const item = {
      ...data,
      id: DB.genId('CO'),
      deviceId: linked.value,
      status: 'out',
      checkedOutAt: data.checkedOutAt || new Date().toISOString().slice(0,10)
    };

    const dev = DB.getById(CFG.KEYS.DEVICES, linked.value);
    if (dev) DB.save(CFG.KEYS.DEVICES, { ...dev, status: 'assigned', assignedTo: data.borrowerName });

    DB.save(CFG.KEYS.CHECKOUT, item);
    Modal.hide();
    Toast.show('Device checked out to ' + data.borrowerName);
    this.render();
  },

  returnDevice(id) {
    const c = DB.getById(CFG.KEYS.CHECKOUT, id);
    if (!c) return;

    const fields = [
      { name: 'condition', label: 'Device Condition on Return', type: 'select', options: CFG.CONDITIONS, value: 'Good' },
      { name: 'notes', label: 'Return Notes', type: 'textarea', value: c.notes || '' },
    ];

    Modal.show('Return Device', buildForm(fields), () => {
      const data = getFormData(document.getElementById('modal-body'));
      const updated = { ...c, status: 'returned', returnedAt: new Date().toISOString(), notes: data.notes };
      DB.save(CFG.KEYS.CHECKOUT, updated);

      const dev = DB.getById(CFG.KEYS.DEVICES, c.deviceId);
      if (dev) DB.save(CFG.KEYS.DEVICES, { ...dev, status: 'available', condition: data.condition, assignedTo: '' });

      Modal.hide();
      Toast.show('Device returned');
      this.render();
    }, 'Confirm Return');
  },

  confirmDelete(id) {
    Confirm.show('Remove Checkout Record', 'Remove this checkout record?', () => {
      DB.remove(CFG.KEYS.CHECKOUT, id);
      Toast.show('Record removed', 'info');
      this.render();
    });
  },

  addNew() {
    this.openForm(null);
  }
};
