const os = require('os');
const SystemMetric = require('../models/SystemMetric');

// Store reference metrics to calculate rates
let lastMetrics = {
  timestamp: Date.now(),
  requestCount: 0,
  errorCount: 0,
  errorMap: {}
};

// Store active user sessions
const activeSessions = new Map();

// Record a user session
const recordUserSession = (userId, sessionId) => {
  activeSessions.set(sessionId, {
    userId,
    lastActivity: Date.now()
  });
};

// Remove a user session
const removeUserSession = (sessionId) => {
  activeSessions.delete(sessionId);
};

// Update user activity
const updateUserActivity = (sessionId) => {
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    session.lastActivity = Date.now();
    activeSessions.set(sessionId, session);
  }
};

// Get active user count
const getActiveUserCount = () => {
  // Consider sessions active if there was activity in the last 15 minutes
  const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
  let activeCount = 0;
  
  activeSessions.forEach(session => {
    if (session.lastActivity > fifteenMinutesAgo) {
      activeCount++;
    }
  });
  
  return activeCount;
};

// Record a request
const recordRequest = (responseTime) => {
  lastMetrics.requestCount++;
  
  if (responseTime) {
    if (!lastMetrics.totalResponseTime) {
      lastMetrics.totalResponseTime = 0;
      lastMetrics.responseCount = 0;
    }
    
    lastMetrics.totalResponseTime += responseTime;
    lastMetrics.responseCount++;
  }
};

// Record an error
const recordError = (errorType) => {
  lastMetrics.errorCount++;
  
  if (!lastMetrics.errorMap[errorType]) {
    lastMetrics.errorMap[errorType] = {
      count: 0,
      lastOccurred: new Date()
    };
  }
  
  lastMetrics.errorMap[errorType].count++;
  lastMetrics.errorMap[errorType].lastOccurred = new Date();
};

// Collect system metrics
const collectSystemMetrics = async () => {
  try {
    // Calculate time difference since last collection
    const now = Date.now();
    const timeDiffMinutes = (now - lastMetrics.timestamp) / 1000 / 60;
    
    // Get system information
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;
    
    // Calculate CPU usage average across all cores
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idlePercent = totalIdle / totalTick * 100;
    const cpuUsagePercent = 100 - idlePercent;
    
    // Calculate requests per minute
    const requestsPerMinute = lastMetrics.requestCount / timeDiffMinutes;
    
    // Calculate average response time
    const averageResponseTime = lastMetrics.responseCount ?
      lastMetrics.totalResponseTime / lastMetrics.responseCount : 0;

    // Get disk usage (mock for now, would need a proper library like 'diskusage' for exact values)
    const diskUsage = 70; // 70% used (placeholder)
    const totalDisk = 1000000; // 1 TB (placeholder)
      
    // Format error details for storage
    const errorDetails = Object.keys(lastMetrics.errorMap).map(type => ({
      errorType: type,
      count: lastMetrics.errorMap[type].count,
      lastOccurred: lastMetrics.errorMap[type].lastOccurred
    }));
    
    // Create new metric
    const metric = new SystemMetric({
      timestamp: now,
      cpuUsage: parseFloat(cpuUsagePercent.toFixed(2)),
      memoryUsage: parseFloat(memUsagePercent.toFixed(2)),
      totalMemory: totalMem,
      diskUsage: diskUsage,
      totalDisk: totalDisk,
      activeUsers: getActiveUserCount(),
      requestsPerMinute: parseFloat(requestsPerMinute.toFixed(2)),
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      errorCount: lastMetrics.errorCount,
      errorDetails: errorDetails,
      systemUptime: os.uptime()
    });
    
    // Save metric to database
    await metric.save();
    console.log(`System metrics saved at ${new Date().toISOString()}`);
    
    // Reset metrics for next interval
    lastMetrics = {
      timestamp: now,
      requestCount: 0,
      errorCount: 0,
      errorMap: {},
      totalResponseTime: 0,
      responseCount: 0
    };
    
    return metric;
  } catch (error) {
    console.error('Error collecting system metrics:', error);
    throw error;
  }
};

// Get latest metrics
const getLatestMetrics = async () => {
  try {
    return await SystemMetric.getLatestMetrics(1);
  } catch (error) {
    console.error('Error fetching latest metrics:', error);
    throw error;
  }
};

// This would typically be called by a scheduled job
const startMetricsCollection = (intervalMinutes = 5) => {
  console.log(`Starting system metrics collection every ${intervalMinutes} minutes`);
  setInterval(collectSystemMetrics, intervalMinutes * 60 * 1000);
};

module.exports = {
  recordUserSession,
  removeUserSession,
  updateUserActivity,
  recordRequest,
  recordError,
  collectSystemMetrics,
  getLatestMetrics,
  startMetricsCollection
}; 