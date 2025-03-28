// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./middleware/authMiddleware'); // Adjust path
const User = require('../models/User'); // Adjust path
const Project = require('../models/Project'); // Adjust path - ADDED
const fs = require('fs');
const path = require('path');

// Function to get the most recent company logo
function getCompanyLogo() {
    const uploadDir = path.join(__dirname, '../public/uploads/company');
    try {
        if (!fs.existsSync(uploadDir)) {
            return null;
        }
        
        const files = fs.readdirSync(uploadDir)
            .filter(file => file.startsWith('company-logo-'))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(uploadDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        return files.length > 0 ? `/uploads/company/${files[0].name}` : null;
    } catch (error) {
        console.error('Error getting company logo:', error);
        return null;
    }
}

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

        // Get the company logo
        const companyLogo = getCompanyLogo();

        // Pass BOTH user and projects to the view
        res.render('dashboard', {
            user: { // Pass only necessary user info
                username: user.username,
                role: user.role
            },
            projects: projects, // Pass the array of projects
            companyLogo: companyLogo
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;