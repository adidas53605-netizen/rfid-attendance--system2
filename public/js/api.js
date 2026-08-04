window.API = {
  getToken() {
    return localStorage.getItem('jwt_token');
  },
  
  setToken(token) {
    localStorage.setItem('jwt_token', token);
  },
  
  clearToken() {
    localStorage.removeItem('jwt_token');
  },

  async request(method, url, body = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (response.status === 401 && url !== '/api/auth/login' && url !== '/api/auth/verify') {
        this.clearToken();
        if (window.AuthPage) window.AuthPage.logout();
        throw new Error('Unauthorized');
      }

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      if (window.Toast && error.message !== 'Unauthorized') {
        window.Toast.error(error.message);
      }
      throw error;
    }
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); }
};
