window.Charts = {
  instances: {},
  colors: {
    indigo: '#4F46E5',
    emerald: '#10B981',
    rose: '#F43F5E',
    amber: '#F59E0B',
    info: '#3B82F6'
  },

  init() {
    this.registerThemeListener();
    this.setupDefaults();
    
    // Initialize with empty data
    this.instances.donut = this.createDonutChart('attendanceDonut');
    this.instances.department = this.createBarChart('departmentChart');
    this.instances.hourly = this.createLineChart('hourlyChart');
  },

  setupDefaults() {
    Chart.defaults.font.family = 'Inter, sans-serif';
    this.updateThemeColors();
  },

  updateThemeColors() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94A3B8' : '#475569';
    const gridColor = isDark ? '#334155' : '#E2E8F0';

    Chart.defaults.color = textColor;
    Chart.defaults.scale.grid.color = gridColor;
  },

  registerThemeListener() {
    window.addEventListener('themeChanged', () => {
      this.updateThemeColors();
      Object.values(this.instances).forEach(chart => {
        if (chart) {
          chart.options.scales?.x?.grid && (chart.options.scales.x.grid.color = Chart.defaults.scale.grid.color);
          chart.options.scales?.y?.grid && (chart.options.scales.y.grid.color = Chart.defaults.scale.grid.color);
          chart.update();
        }
      });
    });
  },

  createDonutChart(id) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Absent'],
        datasets: [{
          data: [0, 0],
          backgroundColor: [this.colors.emerald, this.colors.rose],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  },

  createBarChart(id) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Attendance Rate %',
          data: [],
          backgroundColor: this.colors.indigo,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  },

  createLineChart(id) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Scans',
          data: [],
          borderColor: this.colors.info,
          backgroundColor: `${this.colors.info}33`,
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  },

  updateDonut(present, absent) {
    if (this.instances.donut) {
      this.instances.donut.data.datasets[0].data = [present, absent];
      this.instances.donut.update();
    }
  },

  updateDepartment(labels, values) {
    if (this.instances.department) {
      this.instances.department.data.labels = labels;
      this.instances.department.data.datasets[0].data = values;
      this.instances.department.update();
    }
  },

  updateHourly(labels, values) {
    if (this.instances.hourly) {
      this.instances.hourly.data.labels = labels;
      this.instances.hourly.data.datasets[0].data = values;
      this.instances.hourly.update();
    }
  }
};
