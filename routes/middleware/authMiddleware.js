const User = require('../../models/User');

const isAuthenticated = async (req, res, next) => {
  if (req.session && req.session.userId) {
    // Check if user is active
    try {
      const user = await User.findById(req.session.userId);
      if (user && user.isActive === false) {
        // User account is inactive, destroy session and redirect
        req.session.destroy();
        return res.status(403).render('unauthorized', {
          message: 'Your account has been deactivated. Please contact an administrator.'
        });
      }
    } catch (error) {
      console.error('Error checking user active status:', error);
    }
    return next(); // User is authenticated and active, proceed to the next middleware/route handler
  } else {
    // Render the pretty unauthorized page instead of plain text
    return res.status(401).render('unauthorized', {
      message: 'You need to be logged in to access this page.'
    });
  }
};



const isAdmin = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      console.log('Access denied. No user session found.');
      return res.status(401).render('unauthorized', {
        message: 'You need to be logged in to access this page.'
      });
    }
    const user = await User.findById(req.session.userId);

    if (!user) {
      console.log('Access denied. User not found.');
      return res.status(403).render('unauthorized', {
        message: 'User account not found or access denied.'
      });
    }
    if (user.role !== 'admin') {
      console.log('Access denied. User is not an admin.');
      return res.status(403).render('unauthorized', {
        message: 'You do not have permission to view this page. Admin access required.'
      });
    }
    console.log('Access granted. User is an admin.');
    next();
  } catch (error) {
    console.error('Error verifying admin status:', error);
    res.status(500).render('unauthorized', {
      message: 'An internal error occurred while verifying permissions.'
    });
  }
};

module.exports = {
  isAuthenticated,
  isAdmin
};
