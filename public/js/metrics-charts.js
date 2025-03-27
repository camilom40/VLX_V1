/**
 * System Metrics Dashboard Charts
 * This file contains the JavaScript code for initializing and managing charts
 * in the system metrics dashboard.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Get metrics data from the data attributes
  const container = document.getElementById('metricsDataContainer');
  
  // Parse the JSON data from data attributes
  const currentMetric = JSON.parse(container.dataset.currentMetric || '{}');
  const last24Hours = JSON.parse(container.dataset.last24Hours || '[]');
  const mostActiveUsers = JSON.parse(container.dataset.mostActiveUsers || '[]');

  // Gauge configuration
  const gaugeConfig = {
    type: 'doughnut',
    options: {
      cutout: '70%',
      responsive: true,
      maintainAspectRatio: false,
      circumference: 180,
      rotation: 270,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    }
  };
    
  // Helper function to determine gauge color based on value
  const getGaugeColor = (value) => {
    if (value > 80) return '#ef4444'; // red
    if (value > 60) return '#f59e0b'; // yellow/orange
    return '#10b981'; // green
  };

  // Create CPU gauge
  const cpuGauge = new Chart(document.getElementById('cpuGauge'), {
    ...gaugeConfig,
    data: {
      datasets: [{
        data: [
          currentMetric.cpuUsage || 0,
          (currentMetric.cpuUsage) ? 100 - currentMetric.cpuUsage : 100
        ],
        backgroundColor: [
          getGaugeColor(currentMetric.cpuUsage || 0),
          '#e5e7eb'
        ],
        borderWidth: 0
      }]
    }
  });
    
  // Create Memory gauge
  const memoryGauge = new Chart(document.getElementById('memoryGauge'), {
    ...gaugeConfig,
    data: {
      datasets: [{
        data: [
          currentMetric.memoryUsage || 0,
          (currentMetric.memoryUsage) ? 100 - currentMetric.memoryUsage : 100
        ],
        backgroundColor: [
          getGaugeColor(currentMetric.memoryUsage || 0),
          '#e5e7eb'
        ],
        borderWidth: 0
      }]
    }
  });
    
  // Create Disk gauge
  const diskGauge = new Chart(document.getElementById('diskGauge'), {
    ...gaugeConfig,
    data: {
      datasets: [{
        data: [
          currentMetric.diskUsage || 0,
          (currentMetric.diskUsage) ? 100 - currentMetric.diskUsage : 100
        ],
        backgroundColor: [
          getGaugeColor(currentMetric.diskUsage || 0),
          '#e5e7eb'
        ],
        borderWidth: 0
      }]
    }
  });
    
  // Create Users gauge (scale differently)
  const usersGauge = new Chart(document.getElementById('usersGauge'), {
    ...gaugeConfig,
    data: {
      datasets: [{
        data: [
          currentMetric.activeUsers || 0,
          (currentMetric.activeUsers) ? Math.max(20 - currentMetric.activeUsers, 0) : 20
        ],
        backgroundColor: [
          '#3b82f6',
          '#e5e7eb'
        ],
        borderWidth: 0
      }]
    }
  });
    
  // Prepare data for Resources Chart (CPU & Memory)
  const resourcesLabels = last24Hours.map(metric => 
    new Date(metric.timestamp).toLocaleTimeString()
  );
  
  const cpuData = last24Hours.map(metric => metric.cpuUsage);
  const memoryData = last24Hours.map(metric => metric.memoryUsage);
    
  const resourcesData = {
    labels: resourcesLabels,
    datasets: [
      {
        label: 'CPU Usage (%)',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        data: cpuData,
        tension: 0.4,
        fill: true
      },
      {
        label: 'Memory Usage (%)',
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        data: memoryData,
        tension: 0.4,
        fill: true
      }
    ]
  };
    
  const resourcesChart = new Chart(document.getElementById('resourcesChart'), {
    type: 'line',
    data: resourcesData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  });
    
  // Prepare data for Requests & Response Time Chart
  const requestsPerMinute = last24Hours.map(metric => metric.requestsPerMinute);
  const responseTime = last24Hours.map(metric => metric.averageResponseTime);
    
  const requestsData = {
    labels: resourcesLabels,
    datasets: [
      {
        label: 'Requests/Min',
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        data: requestsPerMinute,
        tension: 0.4,
        fill: true,
        yAxisID: 'y'
      },
      {
        label: 'Avg Response Time (ms)',
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        data: responseTime,
        tension: 0.4,
        fill: true,
        yAxisID: 'y1'
      }
    ]
  };
    
  const requestsChart = new Chart(document.getElementById('requestsChart'), {
    type: 'line',
    data: requestsData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Requests/Min'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Response Time (ms)'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
    
  // Prepare data for Active Users Chart
  const usernames = mostActiveUsers.map(user => user.username);
  const activityCounts = mostActiveUsers.map(user => user.activityCount);
    
  const activeUsersData = {
    labels: usernames,
    datasets: [{
      label: 'Activity Count',
      backgroundColor: [
        '#3b82f6',
        '#10b981',
        '#f97316',
        '#8b5cf6',
        '#ef4444'
      ],
      data: activityCounts
    }]
  };
    
  const activeUsersChart = new Chart(document.getElementById('activeUsersChart'), {
    type: 'bar',
    data: activeUsersData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
    
  // Auto-refresh every 30 seconds
  setInterval(function() {
    fetch('/admin/metrics/api/latest')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data) {
          const metric = data.data;
            
          // Update gauge charts
          cpuGauge.data.datasets[0].data = [metric.cpuUsage, 100 - metric.cpuUsage];
          memoryGauge.data.datasets[0].data = [metric.memoryUsage, 100 - metric.memoryUsage];
          diskGauge.data.datasets[0].data = [metric.diskUsage, 100 - metric.diskUsage];
          usersGauge.data.datasets[0].data = [metric.activeUsers, Math.max(20 - metric.activeUsers, 0)];
            
          // Update gauge colors based on thresholds
          cpuGauge.data.datasets[0].backgroundColor[0] = getGaugeColor(metric.cpuUsage);
          memoryGauge.data.datasets[0].backgroundColor[0] = getGaugeColor(metric.memoryUsage);
          diskGauge.data.datasets[0].backgroundColor[0] = getGaugeColor(metric.diskUsage);
            
          // Update gauge values in DOM
          document.querySelector('#cpuGauge + .gauge-value').textContent = metric.cpuUsage.toFixed(1) + '%';
          document.querySelector('#memoryGauge + .gauge-value').textContent = metric.memoryUsage.toFixed(1) + '%';
          document.querySelector('#diskGauge + .gauge-value').textContent = metric.diskUsage.toFixed(1) + '%';
          document.querySelector('#usersGauge + .gauge-value').textContent = metric.activeUsers;
            
          // Update charts
          cpuGauge.update();
          memoryGauge.update();
          diskGauge.update();
          usersGauge.update();
        }
      })
      .catch(error => console.error('Error fetching latest metrics:', error));
  }, 30000);
}); 