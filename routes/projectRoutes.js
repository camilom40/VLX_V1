// routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); // Adjust path
const WindowItem = require('../models/WindowItem');
const { isAuthenticated } = require('./middleware/authMiddleware'); // Adjust path
const { convertToCOP, getExchangeRate } = require('../utils/currencyConverter');

// Helper function to generate quote number
async function generateQuoteNumber(userId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  
  // Find all projects created today by this user
  const startOfDay = new Date(year, today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(year, today.getMonth(), today.getDate(), 23, 59, 59, 999);
  
  const todayProjects = await Project.find({
    userId: userId,
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    quoteNumber: { $regex: `^${datePrefix}-` }
  }).sort({ createdAt: -1 });
  
  // Find the highest version number for today
  let maxVersion = 0;
  todayProjects.forEach(project => {
    if (project.quoteNumber) {
      const match = project.quoteNumber.match(/^(\d{8})-v(\d+)$/);
      if (match) {
        const version = parseInt(match[2]);
        if (version > maxVersion) {
          maxVersion = version;
        }
      }
    }
  });
  
  // Next version number
  const nextVersion = maxVersion + 1;
  
  // Return quote number with version (format: YYYYMMDD-vN)
  return `${datePrefix}-v${nextVersion}`;
}

// Helper function to generate next version of a quote
async function generateNextVersion(originalQuoteNumber, userId) {
  const match = originalQuoteNumber.match(/^(\d{8})-v(\d+)$/);
  if (!match) {
    // If format doesn't match, generate a new quote number
    return await generateQuoteNumber(userId);
  }
  
  const [, datePrefix, version] = match;
  const nextVersion = parseInt(version) + 1;
  
  return `${datePrefix}-v${nextVersion}`;
}

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

    // Generate quote number
    const quoteNumber = await generateQuoteNumber(req.session.userId);

    const newProject = new Project({
      projectName,
      clientName,
      quoteNumber,
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
      exchangeRate: await getExchangeRate(),
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

    // Get exchange rate for currency conversion
    const exchangeRate = await getExchangeRate();

    // Calculate pricing
    const windowWidth = parseFloat(width);
    const windowHeight = parseFloat(height);
    const windowQuantity = parseInt(quantity);
    
    // Glass cost calculation
    const areaInches = windowWidth * windowHeight;
    const areaSquareMeters = areaInches / 1550;
    const glassCostCOP = convertToCOP(selectedGlass.pricePerSquareMeter, selectedGlass.currency || 'COP', exchangeRate);
    const glassCost = glassCostCOP * areaSquareMeters;

    // Profile costs calculation (include both user-configurable and auto-managed)
    let profileCostTotal = 0;
    const profileCosts = [];
    
    // Calculate perimeter for profile cost calculation
    const perimeterInches = 2 * (windowWidth + windowHeight);
    const perimeterMeters = perimeterInches / 39.37;
    
    // Define user-configurable and auto-managed profiles
    const userConfigurableProfiles = windowSystem.profiles.filter(p => p.showToUser);
    
    // Add user-configurable profile costs
    for (const profile of userConfigurableProfiles) {
      const profileCostCOP = convertToCOP(profile.pricePerMeter, profile.currency || 'COP', exchangeRate);
      const profileCost = profileCostCOP * perimeterMeters;
      profileCostTotal += profileCost;
      profileCosts.push({
        name: profile.name,
        cost: profileCost,
        isUserConfigurable: true
      });
    }
    
    // Add auto-managed profile costs
    for (const profile of windowSystem.profiles.filter(p => !p.showToUser)) {
      const profileCostCOP = convertToCOP(profile.pricePerMeter, profile.currency || 'COP', exchangeRate);
      const profileCost = profileCostCOP * perimeterMeters;
      profileCostTotal += profileCost;
      profileCosts.push({
        name: profile.name,
        cost: profileCost,
        isUserConfigurable: false
      });
    }

    // Accessories cost calculation (include both user-configurable and auto-managed)
    let accessoryCostTotal = 0;
    const accessoryCosts = [];
    
    // Process choice group accessories first (from radio buttons/checkboxes)
    const choiceGroupAccessories = [];
    Object.keys(req.body).forEach(key => {
      if (key.startsWith('choiceGroup_')) {
        const groupName = key.replace('choiceGroup_', '');
        const selectedAccessoryIds = Array.isArray(req.body[key]) ? req.body[key] : [req.body[key]];
        
        selectedAccessoryIds.forEach(accessoryId => {
          const quantityKey = `accessories_choice_${groupName}_${accessoryId}_quantity`;
          const priceKey = `accessories_choice_${groupName}_${accessoryId}_price`;
          
          if (req.body[quantityKey] && req.body[priceKey]) {
            const quantity = parseInt(req.body[quantityKey]) || 1;
            const price = parseFloat(req.body[priceKey]) || 0;
            
            // Find the accessory to get its currency
            const accessory = allAccessories.find(a => a._id.toString() === accessoryId);
            const priceCOP = convertToCOP(price, accessory?.currency || 'COP', exchangeRate);
            
            choiceGroupAccessories.push({ accessoryId, quantity, price: priceCOP });
            accessoryCostTotal += priceCOP * quantity;
          }
        });
      }
    });
    
    // Process traditional individual accessories and auto-managed accessories
    windowSystem.accessories.forEach(accessoryItem => {
      const accessory = allAccessories.find(a => a._id.toString() === accessoryItem.accessory.toString());
      if (accessory) {
        // Skip if this accessory was already processed as part of choice groups
        const alreadyProcessed = choiceGroupAccessories.some(cga => cga.accessoryId === accessoryItem.accessory.toString());
        if (alreadyProcessed) {
          return;
        }
        
        // Use user input for configurable accessories, defaults for auto-managed
        let quantity = accessoryItem.quantity;
        
        if (accessoryItem.showToUser && accessories && Array.isArray(accessories)) {
          // Find user input for this accessory
          const userAccessory = accessories.find(a => a.accessoryId === accessoryItem.accessory.toString());
          if (userAccessory) {
            quantity = parseInt(userAccessory.quantity) || accessoryItem.quantity;
          }
        }
        
        const accessoryCostCOP = convertToCOP(accessory.price, accessory.currency || 'COP', exchangeRate);
        accessoryCostTotal += accessoryCostCOP * quantity;
      }
    });

    // Muntin cost calculation
    let muntinCost = 0;
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled) {
      const muntinType = req.body.muntinType;
      const muntinHorizontal = parseInt(req.body.muntinHorizontal) || 1;
      const muntinVertical = parseInt(req.body.muntinVertical) || 1;
      const muntinSpacing = parseFloat(req.body.muntinSpacing) || 0;
      
      // Calculate muntin cost if muntin profile is selected
      if (windowSystem.muntinConfiguration.muntinProfile) {
        const muntinProfile = allProfiles.find(p => p._id.toString() === windowSystem.muntinConfiguration.muntinProfile.toString());
        if (muntinProfile) {
          const muntinPricePerMeter = parseFloat(muntinProfile.pricePerMeter) || 0;
          const muntinCurrency = muntinProfile.currency || 'COP';
          const muntinPricePerMeterCOP = convertToCOP(muntinPricePerMeter, muntinCurrency, exchangeRate);
          
          // Calculate total muntin length based on divisions
          const horizontalMuntins = muntinHorizontal - 1; // Number of horizontal bars
          const verticalMuntins = muntinVertical - 1; // Number of vertical bars
          
          const horizontalLength = horizontalMuntins * windowWidth * 0.0254; // Convert to meters
          const verticalLength = verticalMuntins * windowHeight * 0.0254; // Convert to meters
          
          const totalMuntinLength = horizontalLength + verticalLength;
          muntinCost = muntinPricePerMeterCOP * totalMuntinLength;
        }
      }
    }
    
    // Apply cost settings with proper validation
    const baseCost = isNaN(glassCost) ? 0 : glassCost + (isNaN(profileCostTotal) ? 0 : profileCostTotal) + (isNaN(accessoryCostTotal) ? 0 : accessoryCostTotal) + (isNaN(muntinCost) ? 0 : muntinCost);
    
    console.log('=== PRICING DEBUG ===');
    console.log('glassCost:', glassCost);
    console.log('profileCostTotal:', profileCostTotal);
    console.log('accessoryCostTotal:', accessoryCostTotal);
    console.log('muntinCost:', muntinCost);
    console.log('baseCost:', baseCost);
    console.log('costSettings:', costSettings ? 'exists' : 'null');
    
    const additionalCosts = costSettings ? baseCost * (
      (parseFloat(costSettings.seaFreight) || 0) / 100 +
      (parseFloat(costSettings.landFreight) || 0) / 100 +
      (parseFloat(costSettings.packaging) || 0) / 100 +
      (parseFloat(costSettings.labor) || 0) / 100 +
      (parseFloat(costSettings.indirectCosts) || 0) / 100 +
      (parseFloat(costSettings.administrativeExpenses) || 0) / 100
    ) : 0;

    const totalCost = (isNaN(baseCost) ? 0 : baseCost) + (isNaN(additionalCosts) ? 0 : additionalCosts);
    const finalPrice = (isNaN(totalCost) ? 0 : totalCost) * (isNaN(windowQuantity) ? 1 : windowQuantity);
    
    console.log('additionalCosts:', additionalCosts);
    console.log('totalCost:', totalCost);
    console.log('windowQuantity:', windowQuantity);
    console.log('finalPrice:', finalPrice);
    console.log('=== END DEBUG ===');

    // Create detailed description
    const userConfigurableAccessories = windowSystem.accessories.filter(a => a.showToUser);
    const autoManagedProfiles = windowSystem.profiles.filter(p => !p.showToUser);
    const autoManagedAccessories = windowSystem.accessories.filter(a => !a.showToUser);
    
    // Add muntin information to description
    let muntinInfo = '';
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled) {
      const muntinType = req.body.muntinType || windowSystem.muntinConfiguration.muntinType;
      const muntinHorizontal = parseInt(req.body.muntinHorizontal) || windowSystem.muntinConfiguration.horizontalDivisions;
      const muntinVertical = parseInt(req.body.muntinVertical) || windowSystem.muntinConfiguration.verticalDivisions;
      muntinInfo = `Muntins: ${muntinHorizontal}x${muntinVertical} ${muntinType.charAt(0).toUpperCase() + muntinType.slice(1)} Grid`;
    }
    
    const description = `
Window System: ${windowSystem.type}
Glass Type: ${selectedGlass.glass_type} - ${selectedGlass.description}
User-Configured Profiles: ${userConfigurableProfiles.length}
Auto-Managed Profiles: ${autoManagedProfiles.length}
User-Configured Accessories: ${userConfigurableAccessories.length}
Auto-Managed Accessories: ${autoManagedAccessories.length}
${muntinInfo ? muntinInfo + '\n' : ''}${notes ? `Notes: ${notes}` : ''}
    `.trim();

    // Calculate unit price with validation
    const unitPrice = isNaN(finalPrice) || isNaN(windowQuantity) || windowQuantity === 0 
      ? 0 
      : parseFloat((finalPrice / windowQuantity).toFixed(2));
    
    console.log('Final calculations before save:');
    console.log('unitPrice:', unitPrice);
    console.log('finalPrice:', finalPrice);
    
    // Validate all numeric fields before creating WindowItem
    if (isNaN(unitPrice) || isNaN(finalPrice)) {
      console.error('Invalid pricing calculation - cannot save window item');
      console.error('unitPrice:', unitPrice, 'finalPrice:', finalPrice);
      throw new Error('Pricing calculation failed - invalid numeric values');
    }

    // Create window item (totalPrice will be calculated automatically by the model)
    const newWindowItem = new WindowItem({
      projectId,
      itemName: `${windowRef} - ${windowSystem.type}`,
      width: isNaN(windowWidth) ? 0 : windowWidth,
      height: isNaN(windowHeight) ? 0 : windowHeight,
      quantity: isNaN(windowQuantity) ? 1 : windowQuantity,
      unitPrice: unitPrice,
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
      exchangeRate: await getExchangeRate(),
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
    
    // Get exchange rate for currency conversion
    const exchangeRate = await getExchangeRate();

    // Glass cost calculation with validation
    const areaInches = (isNaN(windowWidth) ? 0 : windowWidth) * (isNaN(windowHeight) ? 0 : windowHeight);
    const areaSquareMeters = areaInches / 1550;
    const glassPricePerSqM = parseFloat(selectedGlass.pricePerSquareMeter) || 0;
    const glassCostCOP = convertToCOP(glassPricePerSqM, selectedGlass.currency || 'COP', exchangeRate);
    const glassCost = (isNaN(glassCostCOP) ? 0 : glassCostCOP) * areaSquareMeters;

    // Profile costs calculation (include both user-configurable and auto-managed)
    let profileCostTotal = 0;
    const profileCosts = [];
    
    // Calculate perimeter for profile cost calculation
    const perimeterInches = 2 * (windowWidth + windowHeight);
    const perimeterMeters = perimeterInches / 39.37;
    
    // Define user-configurable profiles first
    const userConfigurableProfiles = windowSystem.profiles.filter(p => p.showToUser);
    
    // Add user-configurable profile costs
    for (const profile of userConfigurableProfiles) {
      const profileCostCOP = convertToCOP(profile.pricePerMeter, profile.currency || 'COP', exchangeRate);
      const profileCost = profileCostCOP * perimeterMeters;
      profileCostTotal += profileCost;
      profileCosts.push({
        name: profile.name,
        cost: profileCost,
        isUserConfigurable: true
      });
    }
    
    // Add auto-managed profile costs
    for (const profile of windowSystem.profiles.filter(p => !p.showToUser)) {
      const profileCostCOP = convertToCOP(profile.pricePerMeter, profile.currency || 'COP', exchangeRate);
      const profileCost = profileCostCOP * perimeterMeters;
      profileCostTotal += profileCost;
      profileCosts.push({
        name: profile.name,
        cost: profileCost,
        isUserConfigurable: false
      });
    }

    // Accessories cost calculation
    let accessoryCostTotal = 0;
    const accessoryCosts = [];
    
    // Process choice group accessories first (from radio buttons/checkboxes)
    const choiceGroupAccessories = [];
    Object.keys(req.body).forEach(key => {
      if (key.startsWith('choiceGroup_')) {
        const groupName = key.replace('choiceGroup_', '');
        const selectedAccessoryIds = Array.isArray(req.body[key]) ? req.body[key] : [req.body[key]];
        
        selectedAccessoryIds.forEach(accessoryId => {
          const quantityKey = `accessories_choice_${groupName}_${accessoryId}_quantity`;
          const priceKey = `accessories_choice_${groupName}_${accessoryId}_price`;
          
          if (req.body[quantityKey] && req.body[priceKey]) {
            const quantity = parseInt(req.body[quantityKey]) || 1;
            const price = parseFloat(req.body[priceKey]) || 0;
            
            // Find the accessory to get its currency
            const accessory = allAccessories.find(a => a._id.toString() === accessoryId);
            const priceCOP = convertToCOP(price, accessory?.currency || 'COP', exchangeRate);
            
            choiceGroupAccessories.push({ accessoryId, quantity, price: priceCOP });
            accessoryCostTotal += priceCOP * quantity;
          }
        });
      }
    });
    
    // Process traditional individual accessories and auto-managed accessories
    windowSystem.accessories.forEach(accessoryItem => {
      const accessory = allAccessories.find(a => a._id.toString() === accessoryItem.accessory.toString());
      if (accessory) {
        // Skip if this accessory was already processed as part of choice groups
        const alreadyProcessed = choiceGroupAccessories.some(cga => cga.accessoryId === accessoryItem.accessory.toString());
        if (alreadyProcessed) {
          return;
        }
        
        let quantity = accessoryItem.quantity;
        
        if (accessoryItem.showToUser && accessories && Array.isArray(accessories)) {
          const userAccessory = accessories.find(a => a.accessoryId === accessoryItem.accessory.toString());
          if (userAccessory) {
            quantity = parseInt(userAccessory.quantity) || accessoryItem.quantity;
          }
        }
        
        const accessoryCostCOP = convertToCOP(accessory.price, accessory.currency || 'COP', exchangeRate);
        accessoryCostTotal += accessoryCostCOP * quantity;
      }
    });

    // Muntin cost calculation
    let muntinCost = 0;
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled) {
      const muntinType = req.body.muntinType;
      const muntinHorizontal = parseInt(req.body.muntinHorizontal) || 1;
      const muntinVertical = parseInt(req.body.muntinVertical) || 1;
      const muntinSpacing = parseFloat(req.body.muntinSpacing) || 0;
      
      // Calculate muntin cost if muntin profile is selected
      if (windowSystem.muntinConfiguration.muntinProfile) {
        const muntinProfile = allProfiles.find(p => p._id.toString() === windowSystem.muntinConfiguration.muntinProfile.toString());
        if (muntinProfile) {
          const muntinPricePerMeter = parseFloat(muntinProfile.pricePerMeter) || 0;
          const muntinCurrency = muntinProfile.currency || 'COP';
          const muntinPricePerMeterCOP = convertToCOP(muntinPricePerMeter, muntinCurrency, exchangeRate);
          
          // Calculate total muntin length based on divisions
          const horizontalMuntins = muntinHorizontal - 1; // Number of horizontal bars
          const verticalMuntins = muntinVertical - 1; // Number of vertical bars
          
          const horizontalLength = horizontalMuntins * windowWidth * 0.0254; // Convert to meters
          const verticalLength = verticalMuntins * windowHeight * 0.0254; // Convert to meters
          
          const totalMuntinLength = horizontalLength + verticalLength;
          muntinCost = muntinPricePerMeterCOP * totalMuntinLength;
        }
      }
    }
    
    // Apply cost settings with validation (only per-window costs: packaging, labor, indirect)
    const baseCost = (isNaN(glassCost) ? 0 : glassCost) + (isNaN(profileCostTotal) ? 0 : profileCostTotal) + (isNaN(accessoryCostTotal) ? 0 : accessoryCostTotal) + (isNaN(muntinCost) ? 0 : muntinCost);
    
    console.log('=== UPDATE PRICING DEBUG ===');
    console.log('glassCost:', glassCost);
    console.log('profileCostTotal:', profileCostTotal);
    console.log('accessoryCostTotal:', accessoryCostTotal);
    console.log('muntinCost:', muntinCost);
    console.log('baseCost:', baseCost);
    
    const additionalCosts = costSettings ? baseCost * (
      (parseFloat(costSettings.packaging) || 0) / 100 +
      (parseFloat(costSettings.labor) || 0) / 100 +
      (parseFloat(costSettings.indirectCosts) || 0) / 100
    ) : 0;

    const totalCost = (isNaN(baseCost) ? 0 : baseCost) + (isNaN(additionalCosts) ? 0 : additionalCosts);
    const finalPrice = (isNaN(totalCost) ? 0 : totalCost) * (isNaN(windowQuantity) ? 1 : windowQuantity);
    
    console.log('finalPrice:', finalPrice, 'windowQuantity:', windowQuantity);
    console.log('=== END UPDATE DEBUG ===');

    // Create updated description
    const userConfigurableAccessories = windowSystem.accessories.filter(a => a.showToUser);
    const autoManagedProfiles = windowSystem.profiles.filter(p => !p.showToUser);
    const autoManagedAccessories = windowSystem.accessories.filter(a => !a.showToUser);
    
    // Add muntin information to description
    let muntinInfo = '';
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled) {
      const muntinType = req.body.muntinType || windowSystem.muntinConfiguration.muntinType;
      const muntinHorizontal = parseInt(req.body.muntinHorizontal) || windowSystem.muntinConfiguration.horizontalDivisions;
      const muntinVertical = parseInt(req.body.muntinVertical) || windowSystem.muntinConfiguration.verticalDivisions;
      muntinInfo = `Muntins: ${muntinHorizontal}x${muntinVertical} ${muntinType.charAt(0).toUpperCase() + muntinType.slice(1)} Grid`;
    }
    
    const description = `
Window System: ${windowSystem.type}
Glass Type: ${selectedGlass.glass_type} - ${selectedGlass.description}
User-Configured Profiles: ${userConfigurableProfiles.length}
Auto-Managed Profiles: ${autoManagedProfiles.length}
User-Configured Accessories: ${userConfigurableAccessories.length}
Auto-Managed Accessories: ${autoManagedAccessories.length}
${muntinInfo ? muntinInfo + '\n' : ''}${notes ? `Notes: ${notes}` : ''}
    `.trim();

    // Calculate unit price with validation
    const unitPrice = isNaN(finalPrice) || isNaN(windowQuantity) || windowQuantity === 0 
      ? 0 
      : parseFloat((finalPrice / windowQuantity).toFixed(2));
    
    console.log('Update calculations before save:');
    console.log('unitPrice:', unitPrice);
    console.log('finalPrice:', finalPrice);
    
    // Validate all numeric fields before updating
    if (isNaN(unitPrice)) {
      console.error('Invalid pricing calculation - cannot update window item');
      console.error('unitPrice:', unitPrice, 'finalPrice:', finalPrice);
      throw new Error('Pricing calculation failed - invalid numeric values');
    }

    // Update the existing window item
    await WindowItem.findByIdAndUpdate(windowId, {
      itemName: `${windowRef} - ${windowSystem.type}`,
      width: isNaN(windowWidth) ? 0 : windowWidth,
      height: isNaN(windowHeight) ? 0 : windowHeight,
      quantity: isNaN(windowQuantity) ? 1 : windowQuantity,
      unitPrice: unitPrice,
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

// Route to duplicate a project with next version
router.post('/projects/:id/duplicate', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;

    // Find the original project
    const originalProject = await Project.findOne({ _id: projectId, userId });
    if (!originalProject) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Generate next version quote number
    const newQuoteNumber = originalProject.quoteNumber 
      ? await generateNextVersion(originalProject.quoteNumber, userId)
      : await generateQuoteNumber(userId);

    // Create new project with same details but new quote number
    const newProject = new Project({
      projectName: originalProject.projectName,
      clientName: originalProject.clientName,
      quoteNumber: newQuoteNumber,
      userId: userId
    });

    await newProject.save();

    // Duplicate all window items
    const originalWindowItems = await WindowItem.find({ projectId: originalProject._id });
    for (const item of originalWindowItems) {
      const newItem = new WindowItem({
        projectId: newProject._id,
        itemName: item.itemName,
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        material: item.material,
        color: item.color,
        style: item.style,
        description: item.description
      });
      await newItem.save();
    }

    res.redirect(`/projects/${newProject._id}`);

  } catch (error) {
    console.error("Error duplicating project:", error);
    res.status(500).send('Failed to duplicate project.');
  }
});

module.exports = router;