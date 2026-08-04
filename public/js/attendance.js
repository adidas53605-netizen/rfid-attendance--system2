window.AttendancePage = {
  initialized: false,
  currentPage: 1,
  limit: 15,

  init() {
    if (!this.initialized) {
      this.setDefaultDates();
      this.bindEvents();
      this.initialized = true;
    }
    this.loadHistory(1);
    this.loadStudentsForManualMark();
  },

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterFrom').value = today;
    document.getElementById('filterTo').value = today;
  },

  bindEvents() {
    const btnApply = document.getElementById('btnApplyFilters');
    if (btnApply) {
      btnApply.onclick = () => this.loadHistory(1);
    }

    // Manual Mark Modal Events
    const btnManualMark = document.getElementById('btnManualMark');
    const modal = document.getElementById('manualMarkModal');
    const closeBtn = document.getElementById('closeManualMarkModal');
    const cancelBtn = document.getElementById('cancelManualMark');
    const form = document.getElementById('manualMarkForm');

    // Only Admin & Teacher see the manual mark button
    const role = localStorage.getItem('user_role');
    if (btnManualMark) {
      if (role === 'admin' || role === 'teacher') {
        btnManualMark.style.display = 'inline-flex';
        btnManualMark.onclick = () => {
          modal.style.display = 'flex';
          // Set default date/time in form
          document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
          document.getElementById('manualTime').value = new Date().toTimeString().split(' ')[0].slice(0, 5);
        };
      } else {
        btnManualMark.style.display = 'none';
      }
    }

    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const student_id = document.getElementById('manualStudentSelect').value;
        const date = document.getElementById('manualDate').value;
        const time = document.getElementById('manualTime').value + ':00';
        const status = document.getElementById('manualStatus').value;

        if (!student_id || !date || !time) return;

        try {
          await window.API.post('/api/attendance/manual', { student_id, date, time, status });
          window.Toast.success('Attendance marked successfully');
          modal.style.display = 'none';
          form.reset();
          this.loadHistory(1);
        } catch (err) {
          // Toast shows from API helper
        }
      };
    }
  },

  async loadStudentsForManualMark() {
    const select = document.getElementById('manualStudentSelect');
    if (!select) return;

    try {
      const data = await window.API.get('/api/students?limit=200');
      const students = data.records || [];
      
      select.innerHTML = '<option value="">Select Student</option>' + 
        students.map(s => `<option value="${s.id}">${s.name} (${s.roll_number})</option>`).join('');
    } catch (err) {
      console.error('Failed to load student options', err);
    }
  },

  getFilterParams() {
    const from = document.getElementById('filterFrom').value;
    const to = document.getElementById('filterTo').value;
    const dept = document.getElementById('filterDept').value;
    const search = document.getElementById('filterSearch').value;

    let params = [];
    if (from) params.push(`from=${encodeURIComponent(from)}`);
    if (to) params.push(`to=${encodeURIComponent(to)}`);
    if (dept) params.push(`department=${encodeURIComponent(dept)}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);

    return params.join('&');
  },

  async loadHistory(page = 1) {
    this.currentPage = page;
    
    let url = `/api/attendance/history?page=${page}&limit=${this.limit}`;
    const filters = this.getFilterParams();
    if (filters) {
      url += `&${filters}`;
    }

    try {
      const data = await window.API.get(url);
      this.renderTable(data.records || []);
      this.renderPagination(data.total || 0, data.page || 1, data.totalPages || 1);
      
      document.getElementById('attendanceTableInfo').textContent = `Showing ${data.records?.length || 0} of ${data.total || 0} records`;
    } catch (err) {
      console.error('Failed to load attendance history', err);
    }
  },

  renderTable(records) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;">No attendance records found</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => {
      const statusClass = r.status === 'present' ? 'status-badge status-badge-active' : 'status-badge status-badge-inactive';
      
      return `
        <tr>
          <td style="white-space:nowrap;">${r.date}</td>
          <td style="white-space:nowrap;font-weight:500;">${r.time}</td>
          <td>${r.name || '--'}</td>
          <td>${r.roll_number || '--'}</td>
          <td><span class="profile-dept-badge">${r.department || '--'}</span></td>
          <td>${r.semester || '--'}</td>
          <td><span class="${statusClass}">${r.status.toUpperCase()}</span></td>
          <td><span style="font-size:0.85em;color:var(--text-muted);">${r.device_id || 'Reader'}</span></td>
        </tr>
      `;
    }).join('');
  },

  renderPagination(total, page, totalPages) {
    const container = document.getElementById('attendancePagination');
    if (!container) return;

    let html = '';
    
    html += `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="window.AttendancePage.loadHistory(${page - 1})">
      <i class="bi bi-chevron-left"></i>
    </button>`;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="window.AttendancePage.loadHistory(${i})">${i}</button>`;
      } else if (i === page - 3 || i === page + 3) {
        html += `<span class="page-dots">...</span>`;
      }
    }

    html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="window.AttendancePage.loadHistory(${page + 1})">
      <i class="bi bi-chevron-right"></i>
    </button>`;

    container.innerHTML = html;
  }
};
