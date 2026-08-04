/**
 * Socket.IO Real-time Client
 * Subscribes to real-time events from the backend server.
 */
window.SSE = { // Keep window.SSE name for backward-compatibility with app.js router connect/disconnect commands
  socket: null,
  reconnectAttempts: 0,

  connect() {
    if (this.socket && this.socket.connected) return;

    const token = window.API.getToken();
    if (!token) return;

    // Connect using Socket.IO client library
    this.socket = io({
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.updateStatus(true);
      console.log('Socket.IO connection established successfully.');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
      this.updateStatus(false);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.updateStatus(false);
    });

    // Listen for live attendance scan events
    this.socket.on('attendance:scan', (record) => {
      console.log('Live scan event received via Socket.IO:', record);
      // Dispatch custom DOM event to match app.js handler wireframe
      const event = new CustomEvent('rfid:attendance', { detail: record });
      window.dispatchEvent(event);
    });

    // Listen for Google Sheets status updates
    this.socket.on('sync_status', (data) => {
      const event = new CustomEvent('rfid:sync', { detail: data });
      window.dispatchEvent(event);
    });
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.updateStatus(false);
  },

  updateStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    if (connected) {
      statusEl.className = 'connection-status';
      statusEl.style.color = 'var(--success)';
      statusEl.innerHTML = '<span class="status-dot" style="background-color: var(--success);"></span> Connected';
    } else {
      statusEl.className = 'connection-status';
      statusEl.style.color = 'var(--error)';
      statusEl.innerHTML = '<span class="status-dot" style="background-color: var(--error);"></span> Disconnected';
    }
  }
};
