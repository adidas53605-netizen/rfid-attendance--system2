window.ThemeManager = {
  init() {
    this.toggleCheckbox = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme');
    
    let currentTheme = 'dark'; // Default
    if (savedTheme) {
      currentTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      currentTheme = 'light';
    }

    this.setTheme(currentTheme);

    if (this.toggleCheckbox) {
      this.toggleCheckbox.checked = currentTheme === 'dark';
      this.toggleCheckbox.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        this.setTheme(newTheme);
      });
    }
  },

  setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
  }
};

document.addEventListener('DOMContentLoaded', () => window.ThemeManager.init());
