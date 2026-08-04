window.StudentDashboardPage = {
  student: null,
  records: [],

  async init() {
    await this.loadProfile();
    await this.loadAttendance();
  },

  async loadProfile() {
    try {
      const data = await window.API.get('/api/students/profile');
      this.student = data;
      this.renderProfile();
    } catch (err) {
      window.Toast.error('Failed to load profile information');
    }
  },

  async loadAttendance() {
    try {
      // Fetch all records for the student (limit high enough to get total counts)
      const data = await window.API.get('/api/attendance/history?limit=100');
      this.records = data.records || [];
      this.renderAttendance(this.records);
      this.calculateStats(data.total || this.records.length);
    } catch (err) {
      window.Toast.error('Failed to load attendance logs');
    }
  },

  renderProfile() {
    if (!this.student) return;

    // Set Name & initials photo
    document.getElementById('studentProfileName').textContent = this.student.name;
    const deptEl = document.getElementById('studentProfileDept');
    deptEl.textContent = this.student.department;
    
    const initials = this.student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const photoEl = document.getElementById('studentProfilePhoto');
    if (this.student.photo_url) {
      photoEl.innerHTML = `<img src="${this.student.photo_url}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      photoEl.textContent = initials;
    }

    // Info grid
    document.getElementById('studentProfileRoll').textContent = this.student.roll_number || '—';
    document.getElementById('studentProfileReg').textContent = this.student.registration_number || '—';
    document.getElementById('studentProfileSem').textContent = this.student.semester || '—';
    document.getElementById('studentProfileSection').textContent = this.student.section || '—';
    document.getElementById('studentProfileMobile').textContent = this.student.mobile || '—';
    document.getElementById('studentProfileEmail').textContent = this.student.email || '—';
    
    // Mask RFID UID (e.g. A1B2C3D4 -> A1******)
    const rfid = this.student.rfid_uid || '';
    const maskedRfid = rfid.length > 2 ? rfid.slice(0, 2) + '*'.repeat(rfid.length - 2) : rfid;
    document.getElementById('studentProfileRfid').textContent = maskedRfid || '—';
  },

  renderAttendance(records) {
    const tbody = document.getElementById('studentHistoryTableBody');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <i class="bi bi-calendar-x" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
            No attendance records found
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = records.map(r => {
      const statusClass = r.status === 'present' ? 'status-badge status-badge-active' : 'status-badge status-badge-inactive';
      return `
        <tr>
          <td>${r.date}</td>
          <td>${r.time}</td>
          <td><span class="${statusClass}">${r.status.toUpperCase()}</span></td>
          <td>${r.device_id || 'RFID'}</td>
        </tr>
      `;
    }).join('');
  },

  calculateStats(totalScans) {
    // For simplicity, let's treat total scans today as attended classes, or let's assume a dummy denominator (e.g. 50 classes total)
    // Actually, let's calculate attendance percentage: total present scans vs overall present scans in the history.
    // If student scans, we count present vs absent records.
    const attended = this.records.filter(r => r.status === 'present').length;
    // Assume a benchmark total classes count of 45 for percentage representation, or present / total scans.
    // If we have total scans = attended + absent, let's calculate based on that. If total is 0, percentage is 0.
    const total = this.records.length;
    const percentage = total > 0 ? Math.round((attended / total) * 100) : 100;

    document.getElementById('studentTotalClasses').textContent = total;
    document.getElementById('studentAttendedClasses').textContent = attended;
    document.getElementById('studentAttendancePercentage').textContent = `${percentage}%`;

    // Progress Ring Draw
    const ring = document.getElementById('studentProgressRing');
    if (ring) {
      const radius = ring.r.baseVal.value;
      const circumference = 2 * Math.PI * radius;
      ring.style.strokeDasharray = `${circumference} ${circumference}`;
      
      const offset = circumference - (percentage / 100) * circumference;
      ring.style.strokeDashoffset = offset;
    }
  }
};
