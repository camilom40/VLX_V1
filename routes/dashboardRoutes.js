// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./middleware/authMiddleware');
const User = require('../models/User');
const Project = require('../models/Project');
const WindowItem = require('../models/WindowItem');

router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Fetch user - include companyLogo field (don't exclude it)
        const user = await User.findById(req.session.userId).lean();

        if (!user) {
            console.warn(`Dashboard access attempt with valid session but invalid userId: ${req.session.userId}`);
            req.session.destroy();
            return res.status(404).redirect('/auth/login');
        }

        // Fetch projects belonging to the logged-in user, sort by most recently updated
        const projects = await Project.find({ userId: req.session.userId })
                                        .sort({ updatedAt: -1 })
                                        .lean();

        // Get all window items for user's projects
        const projectIds = projects.map(p => p._id);
        const windowItems = await WindowItem.find({ projectId: { $in: projectIds } }).lean();

        // Calculate statistics
        const totalProjects = projects.length;
        const totalWindows = windowItems.length;
        const totalPortfolioValue = windowItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        const uniqueClients = new Set(projects.map(p => p.clientName).filter(name => name)).size;

        // Calculate window count and value per project
        const projectsWithStats = projects.map(project => {
            const projectWindows = windowItems.filter(item => 
                item.projectId.toString() === project._id.toString()
            );
            const projectWindowCount = projectWindows.length;
            const projectValue = projectWindows.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
            
            return {
                ...project,
                windowCount: projectWindowCount,
                projectValue: projectValue
            };
        });

        // Get the company logo from user's database record (NOT from file system)
        const companyLogo = user.companyLogo || null;

        // Pass data to the view
        res.render('dashboard', {
            user: {
                username: user.username,
                role: user.role
            },
            projects: projectsWithStats,
            companyLogo: companyLogo,
            stats: {
                totalProjects,
                totalWindows,
                totalPortfolioValue,
                uniqueClients
            }
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;