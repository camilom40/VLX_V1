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

    // Get all available window systems for the dropdown
    const WindowSystem = require('../models/Window');
    const windowSystems = await WindowSystem.find({}).sort({ type: 1 });

    // Calculate total project value
    const projectTotal = windowItems.reduce((total, item) => total + item.totalPrice, 0);

    res.render('projects/projectDetails', { 
      project, 
      windowItems,
      windowSystems,
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

// NEW ROUTE: Create detailed window configuration page
router.get('/projects/:id/windows/new', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;
    const { windowRef, windowSystemId } = req.query;

    // Validate required parameters
    if (!windowRef || !windowSystemId) {
      return res.status(400).send('Window reference and window system are required.');
    }

    // Find the project and ensure it belongs to the current user
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Get the selected window system with populated references
    const WindowSystem = require('../models/Window');
    const selectedWindowSystem = await WindowSystem.findById(windowSystemId)
      .populate('profiles.profile')
      .populate('accessories.accessory');

    if (!selectedWindowSystem) {
      return res.status(404).send('Window system not found.');
    }

    // Get all profiles, accessories, and glasses for manual selection
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const Glass = require('../models/Glass');
    const CostSettings = require('../models/CostSettings');

    const [allProfiles, allAccessories, allGlasses, costSettings] = await Promise.all([
      Profile.find({}).sort({ name: 1 }),
      Accessory.find({}).sort({ name: 1 }),
      Glass.find({}).sort({ glass_type: 1 }),
      CostSettings.findOne() // Get cost settings for pricing calculations
    ]);

    // Filter user-configurable items
    const userConfigurableProfiles = selectedWindowSystem.profiles.filter(profile => profile.showToUser);
    const userConfigurableAccessories = selectedWindowSystem.accessories.filter(accessory => accessory.showToUser);

    // Group accessories by component groups for choice selection
    const accessoryChoiceGroups = {};
    const individualAccessories = [];
    
    userConfigurableAccessories.forEach(accessoryItem => {
      if (accessoryItem.componentGroup && accessoryItem.selectionType !== 'quantity') {
        if (!accessoryChoiceGroups[accessoryItem.componentGroup]) {
          accessoryChoiceGroups[accessoryItem.componentGroup] = {
            name: accessoryItem.componentGroup,
            selectionType: accessoryItem.selectionType,
            accessories: []
          };
        }
        accessoryChoiceGroups[accessoryItem.componentGroup].accessories.push(accessoryItem);
      } else {
        // Regular quantity-based accessories
        individualAccessories.push(accessoryItem);
      }
    });

    res.render('projects/configureWindow', {
      project,
      windowRef,
      selectedWindowSystem,
      userConfigurableProfiles,
      userConfigurableAccessories,
      accessoryChoiceGroups: Object.values(accessoryChoiceGroups),
      individualAccessories,
      allProfiles,
      allAccessories,
      allGlasses,
      costSettings: costSettings || {},
      existingWindow: null, // No existing window for new configuration
      isEdit: false        // This is not edit mode
    });

  } catch (error) {
    console.error("Error loading window configuration page:", error);
    res.status(500).send('Failed to load window configuration page.');
  }
});

// NEW ROUTE: Save configured window as window item
router.post('/projects/:id/windows/save', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;
    const {
      windowRef,
      windowSystemId,
      width,
      height,
      quantity,
      glassType,
      profiles,
      accessories,
      notes
    } = req.body;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Get window system for reference
    const WindowSystem = require('../models/Window');
    const windowSystem = await WindowSystem.findById(windowSystemId);
    if (!windowSystem) {
      return res.status(404).send('Window system not found.');
    }

    // Get selected glass for pricing
    const Glass = require('../models/Glass');
    const selectedGlass = await Glass.findById(glassType);
    if (!selectedGlass) {
      return res.status(404).send('Selected glass type not found.');
    }

    // Get all profiles and accessories for pricing calculations
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const CostSettings = require('../models/CostSettings');

    const [allProfiles, allAccessories, costSettings] = await Promise.all([
      Profile.find({}),
      Accessory.find({}),
      CostSettings.findOne()
    ]);

    // Calculate pricing
    const windowWidth = parseFloat(width);
    const windowHeight = parseFloat(height);
    const windowQuantity = parseInt(quantity);
    
    // Glass cost calculation
    const areaInches = windowWidth * windowHeight;
    const areaSquareMeters = areaInches / 1550; // Convert to square meters
    const glassCost = selectedGlass.pricePerSquareMeter * areaSquareMeters;

    // Profile costs calculation (include both user-configurable and auto-managed)
    let profilesCost = 0;
    
    // Process all profiles from the window system
    windowSystem.profiles.forEach(profileItem => {
      const profile = allProfiles.find(p => p._id.toString() === profileItem.profile.toString());
      if (profile) {
        const perimeterInches = 2 * (windowWidth + windowHeight);
        const perimeterMeters = perimeterInches * 0.0254;
        
        // Use user input for configurable profiles, defaults for auto-managed
        let quantity = profileItem.quantity;
        let lengthDiscount = profileItem.lengthDiscount;
        
        if (profileItem.showToUser && profiles && Array.isArray(profiles)) {
          // Find user input for this profile
          const userProfile = profiles.find(p => p.profileId === profileItem.profile.toString());
          if (userProfile) {
            quantity = parseInt(userProfile.quantity) || profileItem.quantity;
            lengthDiscount = parseFloat(userProfile.lengthDiscount) || profileItem.lengthDiscount;
          }
        }
        
        const adjustedLength = Math.max(0, perimeterMeters - (lengthDiscount * 0.0254));
        profilesCost += profile.pricePerMeter * adjustedLength * quantity;
      }
    });

    // Accessories cost calculation (include both user-configurable and auto-managed)
    let accessoriesCost = 0;
    
    // Process all accessories from the window system
    windowSystem.accessories.forEach(accessoryItem => {
      const accessory = allAccessories.find(a => a._id.toString() === accessoryItem.accessory.toString());
      if (accessory) {
        // Use user input for configurable accessories, defaults for auto-managed
        let quantity = accessoryItem.quantity;
        
        if (accessoryItem.showToUser && accessories && Array.isArray(accessories)) {
          // Find user input for this accessory
          const userAccessory = accessories.find(a => a.accessoryId === accessoryItem.accessory.toString());
          if (userAccessory) {
            quantity = parseInt(userAccessory.quantity) || accessoryItem.quantity;
          }
        }
        
        accessoriesCost += accessory.price * quantity;
      }
    });

    // Apply cost settings
    const baseCost = glassCost + profilesCost + accessoriesCost;
    const additionalCosts = costSettings ? baseCost * (
      (costSettings.seaFreight / 100) +
      (costSettings.landFreight / 100) +
      (costSettings.packaging / 100) +
      (costSettings.labor / 100) +
      (costSettings.indirectCosts / 100) +
      (costSettings.administrativeExpenses / 100)
    ) : 0;

    const totalCost = baseCost + additionalCosts;
    const finalPrice = totalCost * windowQuantity;

    // Create detailed description
    const userConfigurableProfiles = windowSystem.profiles.filter(p => p.showToUser);
    const userConfigurableAccessories = windowSystem.accessories.filter(a => a.showToUser);
    const autoManagedProfiles = windowSystem.profiles.filter(p => !p.showToUser);
    const autoManagedAccessories = windowSystem.accessories.filter(a => !a.showToUser);
    
    const description = `
Window System: ${windowSystem.type}
Glass Type: ${selectedGlass.glass_type} - ${selectedGlass.description}
User-Configured Profiles: ${userConfigurableProfiles.length}
Auto-Managed Profiles: ${autoManagedProfiles.length}
User-Configured Accessories: ${userConfigurableAccessories.length}
Auto-Managed Accessories: ${autoManagedAccessories.length}
${notes ? `Notes: ${notes}` : ''}
    `.trim();

    // Create window item
    const newWindowItem = new WindowItem({
      projectId,
      itemName: `${windowRef} - ${windowSystem.type}`,
      width: windowWidth,
      height: windowHeight,
      quantity: windowQuantity,
      unitPrice: parseFloat((finalPrice / windowQuantity).toFixed(2)),
      material: 'Aluminum/Glass',
      color: 'Various',
      style: windowSystem.type,
      description: description
    });

    await newWindowItem.save();

    console.log(`Window ${windowRef} configured and saved for project ${projectId}`);
    res.redirect(`/projects/${projectId}`);

  } catch (error) {
    console.error("Error saving window configuration:", error);
    res.status(500).send('Failed to save window configuration.');
  }
});

// NEW ROUTE: Edit existing window configuration
router.get('/projects/:projectId/windows/:windowId/edit', isAuthenticated, async (req, res) => {
  try {
    const { projectId, windowId } = req.params;
    const userId = req.session.userId;

    // Find the project and ensure it belongs to the current user
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Find the existing window item
    const existingWindow = await WindowItem.findOne({ _id: windowId, projectId });
    if (!existingWindow) {
      return res.status(404).send('Window not found.');
    }

    // Extract window reference from item name (assuming format: "REF - SystemType")
    const windowRef = existingWindow.itemName.split(' - ')[0] || existingWindow.itemName;

    // Try to identify the window system from the description or style
    const WindowSystem = require('../models/Window');
    let selectedWindowSystem = await WindowSystem.findOne({ type: existingWindow.style })
      .populate('profiles.profile')
      .populate('accessories.accessory');

    // If not found, get the first available window system as fallback
    if (!selectedWindowSystem) {
      selectedWindowSystem = await WindowSystem.findOne({})
        .populate('profiles.profile')
        .populate('accessories.accessory');
    }

    if (!selectedWindowSystem) {
      return res.status(404).send('No window systems available.');
    }

    // Get all profiles, accessories, and glasses for manual selection
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const Glass = require('../models/Glass');
    const CostSettings = require('../models/CostSettings');

    const [allProfiles, allAccessories, allGlasses, costSettings] = await Promise.all([
      Profile.find({}).sort({ name: 1 }),
      Accessory.find({}).sort({ name: 1 }),
      Glass.find({}).sort({ glass_type: 1 }),
      CostSettings.findOne()
    ]);

    // Filter user-configurable items
    const userConfigurableProfiles = selectedWindowSystem.profiles.filter(profile => profile.showToUser);
    const userConfigurableAccessories = selectedWindowSystem.accessories.filter(accessory => accessory.showToUser);

    // Group accessories by component groups for choice selection
    const accessoryChoiceGroups = {};
    const individualAccessories = [];
    
    userConfigurableAccessories.forEach(accessoryItem => {
      if (accessoryItem.componentGroup && accessoryItem.selectionType !== 'quantity') {
        if (!accessoryChoiceGroups[accessoryItem.componentGroup]) {
          accessoryChoiceGroups[accessoryItem.componentGroup] = {
            name: accessoryItem.componentGroup,
            selectionType: accessoryItem.selectionType,
            accessories: []
          };
        }
        accessoryChoiceGroups[accessoryItem.componentGroup].accessories.push(accessoryItem);
      } else {
        // Regular quantity-based accessories
        individualAccessories.push(accessoryItem);
      }
    });

    res.render('projects/configureWindow', {
      project,
      windowRef,
      selectedWindowSystem,
      userConfigurableProfiles,
      userConfigurableAccessories,
      accessoryChoiceGroups: Object.values(accessoryChoiceGroups),
      individualAccessories,
      allProfiles,
      allAccessories,
      allGlasses,
      costSettings: costSettings || {},
      existingWindow, // Pass existing window data for pre-filling form
      isEdit: true    // Flag to indicate this is edit mode
    });

  } catch (error) {
    console.error("Error loading window edit page:", error);
    res.status(500).send('Failed to load window edit page.');
  }
});

// NEW ROUTE: Update existing window configuration
router.post('/projects/:projectId/windows/:windowId/update', isAuthenticated, async (req, res) => {
  try {
    const { projectId, windowId } = req.params;
    const userId = req.session.userId;
    const {
      windowRef,
      windowSystemId,
      width,
      height,
      quantity,
      glassType,
      profiles,
      accessories,
      notes
    } = req.body;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Find the existing window item
    const existingWindow = await WindowItem.findOne({ _id: windowId, projectId });
    if (!existingWindow) {
      return res.status(404).send('Window not found.');
    }

    // Get window system for reference
    const WindowSystem = require('../models/Window');
    const windowSystem = await WindowSystem.findById(windowSystemId);
    if (!windowSystem) {
      return res.status(404).send('Window system not found.');
    }

    // Get selected glass for pricing
    const Glass = require('../models/Glass');
    const selectedGlass = await Glass.findById(glassType);
    if (!selectedGlass) {
      return res.status(404).send('Selected glass type not found.');
    }

    // Get all profiles and accessories for pricing calculations
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const CostSettings = require('../models/CostSettings');

    const [allProfiles, allAccessories, costSettings] = await Promise.all([
      Profile.find({}),
      Accessory.find({}),
      CostSettings.findOne()
    ]);

    // Calculate pricing (same as save route)
    const windowWidth = parseFloat(width);
    const windowHeight = parseFloat(height);
    const windowQuantity = parseInt(quantity);
    
    // Glass cost calculation
    const areaInches = windowWidth * windowHeight;
    const areaSquareMeters = areaInches / 1550;
    const glassCost = selectedGlass.pricePerSquareMeter * areaSquareMeters;

    // Profile costs calculation
    let profilesCost = 0;
    windowSystem.profiles.forEach(profileItem => {
      const profile = allProfiles.find(p => p._id.toString() === profileItem.profile.toString());
      if (profile) {
        const perimeterInches = 2 * (windowWidth + windowHeight);
        const perimeterMeters = perimeterInches * 0.0254;
        
        let quantity = profileItem.quantity;
        let lengthDiscount = profileItem.lengthDiscount;
        
        if (profileItem.showToUser && profiles && Array.isArray(profiles)) {
          const userProfile = profiles.find(p => p.profileId === profileItem.profile.toString());
          if (userProfile) {
            quantity = parseInt(userProfile.quantity) || profileItem.quantity;
            lengthDiscount = parseFloat(userProfile.lengthDiscount) || profileItem.lengthDiscount;
          }
        }
        
        const adjustedLength = Math.max(0, perimeterMeters - (lengthDiscount * 0.0254));
        profilesCost += profile.pricePerMeter * adjustedLength * quantity;
      }
    });

    // Accessories cost calculation
    let accessoriesCost = 0;
    windowSystem.accessories.forEach(accessoryItem => {
      const accessory = allAccessories.find(a => a._id.toString() === accessoryItem.accessory.toString());
      if (accessory) {
        let quantity = accessoryItem.quantity;
        
        if (accessoryItem.showToUser && accessories && Array.isArray(accessories)) {
          const userAccessory = accessories.find(a => a.accessoryId === accessoryItem.accessory.toString());
          if (userAccessory) {
            quantity = parseInt(userAccessory.quantity) || accessoryItem.quantity;
          }
        }
        
        accessoriesCost += accessory.price * quantity;
      }
    });

    // Apply cost settings (only per-window costs: packaging, labor, indirect)
    const baseCost = glassCost + profilesCost + accessoriesCost;
    const additionalCosts = costSettings ? baseCost * (
      (costSettings.packaging / 100) +
      (costSettings.labor / 100) +
      (costSettings.indirectCosts / 100)
    ) : 0;

    const totalCost = baseCost + additionalCosts;
    const finalPrice = totalCost * windowQuantity;

    // Create updated description
    const userConfigurableProfiles = windowSystem.profiles.filter(p => p.showToUser);
    const userConfigurableAccessories = windowSystem.accessories.filter(a => a.showToUser);
    const autoManagedProfiles = windowSystem.profiles.filter(p => !p.showToUser);
    const autoManagedAccessories = windowSystem.accessories.filter(a => !a.showToUser);
    
    const description = `
Window System: ${windowSystem.type}
Glass Type: ${selectedGlass.glass_type} - ${selectedGlass.description}
User-Configured Profiles: ${userConfigurableProfiles.length}
Auto-Managed Profiles: ${autoManagedProfiles.length}
User-Configured Accessories: ${userConfigurableAccessories.length}
Auto-Managed Accessories: ${autoManagedAccessories.length}
${notes ? `Notes: ${notes}` : ''}
    `.trim();

    // Update the existing window item
    await WindowItem.findByIdAndUpdate(windowId, {
      itemName: `${windowRef} - ${windowSystem.type}`,
      width: windowWidth,
      height: windowHeight,
      quantity: windowQuantity,
      unitPrice: parseFloat((finalPrice / windowQuantity).toFixed(2)),
      material: 'Aluminum/Glass',
      color: 'Various',
      style: windowSystem.type,
      description: description
    });

    console.log(`Window ${windowRef} updated for project ${projectId}`);
    res.redirect(`/projects/${projectId}`);

  } catch (error) {
    console.error("Error updating window configuration:", error);
    res.status(500).send('Failed to update window configuration.');
  }
});

module.exports = router;