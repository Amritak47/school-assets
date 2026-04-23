const Audit = {
  _session: null,

  render() {
    const el = document.getElementById('view-audit');
    const sessions = DB.getAll(CFG.KEYS.AUDIT).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const active = sessions.find(s => !s.completedAt);

    el.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <h3 style="margin:0;color:var(--text)">${active ? 'Active Audit: ' + H.escape(active.name) : 'Term Audit'}</h3>
        </div>
        <div class="toolbar-right">
          ${active
            ? `<button class="btn btn-ghost btn-sm" onclick="Audit.completeSession('${active.id}')">Complete Audit</button>`
            : `<button class="btn btn-primary" id="start-audit-btn">Start New Audit</button>`
          }
        </div>
      </div>

      ${active ? this._renderActive(active) : this._renderHistory(sessions)}
    `;

    if (!active) {
      document.getElementById('start-audit-btn')?.addEventListener('click', () => this._startNew());
    }
  },

  _renderActive(session) {
    const devices = DB.getAll(CFG.KEYS.DEVICES);
    const checked = session.checked || {};
    const total = devices.length;
    const done = Object.keys(checked).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    return `
      <div class="audit-progress">
        <div class="audit-pct">${pct}%</div>
        <div class="audit-bar-wrap">
          <div class="audit-bar"><div class="audit-fill" style="width:${pct}%"></div></div>
          <span class="audit-label">${done} of ${total} devices verified</span>
        </div>
      </div>

      <div class="audit-grid">
        ${devices.map(d => {
          const state = checked[d.id];
          return `<div class="audit-card ${state ? 'audit-done' : ''}">
            <div class="audit-card-head">
              <strong>${H.escape(d.assetTag || d.hostname || d.deviceType)}</strong>
              ${H.statusBadge(d.status)}
            </div>
            <div class="audit-card-sub">${H.escape(d.deviceType)} · ${H.escape(d.assignedTo || 'Unassigned')}</div>
            ${state ? `
              <div class="audit-card-result">
                ${H.conditionBadge(state.condition)}
                <span class="muted small">${H.formatDate(state.auditedAt)}</span>
              </div>
              <button class="btn btn-ghost btn-xs" onclick="Audit.undoCheck('${session.id}','${d.id}')">Undo</button>
            ` : `
              <div class="audit-quick-btns">
                <button class="btn btn-sm btn-primary" onclick="Audit.quickCheck('${session.id}','${d.id}','Good')">Good</button>
                <button class="btn btn-sm btn-ghost" onclick="Audit.openCheck('${session.id}','${d.id}')">Details</button>
              </div>
            `}
          </div>`;
        }).join('')}
      </div>
    `;
  },

  _renderHistory(sessions) {
    const past = sessions.filter(s => s.completedAt);
    if (past.length === 0) {
      return `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <p>No audit sessions yet. Start a term audit to verify all devices.</p>
      </div>`;
    }
    return `
      <table class="table">
        <thead><tr><th>Audit Name</th><th>Started</th><th>Completed</th><th>Devices Checked</th><th>Issues Found</th></tr></thead>
        <tbody>
          ${past.map(s => {
            const checked = s.checked || {};
            const issues = Object.values(checked).filter(c => c.condition === 'Fair' || c.condition === 'Poor').length;
            return `<tr>
              <td><strong>${H.escape(s.name)}</strong></td>
              <td>${H.formatDate(s.createdAt)}</td>
              <td>${H.formatDate(s.completedAt)}</td>
              <td>${Object.keys(checked).length}</td>
              <td>${issues > 0 ? `<span class="badge badge-orange">${issues} issue${issues !== 1 ? 's' : ''}</span>` : '<span class="badge badge-green">None</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  _startNew() {
    const term = this._currentTerm();
    const fields = [
      { name: 'name', label: 'Audit Name', value: `Term ${term} Audit ${new Date().getFullYear()}`, placeholder: 'e.g. Term 2 Audit 2026' },
    ];
    Modal.show('Start New Audit', buildForm(fields), () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.name) { Toast.show('Please enter an audit name', 'error'); return; }
      const session = { id: DB.genId('AUD'), name: data.name, checked: {} };
      DB.save(CFG.KEYS.AUDIT, session);
      Modal.hide();
      Toast.show('Audit started: ' + data.name);
      this.render();
    }, 'Start Audit');
  },

  _currentTerm() {
    const month = new Date().getMonth() + 1;
    if (month <= 3) return 1;
    if (month <= 6) return 2;
    if (month <= 9) return 3;
    return 4;
  },

  quickCheck(sessionId, deviceId, condition) {
    const session = DB.getById(CFG.KEYS.AUDIT, sessionId);
    if (!session) return;
    const checked = { ...(session.checked || {}), [deviceId]: { condition, auditedAt: new Date().toISOString() } };
    DB.save(CFG.KEYS.AUDIT, { ...session, checked });
    this.render();
  },

  openCheck(sessionId, deviceId) {
    const d = DB.getById(CFG.KEYS.DEVICES, deviceId);
    const fields = [
      { name: 'condition', label: 'Condition', type: 'select', options: CFG.CONDITIONS, value: d?.condition || 'Good' },
      { name: 'location', label: 'Location Verified', type: 'select', options: CFG.LOCATIONS, value: d?.location || '' },
      { name: 'notes', label: 'Audit Notes', type: 'textarea', value: '', span2: true },
    ];
    Modal.show(`Audit: ${d ? (d.assetTag || d.hostname || d.deviceType) : 'Device'}`, buildForm(fields), () => {
      const data = getFormData(document.getElementById('modal-body'));
      this.quickCheck(sessionId, deviceId, data.condition);
      if (d && data.location) DB.save(CFG.KEYS.DEVICES, { ...d, condition: data.condition, location: data.location });
      Modal.hide();
    }, 'Mark Verified');
  },

  undoCheck(sessionId, deviceId) {
    const session = DB.getById(CFG.KEYS.AUDIT, sessionId);
    if (!session) return;
    const checked = { ...(session.checked || {}) };
    delete checked[deviceId];
    DB.save(CFG.KEYS.AUDIT, { ...session, checked });
    this.render();
  },

  completeSession(sessionId) {
    Confirm.show('Complete Audit', 'Mark this audit as complete?', () => {
      const session = DB.getById(CFG.KEYS.AUDIT, sessionId);
      DB.save(CFG.KEYS.AUDIT, { ...session, completedAt: new Date().toISOString() });
      Toast.show('Audit completed');
      this.render();
    }, 'Complete');
  },

  addNew() {
    this._startNew();
  }
};
