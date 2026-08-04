window.AuthPage = {
  init() {
    const form = document.getElementById('loginForm');
    if (form) {
      // Remove any existing listener
      form.replaceWith(form.cloneNode(true));
      const newForm = document.getElementById('loginForm');
      newForm.addEventListener('submit', this.handleLogin.bind(this));
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    
    const mobileInput = document.getElementById('loginMobile');
    const passwordInput = document.getElementById('loginPassword');
    const btn = document.getElementById('btnLogin');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    const mobile = mobileInput.value.trim();
    const password = passwordInput.value;

    if (!mobile || !password) {
      window.Toast.error('Please enter mobile number and password');
      return;
    }

    // UI Loading state
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';

    try {
      const response = await window.API.post('/api/auth/login', { mobile, password });
      
      if (response.token) {
        window.API.setToken(response.token);
        localStorage.setItem('user_role', response.role);
        localStorage.setItem('user_mobile', response.mobile);
        
        window.Toast.success('Login successful');
        
        document.getElementById('loginForm').reset();
        
        if (response.role === 'student') {
          window.App.navigate('student-dashboard');
        } else {
          // Connect SSE for teacher/admin dashboard updates
          window.SSE.connect();
          window.App.navigate('dashboard');
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      // API handler already triggers a Toast on fetch error
    } finally {
      btn.disabled = false;
      btnText.style.display = 'inline-block';
      btnLoader.style.display = 'none';
    }
  },

  logout() {
    window.API.clearToken();
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_mobile');
    window.SSE.disconnect();
    window.App.navigate('login');
    window.Toast.info('You have been logged out');
  }
};
