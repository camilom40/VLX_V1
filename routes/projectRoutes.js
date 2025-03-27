// routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); // Adjust path
const WindowItem = require('../models/WindowItem');
const { isAuthenticated } = require('./middleware/authMiddleware'); // Adjust path

// Route to display the "Create New Project" form
router.get('/projects/new', isAuthenticated, (req, res) => {
  res.render('projects/newProject'); // We will create this view next
});

// Route to handle the creation of a new project
router.post('/projects', isAuthenticated, async (req, res) => {
  try {
    const { projectName, clientName } = req.body;
    if (!projectName) {
      // Add basic validation feedback if possible (e.g., flash messages)
      return res.status(400).send('Project Name is required.');
    }

    const newProject = new Project({
      projectName,
      clientName,
      userId: req.session.userId // Associate project with logged-in user
    });

    await newProject.save();
    res.redirect('/dashboard'); // Redirect back to the project list

  } catch (error) {
    console.error("Error creating project:", error);
    // Add user-friendly error feedback if possible
    res.status(500).send('Failed to create project.');
  }
});

// Route to handle deleting a project
router.post('/projects/delete/:id', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;

    // IMPORTANT: Ensure user only deletes their own projects
    const result = await Project.findOneAndDelete({ _id: projectId, userId: userId });

    if (!result) {
      // Project not found or doesn't belong to the user
      return res.status(404).send('Project not found or access denied.');
    }

    // Also delete all window items associated with this project
    await WindowItem.deleteMany({ projectId });

    console.log(`Project ${projectId} deleted by user ${userId}`);
    res.redirect('/dashboard'); // Redirect back to the project list

  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).send('Failed to delete project.');
  }
});

// NEW ROUTE: View project details and window items
router.get('/projects/:id', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;

    // Find the project and ensure it belongs to the current user
    const project = await Project.findOne({ _id: projectId, userId });

    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Get all window items for this project
    const windowItems = await WindowItem.find({ projectId }).sort({ createdAt: -1 });

    // Calculate total project value
    const projectTotal = windowItems.reduce((total, item) => total + item.totalPrice, 0);

    res.render('projects/projectDetails', { 
      project, 
      windowItems,
      projectTotal: projectTotal.toFixed(2)
    });

  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).send('Failed to load project details.');
  }
});

// NEW ROUTE: Add a window item to a project
router.post('/projects/:id/items', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Extract window item details from request body
    const { 
      itemName, 
      width, 
      height, 
      quantity, 
      unitPrice, 
      material,
      color,
      style,
      description 
    } = req.body;

    // Create new window item
    const newItem = new WindowItem({
      projectId,
      itemName,
      width: parseFloat(width),
      height: parseFloat(height),
      quantity: parseInt(quantity, 10),
      unitPrice: parseFloat(unitPrice),
      material,
      color,
      style,
      description,
      // totalPrice is calculated automatically in the model
    });

    await newItem.save();
    res.redirect(`/projects/${projectId}`);

  } catch (error) {
    console.error("Error adding window item:", error);
    res.status(500).send('Failed to add window item.');
  }
});

// NEW ROUTE: Delete a window item
router.post('/projects/:projectId/items/:itemId/delete', isAuthenticated, async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const userId = req.session.userId;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Delete the window item
    await WindowItem.findByIdAndDelete(itemId);
    
    res.redirect(`/projects/${projectId}`);

  } catch (error) {
    console.error("Error deleting window item:", error);
    res.status(500).send('Failed to delete window item.');
  }
});

module.exports = router;