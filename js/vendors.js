const Vendors = {
  render() {
    const vendors = DB.getAll(CFG.KEYS.VENDORS);
    const el = document.getElementById('view-vendors');

    el.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="vnd-search" placeholder="Search vendors…">
          </div>
        </div>
        <div class="toolbar-right">
          <span class="rec-count">${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div id="vnd-grid" class="vendor-grid">
        ${vendors.length === 0
          ? `<div class="empty-state" style="grid-column:1/-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <p>No vendors yet. Add your IT suppliers and contacts.</p>
            </div>`
          : vendors.map(v => this._card(v)).join('')}
      </div>
    `;

    document.getElementById('vnd-search').oninput = H.debounce(e => {
      const s = e.target.value.toLowerCase();
      const filtered = s ? vendors.filter(v =>
        (v.name || '').toLowerCase().includes(s) ||
        (v.contact || '').toLowerCase().includes(s) ||
        (v.email || '').toLowerCase().includes(s) ||
        (v.categories || '').toLowerCase().includes(s)
      ) : vendors;
      document.getElementById('vnd-grid').innerHTML = filtered.length === 0
        ? `<div class="empty-state" style="grid-column:1/-1"><p>No results</p></div>`
        : filtered.map(v => this._card(v)).join('');
    }, 200);
  },

  _card(v) {
    return `<div class="vendor-card">
      <div class="vendor-head">
        <div class="vendor-avatar">${(v.name || '?').slice(0, 2).toUpperCase()}</div>
        <div>
          <div class="vendor-name">${H.escape(v.name)}</div>
          ${v.categories ? `<div class="vendor-cats muted small">${H.escape(v.categories)}</div>` : ''}
        </div>
      </div>
      <div class="vendor-details">
        ${v.contact ? `<div class="vendor-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>${H.escape(v.contact)}</span></div>` : ''}
        ${v.phone ? `<div class="vendor-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 17.5v-.58z"/></svg><span>${H.escape(v.phone)}</span></div>` : ''}
        ${v.email ? `<div class="vendor-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:${H.escape(v.email)}" class="vendor-link">${H.escape(v.email)}</a></div>` : ''}
        ${v.website ? `<div class="vendor-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span class="muted small">${H.escape(v.website)}</span></div>` : ''}
        ${v.notes ? `<div class="vendor-notes muted small">${H.escape(v.notes)}</div>` : ''}
      </div>
      <div class="vendor-actions">
        <button class="btn btn-ghost btn-sm" onclick="Vendors.openForm('${v.id}')">Edit</button>
        <button class="btn btn-ghost btn-sm text-red" onclick="Vendors.confirmDelete('${v.id}')">Delete</button>
      </div>
    </div>`;
  },

  openForm(id) {
    const v = id ? DB.getById(CFG.KEYS.VENDORS, id) : {};
    const fields = [
      { name: 'name', label: 'Vendor / Company Name', value: v.name || '', placeholder: 'e.g. Dell Australia' },
      { name: 'categories', label: 'Categories', value: v.categories || '', placeholder: 'e.g. Laptops, Monitors' },
      { name: 'contact', label: 'Contact Person', value: v.contact || '' },
      { name: 'phone', label: 'Phone', value: v.phone || '' },
      { name: 'email', label: 'Email', type: 'email', value: v.email || '' },
      { name: 'website', label: 'Website', value: v.website || '', placeholder: 'e.g. dell.com/au' },
      { name: 'accountNumber', label: 'Account Number', value: v.accountNumber || '' },
      { name: 'notes', label: 'Notes', type: 'textarea', value: v.notes || '', span2: true },
    ];
    Modal.show(id ? 'Edit Vendor' : 'Add Vendor', buildForm(fields), () => this._save(id), id ? 'Save Changes' : 'Add Vendor');
  },

  _save(id) {
    const data = getFormData(document.getElementById('modal-body'));
    if (!data.name) { Toast.show('Vendor name is required', 'error'); return; }
    DB.save(CFG.KEYS.VENDORS, { ...data, id: id || DB.genId('VND') });
    Modal.hide();
    Toast.show(id ? 'Vendor updated' : 'Vendor added');
    this.render();
  },

  confirmDelete(id) {
    const v = DB.getById(CFG.KEYS.VENDORS, id);
    Confirm.show('Delete Vendor', `Delete ${v ? v.name : 'this vendor'}?`, () => {
      DB.remove(CFG.KEYS.VENDORS, id);
      Toast.show('Vendor deleted', 'info');
      this.render();
    });
  },

  addNew() {
    this.openForm(null);
  }
};
