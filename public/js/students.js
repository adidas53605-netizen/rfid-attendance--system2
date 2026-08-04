window.StudentsPage = {
  initialized: false,
  currentPage: 1,
  limit: 10,
  searchTimeout: null,
  deleteId: null,

  init() {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.loadStudents(1);
  },

  bindEvents() {
    const searchInput = document.getElementById('studentSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.loadStudents(1, e.target.value);
        }, 300);
      };
    }

    const btnAdd = document.getElementById('btnAddStudent');
    if (btnAdd) {
      btnAdd.onclick = () => this.openModal();
    }

    const btnCloseModal = document.getElementById('closeStudentModal');
    const btnCancelForm = document.getElementById('cancelStudentForm');
    const closeForm = () => {
      document.getElementById('studentModal').style.display = 'none';
    };
    
    if (btnCloseModal) btnCloseModal.onclick = closeForm;
    if (btnCancelForm) btnCancelForm.onclick = closeForm;

    const form = document.getElementById('studentForm');
    if (form) {
      form.onsubmit = this.saveStudent.bind(this);
    }

    const closeDelete = () => {
      document.getElementById('deleteModal').style.display = 'none';
    };
    
    const closeDeleteBtn = document.getElementById('closeDeleteModal');
    if (closeDeleteBtn) closeDeleteBtn.onclick = closeDelete;
    
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    if (cancelDeleteBtn) cancelDeleteBtn.onclick = closeDelete;
    
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) confirmDeleteBtn.onclick = this.executeDelete.bind(this);
  },

  async loadStudents(page = 1, search = '') {
    this.currentPage = page;
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    
    try {
      const data = await window.API.get(`/api/students?page=${page}&limit=${this.limit}${searchParam}`);
      this.renderTable(data.records || []);
      this.renderPagination(data.total || 0, data.page || 1, data.totalPages || 1);
      
      const count = data.records ? data.records.length : 0;
      document.getElementById('studentsTableInfo').textContent = `Showing ${count} of ${data.total || 0} students`;
    } catch (err) {
      console.error('Failed to load students', err);
    }
  },

  renderTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;">No students found</td></tr>`;
      return;
    }

    const role = localStorage.getItem('user_role');

    tbody.innerHTML = students.map(s => {
      // Deleting is admin-only, editing is teacher/admin
      const deleteButton = role === 'admin' ? `
        <button class="btn btn-sm btn-danger" title="Delete" onclick="window.StudentsPage.confirmDelete(${s.id}, '${s.name.replace(/'/g, "\\'")}')" style="padding: 0.25rem 0.5rem; margin-left: 5px;">
          <i class="bi bi-trash"></i>
        </button>
      ` : '';

      return `
        <tr>
          <td><span class="badge badge-outline">${s.rfid_uid || 'N/A'}</span></td>
          <td style="font-weight:500;">${s.name || '--'}</td>
          <td>${s.roll_number || '--'}</td>
          <td><span class="profile-dept-badge">${s.department || '--'}</span></td>
          <td>Sem ${s.semester || '--'}</td>
          <td>Sec ${s.section || '--'}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-secondary" title="Edit" onclick="window.StudentsPage.openModal(${encodeURIComponent(JSON.stringify(s))})" style="padding: 0.25rem 0.5rem;">
              <i class="bi bi-pencil"></i>
            </button>
            ${deleteButton}
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPagination(total, page, totalPages) {
    const container = document.getElementById('studentsPagination');
    if (!container) return;

    let html = '';
    
    html += `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="window.StudentsPage.loadStudents(${page - 1}, document.getElementById('studentSearch').value)">
      <i class="bi bi-chevron-left"></i>
    </button>`;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="window.StudentsPage.loadStudents(${i}, document.getElementById('studentSearch').value)">${i}</button>`;
      } else if (i === page - 2 || i === page + 2) {
        html += `<span class="page-dots">...</span>`;
      }
    }

    html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="window.StudentsPage.loadStudents(${page + 1}, document.getElementById('studentSearch').value)">
      <i class="bi bi-chevron-right"></i>
    </button>`;

    container.innerHTML = html;
  },

  openModal(studentJson = null) {
    const modal = document.getElementById('studentModal');
    const form = document.getElementById('studentForm');
    const title = document.getElementById('studentModalTitle');
    
    form.reset();
    document.getElementById('studentFormId').value = '';
    
    if (studentJson) {
      try {
        const student = typeof studentJson === 'string' ? JSON.parse(decodeURIComponent(studentJson)) : studentJson;
        title.textContent = 'Edit Student';
        
        document.getElementById('studentFormId').value = student.id || '';
        document.getElementById('formRfidUid').value = student.rfid_uid || '';
        document.getElementById('formName').value = student.name || '';
        document.getElementById('formRoll').value = student.roll_number || '';
        document.getElementById('formRegNo').value = student.registration_number || '';
        document.getElementById('formDept').value = student.department || '';
        document.getElementById('formSemester').value = student.semester || '';
        document.getElementById('formSection').value = student.section || '';
        document.getElementById('formMobile').value = student.mobile || '';
        document.getElementById('formEmail').value = student.email || '';
        document.getElementById('formAddress').value = student.address || '';
        document.getElementById('formPhotoUrl').value = student.photo_url || '';
      } catch (e) {
        console.error('Error parsing student JSON', e);
      }
    } else {
      title.textContent = 'Add Student';
    }
    
    modal.style.display = 'flex';
  },

  async saveStudent(e) {
    e.preventDefault();
    
    const id = document.getElementById('studentFormId').value;
    
    const data = {
      rfid_uid: document.getElementById('formRfidUid').value.trim(),
      name: document.getElementById('formName').value.trim(),
      roll_number: document.getElementById('formRoll').value.trim(),
      registration_number: document.getElementById('formRegNo').value.trim() || null,
      department: document.getElementById('formDept').value,
      semester: document.getElementById('formSemester').value ? parseInt(document.getElementById('formSemester').value) : null,
      section: document.getElementById('formSection').value.trim() || null,
      mobile: document.getElementById('formMobile').value.trim(),
      email: document.getElementById('formEmail').value.trim() || null,
      address: document.getElementById('formAddress').value.trim() || null,
      photo_url: document.getElementById('formPhotoUrl').value.trim() || null
    };

    const btnSubmit = document.getElementById('submitStudentForm');
    btnSubmit.disabled = true;

    try {
      if (id) {
        await window.API.put(`/api/students/${id}`, data);
        window.Toast.success('Student updated successfully');
      } else {
        await window.API.post('/api/students', data);
        window.Toast.success('Student added successfully');
      }
      
      document.getElementById('studentModal').style.display = 'none';
      this.loadStudents(this.currentPage, document.getElementById('studentSearch').value);
    } catch (err) {
      console.error('Failed to save student', err);
    } finally {
      btnSubmit.disabled = false;
    }
  },

  confirmDelete(id, name) {
    this.deleteId = id;
    document.getElementById('deleteStudentName').textContent = name;
    document.getElementById('deleteModal').style.display = 'flex';
  },

  async executeDelete() {
    if (!this.deleteId) return;
    
    const btn = document.getElementById('confirmDelete');
    btn.disabled = true;
    
    try {
      await window.API.del(`/api/students/${this.deleteId}`);
      window.Toast.success('Student deleted successfully');
      document.getElementById('deleteModal').style.display = 'none';
      this.loadStudents(this.currentPage, document.getElementById('studentSearch').value);
    } catch (err) {
      console.error('Failed to delete student', err);
    } finally {
      btn.disabled = false;
      this.deleteId = null;
    }
  }
};
