// Load environment variables
require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const authRoutes = require("./routes/authRoutes");
// const pdfExportRoutes = require('./routes/pdfExportRoutes');
const accessoryRoutes = require('./routes/admin/accessoryRoutes');
const glassRoutes = require('./routes/admin/glassRoutes');
const profileRoutes = require('./routes/admin/profileRoutes');
const settingsRoutes = require('./routes/admin/settingsRoutes');
const metricsRoutes = require('./routes/admin/metricsRoutes');
const componentGroupRoutes = require('./routes/admin/componentGroupRoutes');
const { isAdmin } = require('./routes/middleware/adminMiddleware');
// const windowSystemConfigRoutes = require('./routes/admin/windowSystemConfigRoutes');
const windowRoutes = require('./routes/admin/windowRoutes'); // Correctly import the routes
const dashboardRoutes = require('./routes/dashboardRoutes'); // Adjust path if required
const User = require('./models/User'); // Import User model for pricing tier updates
const systemMonitor = require('./utils/systemMonitor'); // Import system monitor





if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
  console.error("Error: config environment variables not set. Please create/edit .env configuration file.");
  process.exit(-1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setting the templating engine to EJS
app.set("view engine", "ejs");

// Serve static files
app.use(express.static("public"));

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Change to memory storage for processing

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Database connection
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch((err) => {
    console.error(`Database connection error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });

// Session configuration with connect-mongo
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL }),
  }),
);

app.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
  console.error(error.stack);
});

// Logging session creation and destruction
app.use((req, res, next) => {
  const sess = req.session;
  // Make session available to all views
  res.locals.session = sess;
  
  // Add isAdmin flag to session for view rendering
  if (sess.role === 'admin') {
    res.locals.session.isAdmin = true;
  } else {
    res.locals.session.isAdmin = false;
  }
  
  if (!sess.views) {
    sess.views = 1;
    console.log("Session created at: ", new Date().toISOString());
  } else {
    sess.views++;
    console.log(
      `Session accessed again at: ${new Date().toISOString()}, Views: ${sess.views}, User ID: ${sess.userId || '(unauthenticated)'}`,
    );
  }
  next();
});

app.use('/dashboard', dashboardRoutes);

// Authentication Routes
app.use(authRoutes);

// Quotation Routes
app.use('/admin/accessories', accessoryRoutes);
app.use('/admin/glasses', glassRoutes);

// Admin Routes for Profiles
app.use('/admin/profiles', profileRoutes);

// Admin Routes for Settings
app.use('/admin', settingsRoutes);

// Admin Routes for Metrics
app.use('/admin/metrics', metricsRoutes);

// Admin Routes for Component Groups
app.use('/admin', componentGroupRoutes);

// Admin Console Route
app.get('/admin', isAdmin, (req, res) => {
  res.render('admin/adminConsole');
});

// Add the pricing tier update route
app.post('/admin/users/update-pricing', isAdmin, (req, res) => {
  const { userId, pricingTier } = req.body;
  
  // Find user by ID and update pricing tier
  User.findByIdAndUpdate(userId, { pricingTier }, (err) => {
    if (err) {
      console.error('Error updating user pricing tier:', err);
      // Handle error with flash message if available
    }
    
    // Redirect back to users page
    res.redirect('/admin/users');
  });
});

// Logo upload route
app.post('/api/upload-logo', upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Create upload directory if it doesn't exist
        const uploadDir = 'public/uploads/company';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = 'company-logo-' + uniqueSuffix + '.png';
        const filepath = path.join(uploadDir, filename);

        // Process and save the image
        await sharp(req.file.buffer)
            .resize(200, 200, { // Set maximum dimensions
                fit: 'contain', // Maintain aspect ratio
                background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
            })
            .png({ quality: 90 }) // Convert to PNG with good quality
            .toFile(filepath);

        // Get the file path relative to public directory
        const logoUrl = '/uploads/company/' + filename;

        res.json({
            success: true,
            logoUrl: logoUrl
        });
    } catch (error) {
        console.error('Logo upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading logo'
        });
    }
});

// server.js
const projectRoutes = require('./routes/projectRoutes'); // Add this require at the top
// ... other middleware ...
app.use(projectRoutes); // Add this line to mount the routes
// ... 404 handler ...



// Window Routes
app.use('/admin', windowRoutes);

// Admin Routes for Window Systems Configuration
// app.use('/admin/window-systems', isAdmin, windowSystemConfigRoutes);
// Admin Routes for Window Systems Manager


// Root path response
app.get("/", (req, res) => {
  const sess = req.session;
  res.locals.session = sess;
  if (sess.userId) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/auth/login");
  }
});

// If no routes handled the request, it's a 404
app.use((req, res, next) => {
  res.status(404).send("Page not found.");
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`Unhandled application error: ${err.message}`);
  console.error(err.stack);
  res.status(500).send("There was an error serving your request.");
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Start collecting system metrics every 5 minutes
  systemMonitor.startMetricsCollection(5);
  console.log('System metrics collection started');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try these solutions:`);
    console.error('1. Close the application using this port');
    console.error('2. Use a different port by setting the PORT environment variable');
    console.error('   For example: PORT=3001 npm start');
  } else {
    console.error('Server error:', err);
  }
});
