const mongoose = require('mongoose');

const systemMetricSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  cpuUsage: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  memoryUsage: {
    type: Number,
    required: true
  },
  totalMemory: {
    type: Number,
    required: true
  },
  diskUsage: {
    type: Number,
    required: true
  },
  totalDisk: {
    type: Number,
    required: true
  },
  activeUsers: {
    type: Number,
    default: 0
  },
  requestsPerMinute: {
    type: Number,
    default: 0
  },
  averageResponseTime: {
    type: Number,
    default: 0
  },
  errorCount: {
    type: Number,
    default: 0
  },
  errorDetails: [{
    errorType: String,
    count: Number,
    lastOccurred: Date
  }],
  systemUptime: {
    type: Number,
    required: true
  }
}, { timestamps: true });

// Indexes for faster querying
systemMetricSchema.index({ timestamp: -1 });
systemMetricSchema.index({ 'errorDetails.errorType': 1 });

systemMetricSchema.statics.getLatestMetrics = async function(limit = 60) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit);
};

systemMetricSchema.statics.getDailyAverages = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$timestamp" },
          month: { $month: "$timestamp" },
          day: { $dayOfMonth: "$timestamp" }
        },
        avgCpuUsage: { $avg: "$cpuUsage" },
        avgMemoryUsage: { $avg: "$memoryUsage" },
        avgActiveUsers: { $avg: "$activeUsers" },
        avgResponseTime: { $avg: "$averageResponseTime" },
        totalErrors: { $sum: "$errorCount" },
        count: { $sum: 1 }
      }
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
        "_id.day": 1
      }
    }
  ]);
};

module.exports = mongoose.model('SystemMetric', systemMetricSchema); 