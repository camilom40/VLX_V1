const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/adminMiddleware');
const SystemMetric = require('../../models/SystemMetric');
const UserActivity = require('../../models/UserActivity');
const systemMonitor = require('../../utils/systemMonitor');

// Middleware to ensure only admin users can access these routes
router.use(isAdmin);

// Main metrics dashboard
router.get('/', async (req, res) => {
  try {
    // Get the latest metrics record
    const latestMetrics = await SystemMetric.getLatestMetrics(1);
    const currentMetric = latestMetrics.length > 0 ? latestMetrics[0] : null;
    
    // Get hourly metrics for the last 24 hours
    const last24Hours = await SystemMetric.find({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).sort({ timestamp: 1 });
    
    // Get daily averages for the last 30 days
    const dailyAverages = await SystemMetric.getDailyAverages(30);
    
    // Get most active users in the last 30 days
    const mostActiveUsers = await UserActivity.getMostActiveUsers(30, 5);
    
    // Get activity statistics
    const activityStats = await UserActivity.getActivityStats(30);
    
    // Recent user activities
    const recentActivities = await UserActivity.find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();
    
    // Render the metrics dashboard
    res.render('admin/metrics', {
      currentMetric,
      last24Hours,
      dailyAverages,
      mostActiveUsers,
      activityStats,
      recentActivities
    });
  } catch (error) {
    console.error('Error loading metrics dashboard:', error);
    res.status(500).render('error', { message: 'Error loading system metrics' });
  }
});

// API endpoint to get the latest metrics
router.get('/api/latest', async (req, res) => {
  try {
    const latestMetrics = await SystemMetric.getLatestMetrics(1);
    res.json({
      success: true,
      data: latestMetrics[0] || null
    });
  } catch (error) {
    console.error('Error fetching latest metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching latest metrics'
    });
  }
});

// API endpoint to get metrics for a time range
router.get('/api/range', async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    const startDate = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = end ? new Date(end) : new Date();
    
    const query = {
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    const metrics = await SystemMetric.find(query)
      .sort({ timestamp: 1 })
      .limit(limit ? parseInt(limit) : 100);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching metrics range:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching metrics range'
    });
  }
});

// API endpoint to get user activity
router.get('/api/user-activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    
    const activities = await UserActivity.getUserHistory(
      userId,
      limit ? parseInt(limit) : 50
    );
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error(`Error fetching user activity for ${req.params.userId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user activity'
    });
  }
});

// API endpoint to get activity statistics
router.get('/api/activity-stats', async (req, res) => {
  try {
    const { days } = req.query;
    const stats = await UserActivity.getActivityStats(days ? parseInt(days) : 30);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity statistics'
    });
  }
});

// Force collection of current system metrics
router.post('/api/collect', async (req, res) => {
  try {
    const metric = await systemMonitor.collectSystemMetrics();
    
    res.json({
      success: true,
      message: 'System metrics collected successfully',
      data: metric
    });
  } catch (error) {
    console.error('Error collecting system metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error collecting system metrics'
    });
  }
});

module.exports = router; 