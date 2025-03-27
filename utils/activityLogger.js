const UserActivity = require('../models/UserActivity');

// Log user activity
const logUserActivity = async (userId, username, activityType, options = {}) => {
  try {
    const {
      resourceId,
      resourceType,
      details,
      userAgent,
      ipAddress,
      successful = true,
      failureReason = null
    } = options;

    const activity = new UserActivity({
      userId,
      username,
      timestamp: new Date(),
      activityType,
      resourceId: resourceId || null,
      resourceType: resourceType || null,
      details: details || {},
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      successful,
      failureReason
    });

    await activity.save();
    
    // Log to console for debugging
    console.log(`Activity logged: ${username} - ${activityType} - ${successful ? 'success' : 'failed'}`);
    
    return activity;
  } catch (error) {
    console.error(`Error logging activity for user ${username}:`, error);
    // Continue execution even if logging fails
    return null;
  }
};

// Get user history
const getUserActivityHistory = async (userId, limit = 50) => {
  try {
    return await UserActivity.getUserHistory(userId, limit);
  } catch (error) {
    console.error(`Error fetching activity history for user ${userId}:`, error);
    return [];
  }
};

// Get aggregate activity stats
const getActivityStats = async (days = 30) => {
  try {
    return await UserActivity.getActivityStats(days);
  } catch (error) {
    console.error(`Error fetching activity stats:`, error);
    return [];
  }
};

// Get most active users
const getMostActiveUsers = async (days = 30, limit = 10) => {
  try {
    return await UserActivity.getMostActiveUsers(days, limit);
  } catch (error) {
    console.error(`Error fetching most active users:`, error);
    return [];
  }
};

// Create middleware to log user activities automatically
const activityLoggerMiddleware = (activityType, options = {}) => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to log activity after response is sent
    res.end = async function(...args) {
      // Restore original end function
      res.end = originalEnd;
      
      // Execute original end function
      res.end.apply(this, args);
      
      // Only log for authenticated users
      if (req.session && req.session.userId && req.session.username) {
        try {
          const successful = res.statusCode >= 200 && res.statusCode < 400;
          const failureReason = !successful ? `HTTP ${res.statusCode}` : null;
          
          // Get details from request based on options
          let details = typeof options.getDetails === 'function' 
            ? options.getDetails(req) 
            : {};
          
          // Get resource ID from request if specified
          let resourceId = typeof options.getResourceId === 'function'
            ? options.getResourceId(req)
            : null;
          
          await logUserActivity(
            req.session.userId,
            req.session.username,
            activityType,
            {
              resourceId,
              resourceType: options.resourceType || null,
              details,
              userAgent: req.headers['user-agent'],
              ipAddress: req.ip || req.connection.remoteAddress,
              successful,
              failureReason
            }
          );
        } catch (err) {
          console.error('Error in activity logger middleware:', err);
          // Continue execution even if logging fails
        }
      }
    };
    
    next();
  };
};

module.exports = {
  logUserActivity,
  getUserActivityHistory,
  getActivityStats,
  getMostActiveUsers,
  activityLoggerMiddleware
}; 