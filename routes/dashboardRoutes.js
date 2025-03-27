// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./middleware/authMiddleware'); // Adjust path
const User = require('../models/User'); // Adjust path
const Project = require('../models/Project'); // Adjust path - ADDED

router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Fetch user (optional if only needed for header/basic info)
        const user = await User.findById(req.session.userId).select('-password').lean();

        // Fetch projects belonging to the logged-in user, sort by most recently updated
        const projects = await Project.find({ userId: req.session.userId })
                                        .sort({ updatedAt: -1 }) // Sort by last updated
                                        .lean(); // Use lean for read-only

        if (!user) { // User check remains important for session validity
            console.warn(`Dashboard access attempt with valid session but invalid userId: ${req.session.userId}`);
            req.session.destroy();
            return res.status(404).redirect('/auth/login');
        }

        // Pass BOTH user and projects to the view
        res.render('dashboard', {
            user: { // Pass only necessary user info
                username: user.username,
                role: user.role
            },
            projects: projects // Pass the array of projects
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;