const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./middleware/authMiddleware'); // Adjust path if needed
const User = require('../models/User'); // Adjust path if needed

// Dashboard route
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).lean();

        if (!user) {
            return res.status(404).send('User not found.');
        }

        res.render('dashboard', { user });
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
