const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  activityType: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'project_create',
      'project_edit',
      'project_delete',
      'quote_generate',
      'settings_change', 
      'window_system_view',
      'admin_action',
      'password_change',
      'user_create',
      'user_edit',
      'user_delete',
      'export_data',
      'other'
    ]
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  resourceType: {
    type: String,
    enum: ['project', 'user', 'window', 'setting', null],
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  },
  successful: {
    type: Boolean,
    default: true
  },
  failureReason: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Indexes for faster querying
userActivitySchema.index({ timestamp: -1 });
userActivitySchema.index({ userId: 1, timestamp: -1 });
userActivitySchema.index({ activityType: 1 });

// Static method to get user activity history
userActivitySchema.statics.getUserHistory = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'username role')
    .lean();
};

// Static method to get activity statistics
userActivitySchema.statics.getActivityStats = async function(days = 30) {
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
          day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          activityType: "$activityType"
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.day": 1 }
    }
  ]);
};

// Static method to get most active users
userActivitySchema.statics.getMostActiveUsers = async function(days = 30, limit = 10) {
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
        _id: "$userId",
        username: { $first: "$username" },
        activityCount: { $sum: 1 },
        lastActivity: { $max: "$timestamp" }
      }
    },
    {
      $sort: { activityCount: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

module.exports = mongoose.model('UserActivity', userActivitySchema); 