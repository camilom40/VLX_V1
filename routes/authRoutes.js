const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const router = express.Router();
const nodemailer = require('nodemailer');
const { activityLoggerMiddleware } = require('../utils/activityLogger');
const activityLogger = require('../utils/activityLogger');



router.get('/auth/register', (req, res) => {
  res.render('register');
});

// router.post('/auth/register', async (req, res) => {
//   try {
//     const { email, password, role } = req.body;
//     // User model will automatically hash the password using bcrypt
//     await User.create({ username: email, password, role });
//     res.redirect('/auth/login');
//   } catch (error) {
//     console.error('Registration error:', error);
//     // Sending an alert message in the response
//     res.status(500).send(`
//       <script>
//         alert('Email Address Already In Use. Try A Different One.');
//         window.location.href = '/auth/register'; 
//       </script>
//     `);
//   }
// });

router.post('/request-user', async (req, res) => {
  const { firstName, lastName, role, email, company, city, country, areaCode, phone } = req.body;


  try {
    // Combine area code and phone
    const fullPhone = `${areaCode} ${phone}`;

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL, // Your admin email
      subject: 'Request for User and Password for VLW APP',
      text: `A new user has requested access:
      Name: ${firstName} ${lastName}
      Role in Company: ${role}
      Email: ${email}
      Company: ${company}
      City: ${city}
      Country: ${country}
      Phone: ${fullPhone}`,
    };

    await transporter.sendMail(mailOptions);

    // Redirect to a confirmation page
    res.redirect('/request-user/confirmation');
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send('Error sending request. Please try again later.');
  }
});

// Confirmation page route
router.get('/request-user/confirmation', (req, res) => {
  res.render('confirmation', { message: 'Your information has been submitted. We will contact you shortly.' });
});





router.get('/auth/login', (req, res) => {
  res.render('login');
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      // Failed login - user not found
      return res.render('login', { 
        error: 'Invalid username or password',
        username
      });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Log failed login attempt
      if (user._id) {
        await activityLogger.logUserActivity(
          user._id,
          username,
          'login',
          {
            successful: false,
            failureReason: 'Invalid password',
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
          }
        );
      }
      
      return res.render('login', { 
        error: 'Invalid username or password',
        username
      });
    }
    
    // Login successful
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    // Update last login time
    user.lastLogin = new Date();
    await user.save();
    
    // Log successful login
    await activityLogger.logUserActivity(
      user._id,
      username,
      'login',
      {
        successful: true,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      }
    );
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { 
      error: 'An error occurred during login',
      username: req.body.username 
    });
  }
});

router.get('/auth/logout', async (req, res) => {
  try {
    // Log the logout if user is authenticated
    if (req.session.userId) {
      await activityLogger.logUserActivity(
        req.session.userId,
        req.session.username,
        'logout',
        {
          successful: true,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      );
    }
    
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.redirect('/auth/login');
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/auth/login');
  }
});

module.exports = router;