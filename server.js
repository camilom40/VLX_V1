// Load environment variables
require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const authRoutes = require("./routes/authRoutes");
const quotationRoutes = require('./routes/quotationRoutes');
// const pdfExportRoutes = require('./routes/pdfExportRoutes');
const accessoryRoutes = require('./routes/admin/accessoryRoutes');
const glassRoutes = require('./routes/admin/glassRoutes');
const profileRoutes = require('./routes/admin/profileRoutes');
const settingsRoutes = require('./routes/admin/settingsRoutes');
const { isAdmin } = require('./routes/middleware/adminMiddleware');
// const windowSystemConfigRoutes = require('./routes/admin/windowSystemConfigRoutes');
const windowRoutes = require('./routes/admin/windowRoutes'); // Correctly import the routes



if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
  console.error("Error: config environment variables not set. Please create/edit .env configuration file.");
  process.exit(-1);
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setting the templating engine to EJS
app.set("view engine", "ejs");

// Serve static files
app.use(express.static("public"));

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

// Authentication Routes
app.use(authRoutes);

// Quotation Routes
app.use('/quotation', quotationRoutes);
app.use('/admin/accessories', accessoryRoutes);
app.use('/admin/glasses', glassRoutes);

// Admin Routes for Profiles
app.use('/admin/profiles', profileRoutes);

// Admin Routes for Settings
app.use('/admin', settingsRoutes);

// Admin Console Route
app.get('/admin', isAdmin, (req, res) => {
  res.render('admin/adminConsole');
});

 // Import the routes
app.use('/admin', windowRoutes); // Mount the admin routes

// Window Routes
app.use('/admin', windowRoutes);

// Admin Routes for Window Systems Configuration
// app.use('/admin/window-systems', isAdmin, windowSystemConfigRoutes);
// Admin Routes for Window Systems Manager


// Root path response
app.get("/", (req, res) => {
  const sess = req.session;
  // Make session available to all views
  res.locals.session = sess;
  if(sess.userId){
    res.redirect("/quotation/dashboard");
  }else{
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
