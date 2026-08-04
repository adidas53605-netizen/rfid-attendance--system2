window.Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 5000) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'bi-info-circle';
    if (type === 'success') icon = 'bi-check-circle';
    else if (type === 'error') icon = 'bi-x-circle';
    else if (type === 'warning') icon = 'bi-exclamation-triangle';

    toast.innerHTML = `
      <div class="toast-icon"><i class="bi ${icon}"></i></div>
      <div class="toast-content">${message}</div>
      <button class="toast-close"><i class="bi bi-x-lg"></i></button>
      <div class="toast-progress"></div>
    `;

    this.container.appendChild(toast);
    
    const progress = toast.querySelector('.toast-progress');
    progress.style.animationDuration = `${duration}ms`;

    const closeBtn = toast.querySelector('.toast-close');
    let timeout;

    const remove = () => {
      toast.classList.add('toast-hide');
      setTimeout(() => {
        if (toast.parentNode === this.container) {
          this.container.removeChild(toast);
        }
      }, 300);
      clearTimeout(timeout);
    };

    closeBtn.addEventListener('click', remove);
    timeout = setTimeout(remove, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};

document.addEventListener('DOMContentLoaded', () => window.Toast.init());
