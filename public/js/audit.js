window.AuditPage = {
  logs: [],

  init() {
    this.loadLogs();
  },

  async loadLogs() {
    try {
      const data = await window.API.get('/api/audit-logs');
      this.logs = data || [];
      this.renderLogs();
    } catch (err) {
      window.Toast.error('Failed to load system audit logs');
    }
  },

  renderLogs() {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;

    if (this.logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No audit logs recorded
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.logs.map(l => {
      const time = new Date(l.created_at).toLocaleString();
      const mobile = l.mobile || 'SYSTEM';
      const roleBadge = l.role ? `<span class="badge" style="font-size:0.75rem; background: var(--bg-tertiary);">${l.role.toUpperCase()}</span>` : '—';
      
      let detailsHtml = '';
      if (l.details) {
        try {
          const parsed = JSON.parse(l.details);
          detailsHtml = `<div class="audit-details-json">${JSON.stringify(parsed)}</div>`;
        } catch (e) {
          detailsHtml = `<span style="font-size: 0.8125rem;">${l.details}</span>`;
        }
      }

      return `
        <tr>
          <td style="white-space: nowrap;">${time}</td>
          <td><strong>${mobile}</strong></td>
          <td>${roleBadge}</td>
          <td><span style="font-weight: 500; color: var(--text-primary);">${l.action}</span></td>
          <td>${detailsHtml}</td>
        </tr>
      `;
    }).join('');
  }
};
