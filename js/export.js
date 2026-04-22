const Export = {
  render() {
    const sizeKB = DB.getSizeKB();
    const maxKB = 5120;
    const pct = Math.min(Math.round(sizeKB / maxKB * 100), 100);

    const counts = {
      devices: DB.getAll(CFG.KEYS.DEVICES).length,
      accessories: DB.getAll(CFG.KEYS.ACCESSORIES).length,
      licences: DB.getAll(CFG.KEYS.LICENCES).length,
      vendors: DB.getAll(CFG.KEYS.VENDORS).length,
      maintenance: DB.getAll(CFG.KEYS.MAINTENANCE).length,
      checkout: DB.getAll(CFG.KEYS.CHECKOUT).length,
      audit: DB.getAll(CFG.KEYS.AUDIT).length,
    };

    const el = document.getElementById('view-export');
    el.innerHTML = `
      <div class="export-grid">

        <div class="panel">
          <div class="panel-head"><span class="panel-title">Storage Usage</span></div>
          <div class="storage-detail">
            <div class="storage-big">${sizeKB} KB <span class="muted">/ ~5,120 KB</span></div>
            <div class="audit-bar-wrap" style="margin-top:0.75rem">
              <div class="audit-bar"><div class="audit-fill ${pct > 80 ? 'fill-warn' : ''}" style="width:${pct}%"></div></div>
              <span class="audit-label">${pct}% used</span>
            </div>
            <div class="storage-rows" style="margin-top:1rem">
              ${Object.entries(counts).map(([k,v]) => `
                <div class="qs-row"><span>${k.charAt(0).toUpperCase() + k.slice(1)}</span><strong>${v} records</strong></div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><span class="panel-title">Backup & Restore</span></div>
          <div class="export-actions">
            <div class="export-action-card">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <div>
                <strong>Download JSON Backup</strong>
                <p>Full backup of all data as a JSON file. Save this regularly.</p>
              </div>
              <button class="btn btn-primary" onclick="Export.downloadJSON()">Download Backup</button>
            </div>
            <div class="export-action-card">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div>
                <strong>Restore from Backup</strong>
                <p>Import a previously saved JSON backup file. This will overwrite all current data.</p>
              </div>
              <button class="btn btn-ghost" onclick="Export.triggerImport()">Choose File</button>
              <input type="file" id="import-file" accept=".json" style="display:none" onchange="Export.importJSON(this)">
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><span class="panel-title">CSV Exports</span></div>
          <div class="export-actions">
            ${[
              { label: 'Devices', fn: "Devices._exportCSV()", icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>' },
              { label: 'Accessories', fn: "Accessories._exportCSV()", icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' },
              { label: 'Licences', fn: "Licences._exportCSV()", icon: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
              { label: 'Maintenance', fn: "Maintenance._exportCSV()", icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
            ].map(item => `
              <div class="export-action-card compact">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">${item.icon}</svg>
                <div><strong>Export ${item.label}</strong><p>Download ${item.label.toLowerCase()} as CSV</p></div>
                <button class="btn btn-ghost btn-sm" onclick="${item.fn}">CSV</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><span class="panel-title">Danger Zone</span></div>
          <div class="danger-zone">
            <div class="danger-desc">
              <strong>Clear All Data</strong>
              <p>Permanently delete all records from all sections. Make a backup first!</p>
            </div>
            <button class="btn btn-danger" onclick="Export.confirmClearAll()">Clear All Data</button>
          </div>
        </div>

      </div>
    `;
  },

  downloadJSON() {
    const payload = DB.exportAll();
    const filename = `moil-it-backup-${new Date().toISOString().slice(0,10)}.json`;
    H.downloadFile(JSON.stringify(payload, null, 2), filename, 'application/json');
    Toast.show('Backup downloaded: ' + filename);
  },

  triggerImport() {
    document.getElementById('import-file').click();
  },

  importJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!payload.data) throw new Error('Invalid backup file format');
        Confirm.show('Restore Backup', `This will overwrite ALL current data with the backup from ${H.formatDate(payload.exportedAt)}. Are you sure?`, () => {
          DB.importAll(payload);
          Toast.show('Backup restored successfully');
          App.navigate('dashboard');
        }, 'Restore');
      } catch (err) {
        Toast.show('Invalid backup file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  },

  confirmClearAll() {
    Confirm.show('Clear All Data', 'This will permanently delete ALL records. This cannot be undone. Are you sure?', () => {
      DB.clearAll();
      DB.ensureSeeded();
      Toast.show('All data cleared', 'warning');
      App.navigate('dashboard');
    }, 'Clear All');
  },

  addNew() {}
};
