const Dashboard = {
  _chart: null,

  render() {
    const devices = DB.getAll(CFG.KEYS.DEVICES);
    const licences = DB.getAll(CFG.KEYS.LICENCES);
    const accessories = DB.getAll(CFG.KEYS.ACCESSORIES);
    const maintenance = DB.getAll(CFG.KEYS.MAINTENANCE);

    const total = devices.length;
    const assigned = devices.filter(d => d.status === 'assigned').length;
    const available = devices.filter(d => d.status === 'available').length;
    const inMaintenance = devices.filter(d => d.status === 'maintenance').length;
    const retired = devices.filter(d => d.status === 'retired').length;

    const warrantyAlerts = devices.filter(d =>
      d.warrantyExpiry && H.isExpiringSoon(d.warrantyExpiry, CFG.WARRANTY_WARN_DAYS) && !H.isExpired(d.warrantyExpiry)
    );
    const warrantyExpired = devices.filter(d => d.warrantyExpiry && H.isExpired(d.warrantyExpiry));

    const licenceAlerts = licences.filter(l =>
      l.renewalDate && H.isExpiringSoon(l.renewalDate, CFG.LICENCE_WARN_DAYS) && !H.isExpired(l.renewalDate)
    );
    const licenceExpired = licences.filter(l => l.renewalDate && H.isExpired(l.renewalDate));

    const agedDevices = devices.filter(d => {
      const age = H.deviceAge(d.purchaseDate);
      return age !== null && age >= CFG.DEVICE_AGE_WARN_YEARS;
    });

    const recentMaintenance = maintenance
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    const typeCounts = {};
    CFG.DEVICE_TYPES.forEach(t => { typeCounts[t] = 0; });
    devices.forEach(d => { if (typeCounts[d.deviceType] !== undefined) typeCounts[d.deviceType]++; });

    const totalAlerts = warrantyAlerts.length + warrantyExpired.length + licenceAlerts.length + licenceExpired.length;

    const el = document.getElementById('view-dashboard');
    el.innerHTML = `
      <div class="dash-grid">

        <div class="stat-card">
          <div class="stat-icon icon-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${total}</div>
            <div class="stat-label">Total Devices</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon icon-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${assigned}</div>
            <div class="stat-label">Assigned</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon icon-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${available}</div>
            <div class="stat-label">Available</div>
          </div>
        </div>

        <div class="stat-card ${inMaintenance > 0 ? 'card-warn' : ''}">
          <div class="stat-icon icon-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${inMaintenance}</div>
            <div class="stat-label">In Maintenance</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon icon-gray">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${retired}</div>
            <div class="stat-label">Retired</div>
          </div>
        </div>

        <div class="stat-card ${totalAlerts > 0 ? 'card-alert' : ''}">
          <div class="stat-icon icon-red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${totalAlerts}</div>
            <div class="stat-label">Alerts</div>
          </div>
        </div>

      </div>

      <div class="dash-row">

        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">Devices by Type</span>
          </div>
          <div class="chart-wrap">
            <canvas id="type-chart"></canvas>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">Alerts & Reminders</span>
          </div>
          <div class="alert-list">
            ${this._renderAlerts(warrantyExpired, warrantyAlerts, licenceExpired, licenceAlerts, agedDevices)}
          </div>
        </div>

      </div>

      ${recentMaintenance.length > 0 ? `
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">Recent Maintenance</span>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('maintenance')">View All</button>
        </div>
        <table class="table">
          <thead><tr>
            <th>Date</th><th>Device</th><th>Type</th><th>Technician</th><th>Notes</th>
          </tr></thead>
          <tbody>
            ${recentMaintenance.map(m => {
              const dev = DB.getById(CFG.KEYS.DEVICES, m.deviceId);
              return `<tr>
                <td>${H.formatDate(m.date)}</td>
                <td>${dev ? H.escape(dev.assetTag || dev.hostname || dev.deviceType) : '<span class="muted">Unknown</span>'}</td>
                <td>${H.escape(m.type)}</td>
                <td>${H.escape(m.technician || '—')}</td>
                <td class="muted">${H.escape(m.notes || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <div class="dash-row">
        <div class="panel">
          <div class="panel-head"><span class="panel-title">Licences Summary</span></div>
          <table class="table">
            <thead><tr><th>Software</th><th>Seats</th><th>Renewal</th><th>Status</th></tr></thead>
            <tbody>
              ${licences.length === 0 ? `<tr><td colspan="4" class="empty-cell">No licences recorded</td></tr>` :
                licences.map(l => `<tr>
                  <td>${H.escape(l.software)}</td>
                  <td>${l.seats || '—'}</td>
                  <td>${H.formatDate(l.renewalDate)}</td>
                  <td>${H.warrantyStatus(l.renewalDate) || H.statusBadge(l.status)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="panel">
          <div class="panel-head"><span class="panel-title">Quick Stats</span></div>
          <div class="quick-stats">
            <div class="qs-row"><span>Accessories tracked</span><strong>${accessories.length}</strong></div>
            <div class="qs-row"><span>Licences managed</span><strong>${licences.length}</strong></div>
            <div class="qs-row"><span>Maintenance records</span><strong>${maintenance.length}</strong></div>
            <div class="qs-row"><span>Devices needing attention</span><strong class="${agedDevices.length > 0 ? 'text-orange' : ''}">${agedDevices.length}</strong></div>
            <div class="qs-row"><span>Storage used</span><strong>${DB.getSizeKB()} KB</strong></div>
          </div>
        </div>
      </div>
    `;

    this._drawTypeChart(typeCounts);
  },

  _renderAlerts(warrantyExpired, warrantyAlerts, licenceExpired, licenceAlerts, agedDevices) {
    const items = [];

    warrantyExpired.forEach(d => {
      items.push(`<div class="alert-item alert-red">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <strong>Warranty Expired</strong>
          <span>${H.escape(d.assetTag || d.hostname || d.deviceType)} — expired ${H.formatDate(d.warrantyExpiry)}</span>
        </div>
      </div>`);
    });

    licenceExpired.forEach(l => {
      items.push(`<div class="alert-item alert-red">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div>
          <strong>Licence Expired</strong>
          <span>${H.escape(l.software)} — expired ${H.formatDate(l.renewalDate)}</span>
        </div>
      </div>`);
    });

    warrantyAlerts.forEach(d => {
      const days = H.daysUntil(d.warrantyExpiry);
      items.push(`<div class="alert-item alert-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div>
          <strong>Warranty Expiring</strong>
          <span>${H.escape(d.assetTag || d.hostname || d.deviceType)} — ${days}d remaining</span>
        </div>
      </div>`);
    });

    licenceAlerts.forEach(l => {
      const days = H.daysUntil(l.renewalDate);
      items.push(`<div class="alert-item alert-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div>
          <strong>Licence Renewal Due</strong>
          <span>${H.escape(l.software)} — ${days}d remaining</span>
        </div>
      </div>`);
    });

    agedDevices.slice(0, 3).forEach(d => {
      const age = H.deviceAge(d.purchaseDate);
      items.push(`<div class="alert-item alert-blue">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div>
          <strong>Aged Device</strong>
          <span>${H.escape(d.assetTag || d.hostname || d.deviceType)} — ${age} years old</span>
        </div>
      </div>`);
    });

    if (items.length === 0) {
      return `<div class="empty-alerts">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>All clear — no alerts</span>
      </div>`;
    }

    return items.join('');
  },

  _drawTypeChart(typeCounts) {
    const canvas = document.getElementById('type-chart');
    if (!canvas) return;

    const labels = Object.keys(typeCounts).filter(k => typeCounts[k] > 0);
    const data = labels.map(k => typeCounts[k]);

    const palette = [
      '#3B82F6','#22C55E','#F59E0B','#EF4444',
      '#8B5CF6','#06B6D4','#EC4899','#14B8A6'
    ];

    if (this._chart) { this._chart.destroy(); this._chart = null; }

    if (data.length === 0) {
      canvas.parentElement.innerHTML = '<div class="empty-chart">No devices recorded yet</div>';
      return;
    }

    this._chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: palette.slice(0, labels.length), borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94A3B8', font: { size: 11, family: 'Fira Sans' }, padding: 12, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw}`
            }
          }
        },
        responsive: true,
        maintainAspectRatio: true
      }
    });
  }
};
