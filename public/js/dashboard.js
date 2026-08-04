window.DashboardPage = {
  initialized: false,
  audioContext: null,
  popupTimeout: null,

  init() {
    if (!this.initialized) {
      window.Charts.init();
      
      const btnRetrySync = document.getElementById('btnRetrySync');
      if (btnRetrySync) {
        btnRetrySync.onclick = async () => {
          window.Toast.info('Triggering Google Sheets sync retry...');
          try {
            const res = await window.API.post('/api/attendance/retry-sync');
            window.Toast.success(`Sync complete! Synced: ${res.synced || 0}, Failed: ${res.failed || 0}`);
            this.loadStats();
          } catch (err) {
            window.Toast.error('Sync retry failed');
          }
        };
      }

      const closePopup = document.getElementById('profileClose');
      if (closePopup) {
        closePopup.onclick = () => {
          document.getElementById('profilePopup').style.display = 'none';
        };
      }

      this.initialized = true;
    }

    this.loadStats();
    this.loadRecentFeed();
    this.loadCharts();
  },

  async loadStats() {
    try {
      const stats = await window.API.get('/api/dashboard/stats');
      this.animateValue('statTotalStudents', stats.totalStudents || 0);
      this.animateValue('statPresentToday', stats.presentToday || 0);
      this.animateValue('statAbsentToday', stats.absentToday || 0);
      this.animateValue('statTotalScans', stats.totalScans || 0);
      
      window.Charts.updateDonut(stats.presentToday || 0, stats.absentToday || 0);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  },

  async loadRecentFeed() {
    try {
      const data = await window.API.get('/api/dashboard/recent');
      const feed = document.getElementById('attendanceFeed');
      const empty = document.getElementById('feedEmpty');
      const count = document.getElementById('feedCount');

      if (data && data.length > 0) {
        if (empty) empty.style.display = 'none';
        feed.innerHTML = '';
        data.forEach(record => {
          feed.insertAdjacentHTML('beforeend', this.createFeedItemHtml(record));
        });
        if (count) count.textContent = `${data.length} scans recently`;
      } else {
        if (empty) empty.style.display = 'flex';
      }
    } catch (err) {
      console.error('Failed to load recent feed', err);
    }
  },

  async loadCharts() {
    try {
      const deptData = await window.API.get('/api/dashboard/department-stats');
      if (deptData && Array.isArray(deptData)) {
        const labels = deptData.map(d => d.department);
        const values = deptData.map(d => d.present_count);
        window.Charts.updateDepartment(labels, values);
      }

      const hourlyData = await window.API.get('/api/dashboard/hourly');
      if (hourlyData && Array.isArray(hourlyData)) {
        const labels = hourlyData.map(h => `${h.hour}:00`);
        const values = hourlyData.map(h => h.scan_count);
        window.Charts.updateHourly(labels, values);
      }
    } catch (err) {
      console.error('Failed to load charts', err);
    }
  },

  handleNewScan(data) {
    // 1. Update stats
    this.loadStats();
    
    // 2. Add to feed
    const feed = document.getElementById('attendanceFeed');
    const empty = document.getElementById('feedEmpty');
    
    if (empty) empty.style.display = 'none';
    
    const html = this.createFeedItemHtml(data);
    feed.insertAdjacentHTML('afterbegin', html);
    
    if (feed.children.length > 20) {
      feed.removeChild(feed.lastChild);
    }

    // 3. Show profile popup
    this.showProfilePopup(data);
    
    // 4. Play sound
    this.playSuccessBeep();
  },

  createFeedItemHtml(record) {
    const student = record.student || record;
    const attendance = record.attendance || record;

    const initials = student.name ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
    const time = attendance.time || '—';
    const status = attendance.status || 'present';
    const borderStyle = status === 'present' ? 'border-left: 3px solid var(--success)' : 'border-left: 3px solid var(--error)';

    return `
      <div class="feed-item slide-in" style="${borderStyle}">
        <div class="feed-avatar">${initials}</div>
        <div class="feed-content">
          <div class="feed-name">${student.name || 'Unknown'}</div>
          <div class="feed-meta">${student.roll_number || student.roll || '—'} • ${student.department || '—'}</div>
        </div>
        <div class="feed-time">${time}</div>
      </div>
    `;
  },

  showProfilePopup(data) {
    const popup = document.getElementById('profilePopup');
    if (!popup) return;

    const student = data.student || data;
    const attendance = data.attendance || data;
    
    const initials = student.name ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
    
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('profileName').textContent = student.name || 'Unknown Student';
    document.getElementById('profileDept').textContent = student.department || 'N/A';
    
    document.getElementById('profileRoll').textContent = student.roll_number || student.roll || '—';
    document.getElementById('profileReg').textContent = student.registration_number || student.regNo || '—';
    document.getElementById('profileSem').textContent = student.semester || '—';
    document.getElementById('profileSection').textContent = student.section || '—';
    document.getElementById('profileEmail').textContent = student.email || '—';
    document.getElementById('profileMobile').textContent = student.mobile || '—';
    
    const date = attendance.date || '';
    const time = attendance.time || '';
    document.getElementById('profileLastScan').textContent = date && time ? `${date} ${time}` : 'Just Now';

    popup.style.display = 'flex';
    
    // Auto hide
    if (this.popupTimeout) clearTimeout(this.popupTimeout);
    this.popupTimeout = setTimeout(() => {
      popup.style.display = 'none';
    }, 8000);
  },

  playSuccessBeep() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  },

  animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    const start = parseInt(obj.textContent) || 0;
    if (start === end) return;
    
    const duration = 1000;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      obj.innerHTML = Math.floor(easeProgress * (end - start) + start);
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        obj.innerHTML = end;
      }
    };
    window.requestAnimationFrame(step);
  }
};
