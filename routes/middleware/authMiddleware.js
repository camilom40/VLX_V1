const User = require('../../models/User');

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next(); // User is authenticated, proceed to the next middleware/route handler
  } else {
    return res.status(401).send('You are not authenticated'); // User is not authenticated
  }
};



const isAdmin = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      console.log('Access denied. No user session found.');
      return res.status(403).send('Access Denied');
    }
    const user = await User.findById(req.session.userId);

    if (!user) {
      console.log('Access denied. User not found.');
      return res.status(403).send('Access Denied');
    }
    if (user.role !== 'admin') {
      console.log('Access denied. User is not an admin.');
      return res.status(403).send('Access Denied');
    }
    console.log('Access granted. User is an admin.');
    next();
  } catch (error) {
    console.error('Error verifying admin status:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  isAuthenticated,
  isAdmin
};
