/**
 * Export Manager
 * Handles CSV download and client-side PDF generation via browser print.
 */
window.ExportManager = {
  init() {
    const btnCsv = document.getElementById('btnExportCsv');
    if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());

    const btnPdf = document.getElementById('btnExportPdf');
    if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());
  },

  /**
   * Build filter query string from current attendance page filters
   */
  _getFilterQuery() {
    const params = new URLSearchParams();
    const from = document.getElementById('filterFrom');
    const to = document.getElementById('filterTo');
    const dept = document.getElementById('filterDept');
    if (from && from.value) params.set('from', from.value);
    if (to && to.value) params.set('to', to.value);
    if (dept && dept.value) params.set('department', dept.value);
    return params.toString();
  },

  /**
   * Export as CSV — direct file download
   */
  async exportCSV() {
    try {
      window.Toast.info('Preparing CSV download...');
      const qs = this._getFilterQuery();
      const url = `/api/export/csv${qs ? '?' + qs : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${window.API.getToken()}` },
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendance_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      window.Toast.success('CSV downloaded!');
    } catch (err) {
      window.Toast.error('Failed to export CSV');
    }
  },

  /**
   * Export as PDF — fetch data then open print-friendly popup
   */
  async exportPDF() {
    try {
      window.Toast.info('Generating PDF report...');
      const qs = this._getFilterQuery();
      const url = `/api/export/pdf${qs ? '?' + qs : ''}`;
      const data = await window.API.get(url);

      // Build a print-friendly HTML document
      const html = `
        <!DOCTYPE html>
        <html><head>
          <title>Attendance Report</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', Arial, sans-serif; padding: 20px; color: #1a1a1a; }
            h1 { font-size: 22px; text-align: center; margin-bottom: 5px; }
            .meta { text-align: center; color: #666; font-size: 12px; margin-bottom: 15px; }
            .filters { text-align: center; margin-bottom: 10px; font-size: 12px; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #4F46E5; color: white; padding: 8px 6px; text-align: left; }
            td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) td { background: #f8fafc; }
            .total { margin-top: 10px; text-align: right; font-size: 12px; color: #666; }
            @media print { body { padding: 0; } }
          </style>
        </head><body>
          <h1>📋 Attendance Report</h1>
          <p class="meta">Generated: ${new Date().toLocaleString()}</p>
          ${data.filters.from || data.filters.to || data.filters.department ?
            `<p class="filters">Filters: ${data.filters.from ? 'From ' + data.filters.from : ''} ${data.filters.to ? 'To ' + data.filters.to : ''} ${data.filters.department ? '| Dept: ' + data.filters.department : ''}</p>` : ''}
          <table>
            <thead><tr>
              <th>Date</th><th>Time</th><th>Name</th><th>Roll No</th>
              <th>Department</th><th>Semester</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${data.records.map(r => `<tr>
                <td>${r.date}</td><td>${r.time}</td><td>${r.name}</td>
                <td>${r.roll_number}</td><td>${r.department}</td>
                <td>${r.semester || '-'}</td><td>${r.status}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <p class="total">Total Records: ${data.totalRecords}</p>
          <script>window.onload = () => { window.print(); }</script>
        </body></html>
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();
      window.Toast.success('PDF report ready — use browser print dialog to save.');
    } catch (err) {
      window.Toast.error('Failed to generate PDF report');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  window.ExportManager.init();
});
