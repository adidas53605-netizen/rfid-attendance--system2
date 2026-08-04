window.TeachersPage = {
  teachers: [],

  init() {
    this.loadTeachers();
    this.bindEvents();
  },

  async loadTeachers() {
    try {
      const data = await window.API.get('/api/teachers');
      this.teachers = data || [];
      this.renderTeachers();
    } catch (err) {
      window.Toast.error('Failed to load teacher accounts');
    }
  },

  bindEvents() {
    const btnAdd = document.getElementById('btnAddTeacher');
    const modal = document.getElementById('teacherModal');
    const closeBtn = document.getElementById('closeTeacherModal');
    const cancelBtn = document.getElementById('cancelTeacherForm');
    const form = document.getElementById('teacherForm');

    if (btnAdd) btnAdd.onclick = () => modal.style.display = 'flex';
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const mobile = document.getElementById('formTeacherMobile').value.trim();
        const password = document.getElementById('formTeacherPassword').value;

        if (!mobile || !password) return;

        try {
          await window.API.post('/api/teachers', { mobile, password });
          window.Toast.success('Teacher account created successfully');
          modal.style.display = 'none';
          form.reset();
          this.loadTeachers();
        } catch (err) {
          // Toast shows from API helper
        }
      };
    }
  },

  renderTeachers() {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;

    if (this.teachers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No teacher accounts found
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.teachers.map(t => {
      const checked = t.active_status === 1 ? 'checked' : '';
      const statusLabel = t.active_status === 1 ? 'Active' : 'Inactive';
      const statusClass = t.active_status === 1 ? 'status-badge status-badge-active' : 'status-badge status-badge-inactive';
      
      return `
        <tr>
          <td>${t.id}</td>
          <td>${t.mobile}</td>
          <td>${t.role.toUpperCase()}</td>
          <td>
            <span class="${statusClass}" id="badge-status-${t.id}">${statusLabel}</span>
          </td>
          <td>${new Date(t.created_at).toLocaleDateString()}</td>
          <td class="table-actions">
            <label class="toggle-switch-sm">
              <input type="checkbox" ${checked} onchange="window.TeachersPage.toggleStatus(${t.id}, this.checked)">
              <span class="toggle-slider-sm"></span>
            </label>
            <button class="btn btn-sm btn-danger" onclick="window.TeachersPage.deleteTeacher(${t.id})" style="padding: 0.25rem 0.5rem; margin-left: 10px;">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async toggleStatus(id, active) {
    try {
      const active_status = active ? 1 : 0;
      await window.API.put(`/api/teachers/${id}/status`, { active_status });
      
      const badge = document.getElementById(`badge-status-${id}`);
      if (badge) {
        badge.textContent = active ? 'Active' : 'Inactive';
        badge.className = active ? 'status-badge status-badge-active' : 'status-badge status-badge-inactive';
      }
      window.Toast.success('Teacher status updated');
    } catch (err) {
      this.loadTeachers(); // Reset checkbox
    }
  },

  async deleteTeacher(id) {
    if (!confirm('Are you sure you want to delete this teacher account?')) return;

    try {
      await window.API.del(`/api/teachers/${id}`);
      window.Toast.success('Teacher account deleted');
      this.loadTeachers();
    } catch (err) {
      // Toast shows from API helper
    }
  }
};
