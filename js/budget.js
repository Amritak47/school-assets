const Budget = {
  _charts: {},

  render() {
    const devices = DB.getAll(CFG.KEYS.DEVICES);
    const licences = DB.getAll(CFG.KEYS.LICENCES);
    const maintenance = DB.getAll(CFG.KEYS.MAINTENANCE);
    const accessories = DB.getAll(CFG.KEYS.ACCESSORIES);

    const devSpend = devices.reduce((s, d) => s + (Number(d.purchasePrice) || 0), 0);
    const licSpend = licences.reduce((s, l) => s + (Number(l.totalCost) || 0), 0);
    const mntSpend = maintenance.reduce((s, m) => s + (Number(m.cost) || 0), 0);
    const accSpend = accessories.reduce((s, a) => s + (Number(a.purchasePrice) || 0), 0);
    const totalSpend = devSpend + licSpend + mntSpend + accSpend;

    const spendByType = {};
    CFG.DEVICE_TYPES.forEach(t => { spendByType[t] = 0; });
    devices.forEach(d => {
      if (d.purchasePrice && spendByType[d.deviceType] !== undefined) {
        spendByType[d.deviceType] += Number(d.purchasePrice) || 0;
      }
    });

    const fundingBreakdown = {};
    CFG.FUNDING.forEach(f => { fundingBreakdown[f] = 0; });
    devices.forEach(d => {
      if (d.purchasePrice && d.fundingSource && fundingBreakdown[d.fundingSource] !== undefined) {
        fundingBreakdown[d.fundingSource] += Number(d.purchasePrice) || 0;
      }
    });

    const ageGroups = { 'Under 2 years': 0, '2–4 years': 0, '4–6 years': 0, '6+ years': 0 };
    devices.forEach(d => {
      const age = H.deviceAge(d.purchaseDate);
      if (age === null) return;
      if (age < 2) ageGroups['Under 2 years']++;
      else if (age < 4) ageGroups['2–4 years']++;
      else if (age < 6) ageGroups['4–6 years']++;
      else ageGroups['6+ years']++;
    });

    const mntByMonth = {};
    maintenance.forEach(m => {
      if (!m.date || !m.cost) return;
      const key = m.date.slice(0, 7);
      mntByMonth[key] = (mntByMonth[key] || 0) + (Number(m.cost) || 0);
    });
    const sortedMonths = Object.keys(mntByMonth).sort().slice(-12);

    const el = document.getElementById('view-budget');
    el.innerHTML = `
      <div class="dash-grid">
        <div class="stat-card">
          <div class="stat-icon icon-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${H.formatCurrency(devSpend)}</div>
            <div class="stat-label">Device Purchases</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${H.formatCurrency(licSpend)}</div>
            <div class="stat-label">Software Licences</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${H.formatCurrency(mntSpend)}</div>
            <div class="stat-label">Maintenance Costs</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-val">${H.formatCurrency(totalSpend)}</div>
            <div class="stat-label">Total IT Spend</div>
          </div>
        </div>
      </div>

      <div class="dash-row">
        <div class="panel">
          <div class="panel-head"><span class="panel-title">Spend by Device Type</span></div>
          <div class="chart-wrap"><canvas id="budget-type-chart"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">IT Spend Breakdown</span></div>
          <div class="chart-wrap"><canvas id="budget-cat-chart"></canvas></div>
        </div>
      </div>

      <div class="dash-row">
        <div class="panel">
          <div class="panel-head"><span class="panel-title">Device Age Distribution</span></div>
          <div class="chart-wrap"><canvas id="budget-age-chart"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">Maintenance Costs (Last 12 months)</span></div>
          <div class="chart-wrap"><canvas id="budget-mnt-chart"></canvas></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><span class="panel-title">Funding Source Breakdown</span></div>
        <div class="funding-table">
          <table class="table">
            <thead><tr><th>Funding Source</th><th>Amount</th><th>Share</th></tr></thead>
            <tbody>
              ${Object.entries(fundingBreakdown)
                .filter(([,v]) => v > 0)
                .sort(([,a],[,b]) => b - a)
                .map(([k,v]) => `<tr>
                  <td>${H.escape(k)}</td>
                  <td>${H.formatCurrency(v)}</td>
                  <td>${devSpend > 0 ? Math.round(v / devSpend * 100) + '%' : '—'}</td>
                </tr>`).join('') || `<tr><td colspan="3" class="empty-cell">No purchase data with funding source</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this._drawCharts(spendByType, devSpend, licSpend, mntSpend, accSpend, ageGroups, sortedMonths, mntByMonth);
  },

  _drawCharts(spendByType, devSpend, licSpend, mntSpend, accSpend, ageGroups, sortedMonths, mntByMonth) {
    const palette = ['#3B82F6','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#14B8A6'];
    const gridColor = 'rgba(148,163,184,0.1)';
    const textColor = '#94A3B8';

    Object.values(this._charts).forEach(c => c.destroy());
    this._charts = {};

    const typeLabels = Object.keys(spendByType).filter(k => spendByType[k] > 0);
    const typeData = typeLabels.map(k => spendByType[k]);

    if (typeLabels.length > 0) {
      this._charts.type = new Chart(document.getElementById('budget-type-chart'), {
        type: 'bar',
        data: {
          labels: typeLabels,
          datasets: [{ data: typeData, backgroundColor: palette.slice(0, typeLabels.length), borderRadius: 4, borderWidth: 0 }]
        },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + H.formatCurrency(ctx.raw) } } },
          scales: {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
            y: { ticks: { color: textColor, callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) }, grid: { color: gridColor } }
          },
          responsive: true, maintainAspectRatio: true
        }
      });
    }

    const catData = [devSpend, licSpend, mntSpend, accSpend].filter(v => v > 0);
    const catLabels = ['Devices','Licences','Maintenance','Accessories'].filter((_, i) => [devSpend, licSpend, mntSpend, accSpend][i] > 0);
    if (catData.length > 0) {
      this._charts.cat = new Chart(document.getElementById('budget-cat-chart'), {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{ data: catData, backgroundColor: ['#3B82F6','#22C55E','#F59E0B','#8B5CF6'], borderWidth: 0, hoverOffset: 6 }]
        },
        options: {
          cutout: '60%',
          plugins: {
            legend: { position: 'right', labels: { color: textColor, font: { size: 11 }, padding: 10, boxWidth: 12 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${H.formatCurrency(ctx.raw)}` } }
          },
          responsive: true, maintainAspectRatio: true
        }
      });
    }

    const ageLabels = Object.keys(ageGroups);
    const ageData = Object.values(ageGroups);
    if (ageData.some(v => v > 0)) {
      this._charts.age = new Chart(document.getElementById('budget-age-chart'), {
        type: 'bar',
        data: {
          labels: ageLabels,
          datasets: [{ data: ageData, backgroundColor: ['#22C55E','#3B82F6','#F59E0B','#EF4444'], borderRadius: 4, borderWidth: 0 }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
            y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
          },
          responsive: true, maintainAspectRatio: true
        }
      });
    }

    if (sortedMonths.length > 0) {
      this._charts.mnt = new Chart(document.getElementById('budget-mnt-chart'), {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [{
            data: sortedMonths.map(m => mntByMonth[m] || 0),
            borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.1)',
            fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#F59E0B'
          }]
        },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + H.formatCurrency(ctx.raw) } } },
          scales: {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
            y: { ticks: { color: textColor, callback: v => '$' + v }, grid: { color: gridColor } }
          },
          responsive: true, maintainAspectRatio: true
        }
      });
    }
  }
};
