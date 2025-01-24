const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const router = express.Router();
const nodemailer = require('nodemailer');



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
    const { email, password } = req.body;
    const user = await User.findOne({ username: email });
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(400).send('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      req.session.userId = user._id;
      req.session.isAdmin = user.role === 'admin';

      console.log(`Session set: userId=${req.session.userId}, isAdmin=${req.session.isAdmin}`);

      // Update the lastLogin field
      user.lastLogin = new Date();
      await user.save();

      console.log(`User ${email} logged in successfully.`);
      return res.redirect('/dashboard');
    } else {
      console.log('Login failed: Incorrect password');
      return res.status(400).send(`
        <script>
          alert('Wrong Password. Please Try Again!');
          window.location.href = '/auth/login'; 
        </script>
      `);
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

router.get('/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error during session destruction:', err);
      return res.status(500).send('Error logging out');
    }
    console.log('User logged out successfully.');
    res.redirect('/auth/login');
  });
});

module.exports = router;