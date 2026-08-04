window.App = {
  pages: {
    dashboard: window.DashboardPage,
    students: window.StudentsPage,
    attendance: window.AttendancePage,
    teachers: window.TeachersPage,
    audit: window.AuditPage,
    'student-dashboard': window.StudentDashboardPage,
    login: window.AuthPage
  },

  async init() {
    this.bindEvents();
    
    window.addEventListener('hashchange', () => this.handleRouting());
    
    // Initial check
    const token = window.API.getToken();
    if (token) {
      try {
        const verify = await window.API.post('/api/auth/verify');
        if (verify.valid) {
          localStorage.setItem('user_role', verify.role);
          localStorage.setItem('user_mobile', verify.mobile);
          
          this.renderSidebar(verify.role);
          
          // Connect SSE for live updates if teacher/admin
          if (verify.role !== 'student') {
            window.SSE.connect();
          }
          
          if (!location.hash || location.hash === '#login') {
            if (verify.role === 'student') {
              this.navigate('student-dashboard');
            } else {
              this.navigate('dashboard');
            }
          } else {
            this.handleRouting();
          }
          return;
        }
      } catch (e) {
        window.API.clearToken();
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_mobile');
      }
    }
    
    // Default to login if no valid token
    this.navigate('login');
  },

  renderSidebar(role) {
    const nav = document.getElementById('sidebarNav');
    if (!nav) return;

    let html = '';
    if (role === 'student') {
      html = `
        <a href="#student-dashboard" class="nav-item" data-page="student-dashboard">
          <i class="bi bi-person-circle"></i> My Dashboard
        </a>
      `;
    } else if (role === 'teacher' || role === 'admin') {
      html = `
        <a href="#dashboard" class="nav-item" data-page="dashboard">
          <i class="bi bi-speedometer2"></i> Dashboard
        </a>
        <a href="#students" class="nav-item" data-page="students">
          <i class="bi bi-people"></i> Students
        </a>
        <a href="#attendance" class="nav-item" data-page="attendance">
          <i class="bi bi-calendar-check"></i> Attendance
        </a>
      `;
      if (role === 'admin') {
        html += `
          <a href="#teachers" class="nav-item" data-page="teachers">
            <i class="bi bi-person-badge"></i> Teachers
          </a>
          <a href="#audit" class="nav-item" data-page="audit">
            <i class="bi bi-shield-lock"></i> Audit Logs
          </a>
        `;
      }
    }
    nav.innerHTML = html;
    
    // Bind item click listeners for closing mobile sidebar
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('show');
          overlay.classList.remove('show');
        }
      });
    });
  },

  bindEvents() {
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (window.AuthPage) window.AuthPage.logout();
      });
    }

    const hamburger = document.getElementById('hamburger');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    const toggleSidebar = () => {
      sidebar.classList.toggle('show');
      overlay.classList.toggle('show');
    };

    if (hamburger) hamburger.addEventListener('click', toggleSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // Listen for SSE events
    window.addEventListener('rfid:attendance', (e) => {
      const role = localStorage.getItem('user_role');
      if (role !== 'student' && this.pages.dashboard && this.pages.dashboard.handleNewScan) {
        this.pages.dashboard.handleNewScan(e.detail);
      }
    });

    window.addEventListener('rfid:sync', (e) => {
      const pendingEl = document.getElementById('syncPending');
      if (pendingEl) {
        pendingEl.textContent = e.detail.pending || 0;
      }
    });
  },

  navigate(pageId) {
    location.hash = pageId;
  },

  handleRouting() {
    let hash = location.hash.replace('#', '') || 'login';
    const role = localStorage.getItem('user_role');
    
    // Auth guard
    if (hash !== 'login' && !window.API.getToken()) {
      this.navigate('login');
      return;
    }

    // Role-based route guard
    if (role === 'student' && hash !== 'student-dashboard' && hash !== 'login') {
      this.navigate('student-dashboard');
      return;
    }
    if ((role === 'teacher' || role === 'admin') && hash === 'student-dashboard') {
      this.navigate('dashboard');
      return;
    }
    if (role === 'teacher' && (hash === 'teachers' || hash === 'audit')) {
      this.navigate('dashboard');
      return;
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.style.display = 'none';
    });

    // Show target page
    const targetPage = document.getElementById(`page-${hash}`);
    if (targetPage) {
      targetPage.style.display = 'block';
      targetPage.style.animation = 'fadeIn 0.3s ease-in-out';
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === `#${hash}`) {
        item.classList.add('active');
      }
    });

    // Hide/show sidebar based on page
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('mobileHeader');
    
    if (hash === 'login') {
      if (sidebar) sidebar.style.display = 'none';
      if (header) header.style.display = 'none';
      document.body.style.marginLeft = '0';
      document.documentElement.style.setProperty('--sidebar-width', '0px');
    } else {
      if (sidebar) sidebar.style.display = 'flex';
      if (header) header.style.display = 'flex';
      document.documentElement.style.setProperty('--sidebar-width', '260px');
    }

    // Render sidebar link list if not login
    if (hash !== 'login' && role) {
      this.renderSidebar(role);
      // Re-apply active class to matching item
      document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') === `#${hash}`) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    // Initialize page controller
    if (this.pages[hash] && this.pages[hash].init) {
      this.pages[hash].init();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
