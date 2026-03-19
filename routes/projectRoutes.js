// routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); // Adjust path
const WindowItem = require('../models/WindowItem');
const User = require('../models/User');
const { isAuthenticated } = require('./middleware/authMiddleware'); // Adjust path
const { getExchangeRate } = require('../utils/currencyConverter');
const {
  calculateWindowConfigurationPricing
} = require('../utils/pricingCalculator');
const fs = require('fs');
const path = require('path');

// Route to display all projects (list page)
router.get('/projects', isAuthenticated, async (req, res) => {
  try {
    console.log('Projects list route hit!'); // Debug log
    const userId = req.session.userId;
    
    // Fetch all projects belonging to the logged-in user, sort by most recently updated
    const projects = await Project.find({ userId: userId })
                                  .sort({ updatedAt: -1 })
                                  .lean();
    
    // Get window items count for each project
    const WindowItem = require('../models/WindowItem');
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const windowCount = await WindowItem.countDocuments({ projectId: project._id });
        const projectTotal = await WindowItem.aggregate([
          { $match: { projectId: project._id } },
          { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);
        return {
          ...project,
          windowCount,
          projectTotal: projectTotal.length > 0 ? projectTotal[0].total : 0
        };
      })
    );
    
    res.render('projects/listProjects', {
      projects: projectsWithCounts
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).send('Failed to load projects.');
  }
});

// Helper function to recalculate prices for a window item with current costs
// Optional exchangeRateOverride parameter allows using a specific rate (e.g., for project duplication)
async function recalculateWindowItemPrices(windowItem, exchangeRateOverride = null, adminMarkupPercent = 0) {
  try {
    const exchangeRate = exchangeRateOverride || await getExchangeRate();
    const CostSettings = require('../models/CostSettings');
    const WindowSystem = require('../models/Window');
    const Glass = require('../models/Glass');
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');

    const [costSettings, windowSystem, selectedGlass, allProfiles, allAccessories] = await Promise.all([
      CostSettings.findOne(),
      WindowSystem.findById(windowItem.windowSystemId)
        .populate('profiles.profile')
        .populate('accessories.accessory')
        .populate('muntinConfiguration.muntinProfile'),
      windowItem.selectedGlassId ? Glass.findById(windowItem.selectedGlassId) : null,
      Profile.find({}),
      Accessory.find({})
    ]);

    if (!windowSystem) {
      console.error('Window system not found for recalculation');
      return { unitPrice: windowItem.unitPrice, totalPrice: windowItem.totalPrice };
    }

    const pricingResult = calculateWindowConfigurationPricing({
      windowSystem,
      selectedGlass,
      allProfiles,
      allAccessories,
      costSettings,
      exchangeRate,
      windowWidth: windowItem.width,
      windowHeight: windowItem.height,
      windowQuantity: windowItem.quantity,
      adminMarkupPercent,
      selectedProfiles: windowItem.selectedProfiles || [],
      selectedAccessories: windowItem.selectedAccessories || [],
      muntinConfiguration: windowItem.muntinConfiguration
        ? {
            enabled: true,
            horizontalDivisions: windowItem.muntinConfiguration.horizontalDivisions,
            verticalDivisions: windowItem.muntinConfiguration.verticalDivisions,
            muntinProfileId: windowItem.muntinConfiguration.muntinProfileId
          }
        : null
    });

    return {
      unitPrice: pricingResult.unitPrice,
      totalPrice: pricingResult.totalPrice
    };
  } catch (error) {
    console.error('Error recalculating window item prices:', error);
    return { unitPrice: windowItem.unitPrice, totalPrice: windowItem.totalPrice };
  }
}

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

// NEW ROUTE: Bulk delete projects
router.post('/projects/bulk-delete', isAuthenticated, async (req, res) => {
  try {
    const { projectIds } = req.body;
    const userId = req.session.userId;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ error: 'No projects selected for deletion.' });
    }

    // Verify all projects belong to the user
    const projects = await Project.find({ 
      _id: { $in: projectIds }, 
      userId: userId 
    });

    if (projects.length !== projectIds.length) {
      return res.status(403).json({ error: 'Some projects do not belong to you or do not exist.' });
    }

    // Delete all window items associated with these projects
    await WindowItem.deleteMany({ projectId: { $in: projectIds } });

    // Delete all projects
    const deleteResult = await Project.deleteMany({ 
      _id: { $in: projectIds },
      userId: userId 
    });

    console.log(`Bulk deleted ${deleteResult.deletedCount} project(s) by user ${userId}`);

    res.json({ 
      success: true, 
      deletedCount: deleteResult.deletedCount,
      message: `Successfully deleted ${deleteResult.deletedCount} project(s).`
    });

  } catch (error) {
    console.error("Error bulk deleting projects:", error);
    res.status(500).json({ error: 'Failed to delete projects.' });
  }
});

// NEW ROUTE: Quote preview (opens in popup window)
router.get('/projects/:id/quote-preview', isAuthenticated, async (req, res) => {
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

    // Get window system configurations for each window item
    const WindowSystem = require('../models/Window');
    const windowItemsWithConfig = await Promise.all(
      windowItems.map(async (item) => {
        // Try to find the window system by matching the style or extracting from description
        let windowSystem = null;
        if (item.style) {
          windowSystem = await WindowSystem.findOne({ type: item.style })
            .populate('profiles.profile')
            .populate('accessories.accessory')
            .lean();
        }
        
        // If not found, try to extract from description
        if (!windowSystem && item.description) {
          const match = item.description.match(/Window System: ([^\n]+)/);
          if (match) {
            const systemType = match[1].trim();
            windowSystem = await WindowSystem.findOne({ type: systemType })
              .populate('profiles.profile')
              .populate('accessories.accessory')
              .lean();
          }
        }
        
        const plain = {
          ...item.toObject(),
          windowSystem: windowSystem
        };
        // Quoted prices match project details: base DB prices × (1 + markup%)
        const m =
          plain.markup !== undefined && plain.markup !== null && !Number.isNaN(Number(plain.markup))
            ? Number(plain.markup)
            : 20;
        const baseU = Number(plain.unitPrice) || 0;
        const baseT = Number(plain.totalPrice) || 0;
        plain._markupPct = m;
        plain._quotedUnit = baseU * (1 + m / 100);
        plain._quotedLineTotal = baseT * (1 + m / 100);
        return plain;
      })
    );

    const projectTotal = windowItems.reduce((total, item) => total + item.totalPrice, 0);
    const quotedProjectTotal = windowItemsWithConfig.reduce((sum, i) => sum + (i._quotedLineTotal || 0), 0);

    // Get the company logo from user's database record
    const user = await User.findById(userId).lean();
    const companyLogo = user?.companyLogo || null;

    res.render('projects/quotePreview', {
      project,
      windowItems: windowItemsWithConfig,
      projectTotal: projectTotal.toFixed(2),
      quotedProjectTotal: quotedProjectTotal.toFixed(2),
      companyLogo: companyLogo
    });

  } catch (error) {
    console.error("Error fetching quote preview:", error);
    res.status(500).send('Failed to load quote preview.');
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

    // Get window system configurations for each window item
    const windowItemsWithConfig = await Promise.all(
      windowItems.map(async (item) => {
        // Try to find the window system by matching the style or extracting from description
        let windowSystem = null;
        if (item.style) {
          windowSystem = await WindowSystem.findOne({ type: item.style })
            .populate('profiles.profile')
            .populate('accessories.accessory')
            .lean();
        }
        
        // If not found, try to extract from description
        if (!windowSystem && item.description) {
          const match = item.description.match(/Window System: ([^\n]+)/);
          if (match) {
            const systemType = match[1].trim();
            windowSystem = await WindowSystem.findOne({ type: systemType })
              .populate('profiles.profile')
              .populate('accessories.accessory')
              .lean();
          }
        }
        
        return {
          ...item.toObject(),
          windowSystem: windowSystem
        };
      })
    );

    // Calculate total project value
    const projectTotal = windowItems.reduce((total, item) => total + item.totalPrice, 0);

    // Get the company logo from user's database record
    const user = await User.findById(userId).lean();
    const companyLogo = user?.companyLogo || null;

    // Get exchange rate for currency conversion
    // Use the project's frozen exchange rate if available, otherwise get current
    const { getExchangeRate } = require('../utils/currencyConverter');
    const currentExchangeRate = await getExchangeRate();
    const exchangeRate = project.frozenExchangeRate || currentExchangeRate;
    
    // Get cost settings for project-level costs
    const CostSettings = require('../models/CostSettings');
    const costSettings = await CostSettings.findOne();

    res.render('projects/projectDetails', { 
      project, 
      windowItems: windowItemsWithConfig,
      windowSystems,
      projectTotal: projectTotal.toFixed(2),
      companyLogo: companyLogo,
      exchangeRate: exchangeRate,
      currentExchangeRate: currentExchangeRate, // For display purposes
      frozenExchangeRate: project.frozenExchangeRate, // For info display
      exchangeRateFrozenAt: project.exchangeRateFrozenAt,
      costSettings: costSettings || {}
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

// NEW ROUTE: Duplicate a window item
router.post('/projects/:projectId/items/:itemId/duplicate', isAuthenticated, async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const userId = req.session.userId;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Find the original item and verify it belongs to this project
    const originalItem = await WindowItem.findById(itemId);
    if (!originalItem) {
      return res.status(404).send('Window item not found.');
    }

    // Verify that the window item belongs to the specified project
    if (originalItem.projectId.toString() !== projectId) {
      return res.status(403).send('Window item does not belong to this project.');
    }

    // Generate a unique item name
    // Extract base name (remove any existing number suffix like " (2)", " (3)", etc.)
    let baseName = originalItem.itemName;
    const suffixMatch = baseName.match(/^(.+?)\s*\(\d+\)\s*$/);
    if (suffixMatch) {
      baseName = suffixMatch[1].trim(); // Remove the existing suffix
    }
    
    // Find all items with the same base name pattern to determine the next number
    const allItems = await WindowItem.find({ 
      projectId,
      itemName: { $regex: `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(\\d+\\)\\s*$` }
    });
    
    // Extract all numbers from existing items
    const existingNumbers = allItems
      .map(item => {
        const match = item.itemName.match(/\((\d+)\)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    // Find the next available number
    let counter = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    let newItemName = `${baseName} (${counter})`;
    
    // Double-check the name is unique (safety check)
    while (true) {
      const existingItem = await WindowItem.findOne({ 
        projectId, 
        itemName: newItemName,
        _id: { $ne: itemId } // Exclude the original item being duplicated
      });
      
      if (!existingItem) {
        break; // Name is unique
      }
      
      // Try with the next number suffix
      counter++;
      newItemName = `${baseName} (${counter})`;
    }

    // For duplication within the same project (same exchange rate), preserve original prices
    // Only recalculate if material costs might have changed, or if duplicating to a different project
    // Since we're duplicating within the same project, preserve the exact same prices
    // Convert Mongoose document to plain object to avoid issues
    const originalItemObj = originalItem.toObject ? originalItem.toObject() : originalItem;
    
    // Build the item data object, only including fields that are not null/undefined
    // Preserve original prices - they already include admin markup and are correct for this project
    const duplicatedItemData = {
      projectId: originalItemObj.projectId,
      itemName: newItemName,
      width: originalItemObj.width,
      height: originalItemObj.height,
      quantity: originalItemObj.quantity,
      unitPrice: originalItemObj.unitPrice, // Preserve original price (already includes admin markup)
      totalPrice: originalItemObj.totalPrice, // Preserve original price (already includes admin markup)
      material: originalItemObj.material,
      color: originalItemObj.color,
      style: originalItemObj.style,
      description: originalItemObj.description,
      windowSystemId: originalItemObj.windowSystemId || undefined,
      selectedGlassId: originalItemObj.selectedGlassId || undefined,
      missileType: originalItemObj.missileType || undefined,
      includeFlange: originalItemObj.includeFlange || false,
      selectedProfiles: originalItemObj.selectedProfiles || undefined,
      selectedAccessories: originalItemObj.selectedAccessories || undefined,
      notes: originalItemObj.notes || '',
      markup: originalItemObj.markup !== undefined ? originalItemObj.markup : 20 // Preserve markup from original (default 20%)
    };
    
    // Only include muntinConfiguration if it exists and has valid data
    if (originalItemObj.muntinConfiguration && 
        originalItemObj.muntinConfiguration !== null && 
        typeof originalItemObj.muntinConfiguration === 'object' &&
        !Array.isArray(originalItemObj.muntinConfiguration)) {
      // Check if it has at least one meaningful property
      const hasValidData = Object.values(originalItemObj.muntinConfiguration).some(val => val !== null && val !== undefined);
      if (hasValidData) {
        duplicatedItemData.muntinConfiguration = originalItemObj.muntinConfiguration;
      }
    }
    
    const duplicatedItem = new WindowItem(duplicatedItemData);

    await duplicatedItem.save();
    
    res.redirect(`/projects/${projectId}`);

  } catch (error) {
    console.error("Error duplicating window item:", error);
    res.status(500).send('Failed to duplicate window item.');
  }
});

// API endpoint to check if item name already exists in project
router.get('/projects/:projectId/check-item-name', isAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, excludeId } = req.query;
    const userId = req.session.userId;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ exists: false, error: 'Project not found or access denied.' });
    }

    if (!name || !name.trim()) {
      return res.json({ exists: false });
    }

    // Build query with case-insensitive comparison
    const trimmedName = name.trim();
    const query = { 
      projectId, 
      itemName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    };

    // Exclude current item if editing
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingItem = await WindowItem.findOne(query);

    res.json({ 
      exists: !!existingItem,
      message: existingItem ? `An item with the name "${name.trim()}" already exists in this project.` : null
    });
  } catch (error) {
    console.error('Error checking item name:', error);
    res.status(500).json({ error: error.message, exists: false });
  }
});

// API endpoint to update item name
router.patch('/projects/:projectId/items/:itemId/name', isAuthenticated, async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const { itemName } = req.body;
    const userId = req.session.userId;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied.' });
    }

    // Validate item name
    if (!itemName || !itemName.trim()) {
      return res.status(400).json({ error: 'Item name is required.' });
    }

    const trimmedName = itemName.trim();

    // Check if the new item name already exists (excluding the current item) - case-insensitive
    const existingItemWithName = await WindowItem.findOne({ 
      projectId, 
      itemName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: itemId }
    });
    
    if (existingItemWithName) {
      return res.status(400).json({ 
        error: `An item with the name "${trimmedName}" already exists in this project. Please choose a different name.`
      });
    }

    // Find and update the item
    const windowItem = await WindowItem.findOne({ _id: itemId, projectId });
    if (!windowItem) {
      return res.status(404).json({ error: 'Window item not found.' });
    }

    // Update the item name
    windowItem.itemName = trimmedName;
    await windowItem.save();

    res.json({ 
      success: true, 
      itemName: trimmedName,
      message: 'Item name updated successfully.'
    });
  } catch (error) {
    console.error('Error updating item name:', error);
    res.status(500).json({ error: 'Failed to update item name.' });
  }
});

// API endpoint to update item quantity
router.patch('/projects/:projectId/items/:itemId/quantity', isAuthenticated, async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.session.userId;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied.' });
    }

    // Validate quantity
    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }

    // Find and update the item
    const windowItem = await WindowItem.findOne({ _id: itemId, projectId });
    if (!windowItem) {
      return res.status(404).json({ error: 'Window item not found.' });
    }

    // Update the quantity and recalculate total price
    // Keep unit price the same, only update total price
    const unitPrice = windowItem.unitPrice || 0;
    windowItem.quantity = quantityNum;
    windowItem.totalPrice = unitPrice * quantityNum;
    await windowItem.save();

    res.json({ 
      success: true, 
      quantity: quantityNum,
      totalPrice: windowItem.totalPrice,
      message: 'Quantity updated successfully.'
    });
  } catch (error) {
    console.error('Error updating item quantity:', error);
    res.status(500).json({ error: 'Failed to update item quantity.' });
  }
});

// API endpoint to update item markup
router.patch('/projects/:projectId/items/:itemId/markup', isAuthenticated, async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const { markup } = req.body;
    const userId = req.session.userId;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied.' });
    }

    // Validate markup
    const markupNum = parseFloat(markup);
    if (isNaN(markupNum) || markupNum < 0 || markupNum > 1000) {
      return res.status(400).json({ error: 'Markup must be a number between 0 and 1000.' });
    }

    // Find and update the item
    const windowItem = await WindowItem.findOne({ _id: itemId, projectId });
    if (!windowItem) {
      return res.status(404).json({ error: 'Window item not found.' });
    }

    // Update the markup
    windowItem.markup = markupNum;
    await windowItem.save();

    // Calculate displayed prices (with markup applied)
    const baseUnitPrice = windowItem.unitPrice || 0;
    const displayedUnitPrice = baseUnitPrice * (1 + markupNum / 100);
    const displayedTotalPrice = displayedUnitPrice * (windowItem.quantity || 1);

    res.json({ 
      success: true, 
      markup: markupNum,
      displayedUnitPrice: displayedUnitPrice,
      displayedTotalPrice: displayedTotalPrice,
      message: 'Markup updated successfully.'
    });
  } catch (error) {
    console.error('Error updating item markup:', error);
    res.status(500).json({ error: 'Failed to update item markup.' });
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

    // Find the window item and verify it belongs to this project
    const windowItem = await WindowItem.findById(itemId);
    if (!windowItem) {
      return res.status(404).send('Window item not found.');
    }

    // Verify that the window item belongs to the specified project
    if (windowItem.projectId.toString() !== projectId) {
      return res.status(403).send('Window item does not belong to this project.');
    }

    // Delete the window item
    await WindowItem.findByIdAndDelete(itemId);
    
    res.redirect(`/projects/${projectId}`);

  } catch (error) {
    console.error("Error deleting window item:", error);
    res.status(500).send('Failed to delete window item.');
  }
});

// NEW ROUTE: Bulk delete window items
router.post('/projects/:projectId/items/bulk-delete', isAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { itemIds } = req.body;
    const userId = req.session.userId;

    // Verify project ownership
    const mongoose = require('mongoose');
    const projectObjectId = mongoose.Types.ObjectId.isValid(projectId) 
      ? new mongoose.Types.ObjectId(projectId) 
      : projectId;
    
    const project = await Project.findOne({ _id: projectObjectId, userId });
    if (!project) {
      console.log('=== BULK DELETE PROJECT CHECK FAILED ===');
      console.log('ProjectId from params:', projectId);
      console.log('ProjectObjectId:', projectObjectId);
      console.log('UserId:', userId);
      return res.status(404).json({ error: 'Project not found or access denied.' });
    }

    // Validate itemIds
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'No items selected for deletion.' });
    }

    // Verify all items belong to this project
    // Convert itemIds to ObjectIds if they're strings
    const itemObjectIds = itemIds.map(id => {
      try {
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      } catch (e) {
        return id;
      }
    });
    
    const items = await WindowItem.find({ 
      _id: { $in: itemObjectIds },
      projectId: projectObjectId 
    });

    console.log('=== BULK DELETE DEBUG ===');
    console.log('Requested itemIds:', itemIds);
    console.log('Converted itemObjectIds:', itemObjectIds);
    console.log('Found items:', items.length);
    console.log('Expected items:', itemIds.length);
    console.log('Project ID:', projectId);
    console.log('User ID:', userId);
    
    if (items.length !== itemIds.length) {
      const foundIds = items.map(item => item._id.toString());
      const missingIds = itemIds.filter(id => !foundIds.includes(id.toString()));
      console.log('Missing item IDs:', missingIds);
      return res.status(403).json({ 
        error: 'Some items do not belong to this project.',
        details: `Found ${items.length} of ${itemIds.length} items. Missing IDs: ${missingIds.join(', ')}`
      });
    }

    // Delete all items
    const deleteResult = await WindowItem.deleteMany({ 
      _id: { $in: itemObjectIds },
      projectId: projectObjectId 
    });

    console.log(`Deleted ${deleteResult.deletedCount} window item(s) from project ${projectId}`);

    res.json({ 
      success: true, 
      deletedCount: deleteResult.deletedCount,
      message: `Successfully deleted ${deleteResult.deletedCount} item(s).`
    });

  } catch (error) {
    console.error("Error bulk deleting window items:", error);
    res.status(500).json({ error: 'Failed to delete items.' });
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
      .populate('accessories.accessory')
      .populate('missileImpactConfiguration.lmiGlasses')
      .populate('missileImpactConfiguration.smiGlasses');

    if (!selectedWindowSystem) {
      return res.status(404).send('Window system not found.');
    }

    // Get all profiles, accessories, and glasses for manual selection
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const Glass = require('../models/Glass');
    const CostSettings = require('../models/CostSettings');

    const ComponentGroup = require('../models/ComponentGroup');
    const [allProfiles, allAccessories, allGlasses, costSettings, componentGroups] = await Promise.all([
      Profile.find({}).sort({ name: 1 }),
      Accessory.find({}).sort({ name: 1 }),
      Glass.find({}).sort({ glass_type: 1 }),
      CostSettings.findOne(), // Get cost settings for pricing calculations
      ComponentGroup.find({ isActive: true }).sort({ sortOrder: 1, displayName: 1 })
    ]);

    // Create a lookup map for component groups by name
    const componentGroupLookup = {};
    componentGroups.forEach(group => {
      componentGroupLookup[group.name] = {
        displayName: group.displayName,
        selectionType: group.selectionType || 'quantity'
      };
    });

    // Filter user-configurable items
    const userConfigurableProfiles = selectedWindowSystem.profiles.filter(profile => profile.showToUser);
    const userConfigurableAccessories = selectedWindowSystem.accessories.filter(accessory => accessory.showToUser);

    // Group accessories by component groups for choice selection
    const accessoryChoiceGroups = {};
    const individualAccessories = [];
    
    userConfigurableAccessories.forEach(accessoryItem => {
      if (accessoryItem.componentGroup) {
        const groupData = componentGroupLookup[accessoryItem.componentGroup];
        const selectionType = groupData ? groupData.selectionType : 'quantity';
        
        if (selectionType !== 'quantity') {
          if (!accessoryChoiceGroups[accessoryItem.componentGroup]) {
            accessoryChoiceGroups[accessoryItem.componentGroup] = {
              name: accessoryItem.componentGroup,
              displayName: groupData ? groupData.displayName : accessoryItem.componentGroup,
              selectionType: selectionType,
              accessories: []
            };
          }
          accessoryChoiceGroups[accessoryItem.componentGroup].accessories.push(accessoryItem);
        } else {
          // Regular quantity-based hardware
          individualAccessories.push(accessoryItem);
        }
      } else {
        // Regular quantity-based hardware (no component group)
        individualAccessories.push(accessoryItem);
      }
    });



    // Use project's frozen exchange rate if available, otherwise get current
    const currentExchangeRate = await getExchangeRate();
    const exchangeRate = project.frozenExchangeRate || currentExchangeRate;

    // Per-user admin markup (hidden from user; used to show correct selling price)
    const currentUser = await User.findById(userId).lean();
    const adminMarkupPercent = currentUser?.adminMarkupPercent || 0;
    
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
      exchangeRate: exchangeRate,
      frozenExchangeRate: project.frozenExchangeRate,
      adminMarkupPercent: adminMarkupPercent,
      existingWindow: null, // No existing window for new configuration
      isEdit: false        // This is not edit mode
    });

  } catch (error) {
    console.error("Error loading window configuration page:", error);
    res.status(500).send('Failed to load window configuration page.');
  }
});

router.post('/projects/:id/windows/price-preview', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;
    const {
      windowSystemId,
      width,
      height,
      quantity,
      glassType,
      selectedProfiles = [],
      selectedAccessories = [],
      muntinConfiguration = null,
      widthDisplay = '',
      heightDisplay = '',
      currentUnit = 'inches'
    } = req.body;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied.' });
    }

    const WindowSystem = require('../models/Window');
    const Glass = require('../models/Glass');
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const CostSettings = require('../models/CostSettings');

    const [windowSystem, allProfiles, allAccessories, costSettings] = await Promise.all([
      WindowSystem.findById(windowSystemId)
        .populate('profiles.profile')
        .populate('accessories.accessory')
        .populate('muntinConfiguration.muntinProfile'),
      Profile.find({}),
      Accessory.find({}),
      CostSettings.findOne()
    ]);

    if (!windowSystem) {
      return res.status(404).json({ error: 'Window system not found.' });
    }

    let selectedGlass = null;
    const systemHasGlass = (windowSystem.glassWidthEquation && windowSystem.glassWidthEquation.trim()) ||
      (windowSystem.glassHeightEquation && windowSystem.glassHeightEquation.trim());

    if (glassType && String(glassType).trim()) {
      selectedGlass = await Glass.findById(glassType);
      if (!selectedGlass && systemHasGlass) {
        return res.status(404).json({ error: 'Selected glass type not found.' });
      }
    } else if (systemHasGlass) {
      return res.status(400).json({ error: 'Glass type is required for this window system.' });
    }

    let exchangeRate;
    if (project.frozenExchangeRate) {
      exchangeRate = project.frozenExchangeRate;
    } else {
      exchangeRate = await getExchangeRate();
    }

    const currentUser = await User.findById(userId).lean();
    const adminMarkupPercent = currentUser?.adminMarkupPercent || 0;
    const pricingResult = calculateWindowConfigurationPricing({
      windowSystem,
      selectedGlass,
      allProfiles,
      allAccessories,
      costSettings,
      exchangeRate,
      windowWidth: parseFloat(width),
      windowHeight: parseFloat(height),
      windowQuantity: parseInt(quantity, 10),
      adminMarkupPercent,
      selectedProfiles: Array.isArray(selectedProfiles) ? selectedProfiles : [],
      selectedAccessories: Array.isArray(selectedAccessories) ? selectedAccessories : [],
      muntinConfiguration: muntinConfiguration && muntinConfiguration.enabled ? muntinConfiguration : null
    });

    return res.json({
      calculationDetails: {
        exchangeRate,
        widthInches: parseFloat(width) || 0,
        heightInches: parseFloat(height) || 0,
        widthDisplay: widthDisplay || '0',
        heightDisplay: heightDisplay || '0',
        quantity: pricingResult.quantity,
        areaInches: pricingResult.areaInches,
        areaSquareMeters: pricingResult.areaSquareMeters,
        perimeterInches: pricingResult.perimeterInches,
        perimeterMeters: pricingResult.perimeterMeters,
        glassName: selectedGlass ? `${selectedGlass.glass_type} - ${selectedGlass.description}` : 'N/A',
        glassPriceOriginal: pricingResult.glassPriceOriginal,
        glassCurrency: pricingResult.glassCurrency,
        glassPriceUSD: pricingResult.glassPriceUSD,
        glassCost: pricingResult.glassCost,
        glassWidthInches: pricingResult.glassWidthInches,
        glassHeightInches: pricingResult.glassHeightInches,
        glassAreaInches: pricingResult.glassAreaInches,
        glassAreaSquareMeters: pricingResult.glassAreaSquareMeters,
        glassWidthEquation: windowSystem.glassWidthEquation || null,
        glassHeightEquation: windowSystem.glassHeightEquation || null,
        profiles: pricingResult.profileBreakdown.map((profile) => ({
          name: profile.name,
          priceOriginal: profile.priceOriginal,
          currency: profile.currency,
          priceUSD: profile.pricePerMeterUSD,
          quantity: profile.quantity,
          lengthMeters: profile.lengthMeters,
          lengthDiscount: 0,
          adjustedLength: profile.lengthMeters,
          perimeterMeters: profile.perimeterMeters,
          cost: profile.cost,
          isUserConfigurable: profile.isUserConfigurable
        })),
        profilesCost: pricingResult.profileCostTotal,
        accessories: pricingResult.accessoryBreakdown.map((accessory) => ({
          name: accessory.name,
          priceOriginal: accessory.priceOriginal,
          currency: accessory.currency,
          priceUSD: accessory.priceUSD,
          quantity: accessory.quantity,
          cost: accessory.cost,
          isUserConfigurable: accessory.isUserConfigurable
        })),
        accessoriesCost: pricingResult.accessoryCostTotal,
        muntinCost: pricingResult.muntinCost,
        muntinDetails: pricingResult.muntinDetails,
        baseCost: pricingResult.baseCost,
        costSettings: {
          packaging: costSettings?.packaging || 0,
          labor: costSettings?.labor || 0,
          indirectCosts: costSettings?.indirectCosts || 0
        },
        additionalCosts: pricingResult.additionalCosts,
        costPerWindow: pricingResult.totalCostPerWindow,
        finalTotal: pricingResult.totalPrice,
        adminMarkupPercent
      }
    });
  } catch (error) {
    console.error('Error generating price preview:', error);
    res.status(500).json({ error: 'Failed to calculate price preview.' });
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
      notes,
      includeFlange
    } = req.body;

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Get window system for reference (populate profiles and accessories)
    const WindowSystem = require('../models/Window');
    const windowSystem = await WindowSystem.findById(windowSystemId)
      .populate('profiles.profile')
      .populate('accessories.accessory');
    if (!windowSystem) {
      return res.status(404).send('Window system not found.');
    }

    // Get selected glass for pricing (optional - some systems don't have glass)
    const Glass = require('../models/Glass');
    let selectedGlass = null;
    const systemHasGlass = (windowSystem.glassWidthEquation && windowSystem.glassWidthEquation.trim()) || 
                           (windowSystem.glassHeightEquation && windowSystem.glassHeightEquation.trim());
    
    if (glassType && glassType.trim()) {
      selectedGlass = await Glass.findById(glassType);
      if (!selectedGlass && systemHasGlass) {
        return res.status(404).send('Selected glass type not found.');
      }
    } else if (systemHasGlass) {
      // Glass is required for this system but wasn't selected
      return res.status(400).send('Glass type is required for this window system.');
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

    // Get exchange rate - use frozen rate if project has one, otherwise get current and freeze it
    let exchangeRate;
    if (project.frozenExchangeRate) {
      // Use the frozen exchange rate for this project
      exchangeRate = project.frozenExchangeRate;
      console.log('Using frozen exchange rate for project:', exchangeRate);
    } else {
      // First window in project - freeze the current exchange rate
      exchangeRate = await getExchangeRate();
      project.frozenExchangeRate = exchangeRate;
      project.exchangeRateFrozenAt = new Date();
      await project.save();
      console.log('Froze exchange rate for project:', exchangeRate);
    }

    // Calculate pricing
    const windowWidth = parseFloat(width);
    const windowHeight = parseFloat(height);
    const windowQuantity = parseInt(quantity, 10);
    const userConfigurableProfiles = windowSystem.profiles.filter((profile) => profile.showToUser);
    const userConfigurableAccessories = windowSystem.accessories.filter((accessory) => accessory.showToUser);
    const autoManagedProfiles = windowSystem.profiles.filter((profile) => !profile.showToUser);
    const autoManagedAccessories = windowSystem.accessories.filter((accessory) => !accessory.showToUser);

    console.log('=== BACKEND: RECEIVED DIMENSIONS ===');
    console.log('Raw width from form:', width);
    console.log('Parsed windowWidth:', windowWidth);
    console.log('Raw height from form:', height);
    console.log('Parsed windowHeight:', windowHeight);

    if (windowWidth > 500 || windowHeight > 500) {
      console.error('⚠️ WARNING: Dimensions are suspiciously large!');
      console.error('Width:', windowWidth, 'inches (', windowWidth * 25.4, 'mm)');
      console.error('Height:', windowHeight, 'inches (', windowHeight * 25.4, 'mm)');
      console.error('This suggests the frontend did NOT convert mm to inches before submission!');
      console.error('Expected: ~39.37 inches for 1000mm window');
    }

    const selectedProfiles = [];
    if (profiles && Array.isArray(profiles)) {
      profiles.forEach((profileData, index) => {
        if (profileData.profileId && userConfigurableProfiles[index]) {
          selectedProfiles.push({
            profileId: profileData.profileId,
            quantity: parseInt(profileData.quantity, 10) || userConfigurableProfiles[index].quantity || 1,
            lengthDiscount: parseFloat(profileData.lengthDiscount) || 0,
            orientation: profileData.orientation || userConfigurableProfiles[index].orientation || 'horizontal'
          });
        }
      });
    }

    const selectedAccessories = [];
    Object.keys(req.body).forEach((key) => {
      if (!key.startsWith('choiceGroup_')) {
        return;
      }

      const groupName = key.replace('choiceGroup_', '');
      const selectedAccessoryIds = Array.isArray(req.body[key]) ? req.body[key] : [req.body[key]];

      selectedAccessoryIds.forEach((accessoryId) => {
        if (!accessoryId) {
          return;
        }

        const quantityKey = `accessories_choice_${groupName}_${accessoryId}_quantity`;
        const quantity = parseInt(req.body[quantityKey], 10) || 1;
        const accessoryItem = userConfigurableAccessories.find((item) =>
          item.accessory && (item.accessory._id ? item.accessory._id.toString() : item.accessory.toString()) === accessoryId
        );

        selectedAccessories.push({
          accessoryId,
          quantity,
          componentGroup: groupName,
          selectionType: accessoryItem?.selectionType || 'quantity'
        });
      });
    });

    if (accessories && Array.isArray(accessories)) {
      accessories.forEach((accessoryData) => {
        if (!accessoryData.accessoryId) {
          return;
        }

        const alreadyAdded = selectedAccessories.some((selectedAccessory) =>
          selectedAccessory.accessoryId.toString() === accessoryData.accessoryId.toString()
        );

        if (!alreadyAdded) {
          selectedAccessories.push({
            accessoryId: accessoryData.accessoryId,
            quantity: parseInt(accessoryData.quantity, 10) || 1,
            componentGroup: null,
            selectionType: 'quantity'
          });
        }
      });
    }

    const useMuntins = req.body.useMuntins === 'on' || req.body.useMuntins === true;
    let muntinConfig = null;
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled && useMuntins) {
      muntinConfig = {
        muntinType: windowSystem.muntinConfiguration.muntinType || 'colonial',
        horizontalDivisions: parseInt(req.body.muntinHorizontal, 10) || windowSystem.muntinConfiguration.horizontalDivisions || null,
        verticalDivisions: parseInt(req.body.muntinVertical, 10) || windowSystem.muntinConfiguration.verticalDivisions || null,
        spacing: windowSystem.muntinConfiguration.spacing || null,
        muntinProfileId: req.body.muntinProfile || windowSystem.muntinConfiguration.muntinProfile || null
      };
    }

    const currentUser = await User.findById(userId).lean();
    const adminMarkupPercent = currentUser?.adminMarkupPercent || 0;
    const pricingResult = calculateWindowConfigurationPricing({
      windowSystem,
      selectedGlass,
      allProfiles,
      allAccessories,
      costSettings,
      exchangeRate,
      windowWidth,
      windowHeight,
      windowQuantity,
      adminMarkupPercent,
      selectedProfiles,
      selectedAccessories,
      muntinConfiguration: muntinConfig
        ? {
            enabled: true,
            horizontalDivisions: muntinConfig.horizontalDivisions,
            verticalDivisions: muntinConfig.verticalDivisions,
            muntinProfileId: muntinConfig.muntinProfileId
          }
        : null
    });

    const {
      glassCost,
      profileCostTotal,
      accessoryCostTotal,
      muntinCost,
      baseCost,
      additionalCosts,
      totalCostPerWindow,
      totalPrice,
      unitPrice
    } = pricingResult;

    console.log('=== BACKEND PRICING DEBUG ===');
    console.log('glassCost:', glassCost);
    console.log('profileCostTotal:', profileCostTotal);
    console.log('accessoryCostTotal:', accessoryCostTotal);
    console.log('muntinCost:', muntinCost);
    console.log('baseCost:', baseCost);
    console.log('additionalCosts:', additionalCosts);
    console.log('totalCostPerWindow:', totalCostPerWindow);
    console.log('windowQuantity:', windowQuantity);
    console.log('totalPrice:', totalPrice);
    console.log('=== END DEBUG ===');

    let muntinInfo = '';
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled && useMuntins) {
      const muntinHorizontal = parseInt(req.body.muntinHorizontal, 10) || windowSystem.muntinConfiguration.horizontalDivisions;
      const muntinVertical = parseInt(req.body.muntinVertical, 10) || windowSystem.muntinConfiguration.verticalDivisions;
      muntinInfo = `Muntins: ${muntinHorizontal}x${muntinVertical} Grid`;
    }

    let flangeInfo = '';
    if (windowSystem.flangeConfiguration && windowSystem.flangeConfiguration.hasFlange) {
      const shouldIncludeFlange = windowSystem.flangeConfiguration.isTrimable
        ? includeFlange === 'on' || includeFlange === true
        : true;

      if (shouldIncludeFlange && windowSystem.flangeConfiguration.flangeSize) {
        flangeInfo = `Flanged: ${windowSystem.flangeConfiguration.flangeSize}"\n`;
      }
    }

    const missileType = req.body.missileType || '';
    let missileInfo = '';
    if (missileType && (missileType === 'LMI' || missileType === 'SMI')) {
      const missileTypeLabel = missileType === 'LMI' ? 'Large Missile Impact (LMI)' : 'Small Missile Impact (SMI)';
      missileInfo = `Missile Impact: ${missileTypeLabel}\n`;
    }

    const glassInfo = selectedGlass
      ? `Glass Type: ${selectedGlass.glass_type} - ${selectedGlass.description}`
      : 'Glass: None (profiles only)';

    const description = `
Window System: ${windowSystem.type}
${glassInfo}
${missileInfo}${flangeInfo}User-Configured Profiles: ${userConfigurableProfiles.length}
Auto-Managed Profiles: ${autoManagedProfiles.length}
User-Configured Accessories: ${userConfigurableAccessories.length}
Auto-Managed Accessories: ${autoManagedAccessories.length}
${muntinInfo ? muntinInfo + '\n' : ''}${notes ? `Notes: ${notes}` : ''}
    `.trim();

    const existingItemWithName = await WindowItem.findOne({
      projectId,
      itemName: { $regex: new RegExp(`^${windowRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (existingItemWithName) {
      return res.status(400).send(`An item with the name "${windowRef}" already exists in this project. Please choose a different name.`);
    }

    console.log('=== FINAL CALCULATIONS BEFORE SAVE ===');
    console.log('baseCost:', baseCost);
    console.log('additionalCosts:', additionalCosts);
    console.log('totalCostPerWindow:', totalCostPerWindow);
    console.log('windowQuantity:', windowQuantity);
    console.log('unitPrice:', unitPrice);
    console.log('totalPrice:', totalPrice);
    console.log('=== END FINAL CALCULATIONS ===');

    if (Number.isNaN(unitPrice) || Number.isNaN(totalPrice)) {
      console.error('Invalid pricing calculation - cannot save window item');
      console.error('unitPrice:', unitPrice, 'totalPrice:', totalPrice);
      throw new Error('Pricing calculation failed - invalid numeric values');
    }

    const MAX_REASONABLE_UNIT_PRICE_USD = 1500000;
    if (unitPrice > MAX_REASONABLE_UNIT_PRICE_USD) {
      console.error('Unit price exceeds maximum reasonable value:', unitPrice);
      console.error('Pricing breakdown:', {
        glassCost,
        profileCostTotal,
        accessoryCostTotal,
        muntinCost,
        baseCost,
        additionalCosts,
        totalCostPerWindow,
        totalPrice,
        windowQuantity
      });
      return res.status(400).send(`Calculated unit price ($${unitPrice.toLocaleString()}) exceeds the maximum reasonable value. This may indicate a calculation error. Please check the window dimensions, glass type, profiles, and accessories.`);
    }
    
    // Create window item with explicit totalPrice to maintain accuracy
    console.log('=== CREATING WINDOW ITEM ===');
    console.log('Setting unitPrice:', unitPrice);
    console.log('Setting totalPrice:', totalPrice);
    console.log('Setting quantity:', windowQuantity);
    console.log('Expected: totalPrice should be preserved, not recalculated from unitPrice * quantity');
    
    // Debug logging for dimensions and pricing
    console.log('=== SAVING WINDOW ITEM ===');
    console.log('Received width:', width, '-> parsed as:', windowWidth);
    console.log('Received height:', height, '-> parsed as:', windowHeight);
    console.log('unitPrice calculated:', unitPrice);
    console.log('totalPrice calculated:', totalPrice);
    
    const newWindowItem = new WindowItem({
      projectId,
      itemName: windowRef,
      width: isNaN(windowWidth) ? 0 : windowWidth,
      height: isNaN(windowHeight) ? 0 : windowHeight,
      quantity: isNaN(windowQuantity) ? 1 : windowQuantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice, // Use finalPrice directly to maintain accuracy
      markup: 0, // Ensure markup is 0 when saving base price (will be applied later in UI)
      material: 'Aluminum/Glass',
      color: 'Various',
      style: windowSystem.type,
      description: description,
      windowSystemId: windowSystemId,
      selectedGlassId: glassType && glassType.trim() ? glassType : null,
      missileType: missileType || null,
      includeFlange: includeFlange === 'on' || includeFlange === true,
      selectedProfiles: selectedProfiles,
      selectedAccessories: selectedAccessories,
      muntinConfiguration: muntinConfig,
      notes: notes || ''
    });
    
    console.log('WindowItem created, values before save:');
    console.log('  unitPrice:', newWindowItem.unitPrice);
    console.log('  totalPrice:', newWindowItem.totalPrice);
    console.log('  quantity:', newWindowItem.quantity);

    await newWindowItem.save();
    
    console.log('WindowItem saved, values after save:');
    console.log('  unitPrice:', newWindowItem.unitPrice);
    console.log('  totalPrice:', newWindowItem.totalPrice);
    console.log('  quantity:', newWindowItem.quantity);
    console.log('=== END CREATING WINDOW ITEM ===');

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
      .populate('accessories.accessory')
      .populate('missileImpactConfiguration.lmiGlasses')
      .populate('missileImpactConfiguration.smiGlasses');

    // If not found, get the first available window system as fallback
    if (!selectedWindowSystem) {
      selectedWindowSystem = await WindowSystem.findOne({})
        .populate('profiles.profile')
        .populate('accessories.accessory')
        .populate('missileImpactConfiguration.lmiGlasses')
        .populate('missileImpactConfiguration.smiGlasses');
    }

    if (!selectedWindowSystem) {
      return res.status(404).send('No window systems available.');
    }

    // Get all profiles, accessories, and glasses for manual selection
    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const Glass = require('../models/Glass');
    const CostSettings = require('../models/CostSettings');
    const ComponentGroup = require('../models/ComponentGroup');

    const [allProfiles, allAccessories, allGlasses, costSettings, componentGroups] = await Promise.all([
      Profile.find({}).sort({ name: 1 }),
      Accessory.find({}).sort({ name: 1 }),
      Glass.find({}).sort({ glass_type: 1 }),
      CostSettings.findOne(),
      ComponentGroup.find({ isActive: true }).sort({ sortOrder: 1, displayName: 1 })
    ]);

    // Filter user-configurable items
    let userConfigurableProfiles = selectedWindowSystem.profiles.filter(profile => profile.showToUser);
    const userConfigurableAccessories = selectedWindowSystem.accessories.filter(accessory => accessory.showToUser);

    // Restore saved profile selections if they exist
    if (existingWindow.selectedProfiles && existingWindow.selectedProfiles.length > 0) {
      // Map saved selections to user-configurable profiles
      userConfigurableProfiles = userConfigurableProfiles.map((profileItem, index) => {
        const savedProfile = existingWindow.selectedProfiles[index];
        if (savedProfile && savedProfile.profileId) {
          // Find the saved profile in allProfiles
          const savedProfileDoc = allProfiles.find(p => 
            p._id.toString() === savedProfile.profileId.toString()
          );
          
          if (savedProfileDoc) {
            // Create a modified profile item with saved selections
            return {
              ...profileItem.toObject ? profileItem.toObject() : profileItem,
              profile: savedProfileDoc,
              quantity: savedProfile.quantity || profileItem.quantity || 1,
              lengthDiscount: savedProfile.lengthDiscount || profileItem.lengthDiscount || 0,
              orientation: savedProfile.orientation || profileItem.orientation || 'horizontal'
            };
          }
        }
        return profileItem;
      });
    }

    // Create a lookup map for component groups by name
    const componentGroupLookup = {};
    componentGroups.forEach(group => {
      componentGroupLookup[group.name] = {
        displayName: group.displayName,
        selectionType: group.selectionType || 'quantity'
      };
    });

    // Group accessories by component groups for choice selection
    const accessoryChoiceGroups = {};
    const individualAccessories = [];
    
    userConfigurableAccessories.forEach(accessoryItem => {
      if (accessoryItem.componentGroup) {
        const groupData = componentGroupLookup[accessoryItem.componentGroup];
        const selectionType = groupData ? groupData.selectionType : 'quantity';
        
        if (selectionType !== 'quantity') {
          if (!accessoryChoiceGroups[accessoryItem.componentGroup]) {
            accessoryChoiceGroups[accessoryItem.componentGroup] = {
              name: accessoryItem.componentGroup,
              displayName: groupData ? groupData.displayName : accessoryItem.componentGroup,
              selectionType: selectionType,
              accessories: []
            };
          }
          accessoryChoiceGroups[accessoryItem.componentGroup].accessories.push(accessoryItem);
        } else {
          // Regular quantity-based hardware
          individualAccessories.push(accessoryItem);
        }
      } else {
        // Regular quantity-based accessories (no component group)
        individualAccessories.push(accessoryItem);
      }
    });
    
    // Restore saved hardware selections
    const savedAccessorySelections = {};
    if (existingWindow.selectedAccessories && existingWindow.selectedAccessories.length > 0) {
      existingWindow.selectedAccessories.forEach(savedAcc => {
        const accId = savedAcc.accessoryId ? savedAcc.accessoryId.toString() : null;
        if (accId) {
          // Get selectionType from component group if available
          let selectionType = 'quantity';
          if (savedAcc.componentGroup) {
            const groupData = componentGroupLookup[savedAcc.componentGroup];
            selectionType = groupData ? groupData.selectionType : 'quantity';
          }
          
          savedAccessorySelections[accId] = {
            quantity: savedAcc.quantity || 1,
            componentGroup: savedAcc.componentGroup,
            selectionType: selectionType
          };
        }
      });
    }

    // Restore saved profile selections
    const savedProfileSelections = {};
    if (existingWindow.selectedProfiles && existingWindow.selectedProfiles.length > 0) {
      existingWindow.selectedProfiles.forEach((savedProfile, index) => {
        const profileId = savedProfile.profileId ? savedProfile.profileId.toString() : null;
        if (profileId) {
          savedProfileSelections[index] = {
            profileId: profileId,
            quantity: savedProfile.quantity || 1,
            lengthDiscount: savedProfile.lengthDiscount || 0,
            orientation: savedProfile.orientation || 'horizontal'
          };
        }
      });
    }

    // Extract the selected glass ID for pre-selection
    const preSelectedGlassId = existingWindow.selectedGlassId 
      ? existingWindow.selectedGlassId.toString() 
      : null;
    
    // Extract missile type for pre-selection
    const preSelectedMissileType = existingWindow.missileType || '';

    // Use project's frozen exchange rate (should exist since window already exists)
    const currentExchangeRate = await getExchangeRate();
    const exchangeRate = project.frozenExchangeRate || currentExchangeRate;

    // Per-user admin markup (hidden from user; used to show correct selling price)
    const currentUser = await User.findById(userId).lean();
    const adminMarkupPercent = currentUser?.adminMarkupPercent || 0;
    
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
      exchangeRate: exchangeRate,
      frozenExchangeRate: project.frozenExchangeRate,
      adminMarkupPercent: adminMarkupPercent,
      existingWindow, // Pass existing window data for pre-filling form
      savedAccessorySelections, // Pass saved accessory selections for restoration
      savedProfileSelections, // Pass saved profile selections for restoration
      preSelectedGlassId, // Pass the saved glass ID directly
      preSelectedMissileType, // Pass the saved missile type directly
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
      notes,
      includeFlange
    } = req.body;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    const existingWindow = await WindowItem.findOne({ _id: windowId, projectId });
    if (!existingWindow) {
      return res.status(404).send('Window not found.');
    }

    const WindowSystem = require('../models/Window');
    const windowSystem = await WindowSystem.findById(windowSystemId)
      .populate('profiles.profile')
      .populate('accessories.accessory');
    if (!windowSystem) {
      return res.status(404).send('Window system not found.');
    }

    const Glass = require('../models/Glass');
    let selectedGlass = null;
    const systemHasGlass = (windowSystem.glassWidthEquation && windowSystem.glassWidthEquation.trim()) ||
      (windowSystem.glassHeightEquation && windowSystem.glassHeightEquation.trim());

    if (glassType && glassType.trim()) {
      selectedGlass = await Glass.findById(glassType);
      if (!selectedGlass && systemHasGlass) {
        return res.status(404).send('Selected glass type not found.');
      }
    } else if (systemHasGlass) {
      return res.status(400).send('Glass type is required for this window system.');
    }

    const Profile = require('../models/Profile');
    const Accessory = require('../models/Accessory');
    const CostSettings = require('../models/CostSettings');

    const [allProfiles, allAccessories, costSettings] = await Promise.all([
      Profile.find({}),
      Accessory.find({}),
      CostSettings.findOne()
    ]);

    let exchangeRate;
    if (project.frozenExchangeRate) {
      exchangeRate = project.frozenExchangeRate;
      console.log('Using frozen exchange rate for update:', exchangeRate);
    } else {
      exchangeRate = await getExchangeRate();
      project.frozenExchangeRate = exchangeRate;
      project.exchangeRateFrozenAt = new Date();
      await project.save();
      console.log('Froze exchange rate during update:', exchangeRate);
    }

    const windowWidth = parseFloat(width);
    const windowHeight = parseFloat(height);
    const windowQuantity = parseInt(quantity, 10);
    const userConfigurableProfiles = windowSystem.profiles.filter((profile) => profile.showToUser);
    const userConfigurableAccessories = windowSystem.accessories.filter((accessory) => accessory.showToUser);
    const autoManagedProfiles = windowSystem.profiles.filter((profile) => !profile.showToUser);
    const autoManagedAccessories = windowSystem.accessories.filter((accessory) => !accessory.showToUser);

    const selectedProfiles = [];
    if (profiles && Array.isArray(profiles)) {
      profiles.forEach((profileData, index) => {
        if (profileData.profileId && userConfigurableProfiles[index]) {
          selectedProfiles.push({
            profileId: profileData.profileId,
            quantity: parseInt(profileData.quantity, 10) || userConfigurableProfiles[index].quantity || 1,
            lengthDiscount: parseFloat(profileData.lengthDiscount) || 0,
            orientation: profileData.orientation || userConfigurableProfiles[index].orientation || 'horizontal'
          });
        }
      });
    }

    const selectedAccessories = [];
    Object.keys(req.body).forEach((key) => {
      if (!key.startsWith('choiceGroup_')) {
        return;
      }

      const groupName = key.replace('choiceGroup_', '');
      const selectedAccessoryIds = Array.isArray(req.body[key]) ? req.body[key] : [req.body[key]];

      selectedAccessoryIds.forEach((accessoryId) => {
        if (!accessoryId) {
          return;
        }

        const quantityKey = `accessories_choice_${groupName}_${accessoryId}_quantity`;
        const quantityForSelection = parseInt(req.body[quantityKey], 10) || 1;
        const accessoryItem = userConfigurableAccessories.find((item) =>
          item.accessory && (item.accessory._id ? item.accessory._id.toString() : item.accessory.toString()) === accessoryId
        );

        selectedAccessories.push({
          accessoryId,
          quantity: quantityForSelection,
          componentGroup: groupName,
          selectionType: accessoryItem?.selectionType || 'quantity'
        });
      });
    });

    if (accessories && Array.isArray(accessories)) {
      accessories.forEach((accessoryData) => {
        if (!accessoryData.accessoryId) {
          return;
        }

        const alreadyAdded = selectedAccessories.some((selectedAccessory) =>
          selectedAccessory.accessoryId.toString() === accessoryData.accessoryId.toString()
        );

        if (!alreadyAdded) {
          selectedAccessories.push({
            accessoryId: accessoryData.accessoryId,
            quantity: parseInt(accessoryData.quantity, 10) || 1,
            componentGroup: null,
            selectionType: 'quantity'
          });
        }
      });
    }

    const useMuntins = req.body.useMuntins === 'on' || req.body.useMuntins === true;
    let muntinConfig = null;
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled && useMuntins) {
      muntinConfig = {
        muntinType: windowSystem.muntinConfiguration.muntinType || 'colonial',
        horizontalDivisions: parseInt(req.body.muntinHorizontal, 10) || windowSystem.muntinConfiguration.horizontalDivisions || null,
        verticalDivisions: parseInt(req.body.muntinVertical, 10) || windowSystem.muntinConfiguration.verticalDivisions || null,
        spacing: windowSystem.muntinConfiguration.spacing || null,
        muntinProfileId: req.body.muntinProfile || windowSystem.muntinConfiguration.muntinProfile || null
      };
    }

    const currentUser = await User.findById(userId).lean();
    const adminMarkupPercent = currentUser?.adminMarkupPercent || 0;
    const pricingResult = calculateWindowConfigurationPricing({
      windowSystem,
      selectedGlass,
      allProfiles,
      allAccessories,
      costSettings,
      exchangeRate,
      windowWidth,
      windowHeight,
      windowQuantity,
      adminMarkupPercent,
      selectedProfiles,
      selectedAccessories,
      muntinConfiguration: muntinConfig
        ? {
            enabled: true,
            horizontalDivisions: muntinConfig.horizontalDivisions,
            verticalDivisions: muntinConfig.verticalDivisions,
            muntinProfileId: muntinConfig.muntinProfileId
          }
        : null
    });

    const {
      glassCost,
      profileCostTotal,
      accessoryCostTotal,
      muntinCost,
      baseCost,
      additionalCosts,
      totalCostPerWindow,
      totalPrice,
      unitPrice
    } = pricingResult;

    console.log('=== UPDATE PRICING DEBUG ===');
    console.log('glassCost:', glassCost);
    console.log('profileCostTotal:', profileCostTotal);
    console.log('accessoryCostTotal:', accessoryCostTotal);
    console.log('muntinCost:', muntinCost);
    console.log('baseCost:', baseCost);
    console.log('additionalCosts:', additionalCosts);
    console.log('totalCostPerWindow:', totalCostPerWindow);
    console.log('windowQuantity:', windowQuantity);
    console.log('totalPrice:', totalPrice);
    console.log('=== END UPDATE DEBUG ===');

    let muntinInfo = '';
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled && useMuntins) {
      const muntinHorizontal = parseInt(req.body.muntinHorizontal, 10) || windowSystem.muntinConfiguration.horizontalDivisions;
      const muntinVertical = parseInt(req.body.muntinVertical, 10) || windowSystem.muntinConfiguration.verticalDivisions;
      muntinInfo = `Muntins: ${muntinHorizontal}x${muntinVertical} Grid`;
    }

    let flangeInfo = '';
    if (windowSystem.flangeConfiguration && windowSystem.flangeConfiguration.hasFlange) {
      const shouldIncludeFlange = windowSystem.flangeConfiguration.isTrimable
        ? includeFlange === 'on' || includeFlange === true
        : true;

      if (shouldIncludeFlange && windowSystem.flangeConfiguration.flangeSize) {
        flangeInfo = `Flanged: ${windowSystem.flangeConfiguration.flangeSize}"\n`;
      }
    }

    const missileType = req.body.missileType || '';
    let missileInfo = '';
    if (missileType && (missileType === 'LMI' || missileType === 'SMI')) {
      const missileTypeLabel = missileType === 'LMI' ? 'Large Missile Impact (LMI)' : 'Small Missile Impact (SMI)';
      missileInfo = `Missile Impact: ${missileTypeLabel}\n`;
    }

    const glassInfo = selectedGlass
      ? `Glass Type: ${selectedGlass.glass_type} - ${selectedGlass.description}`
      : 'Glass: None (profiles only)';

    const description = `
Window System: ${windowSystem.type}
${glassInfo}
${missileInfo}${flangeInfo}User-Configured Profiles: ${userConfigurableProfiles.length}
Auto-Managed Profiles: ${autoManagedProfiles.length}
User-Configured Accessories: ${userConfigurableAccessories.length}
Auto-Managed Accessories: ${autoManagedAccessories.length}
${muntinInfo ? muntinInfo + '\n' : ''}${notes ? `Notes: ${notes}` : ''}
    `.trim();

    if (Number.isNaN(unitPrice) || Number.isNaN(totalPrice)) {
      console.error('Invalid pricing calculation - cannot update window item');
      console.error('unitPrice:', unitPrice, 'totalPrice:', totalPrice);
      throw new Error('Pricing calculation failed - invalid numeric values');
    }

    const MAX_REASONABLE_UNIT_PRICE_USD = 1000000;
    if (unitPrice > MAX_REASONABLE_UNIT_PRICE_USD) {
      console.error('Unit price exceeds maximum reasonable value:', unitPrice);
      return res.status(400).send(`Calculated unit price ($${unitPrice.toLocaleString()}) exceeds the maximum reasonable value. This may indicate a calculation error. Please check the window dimensions, glass type, profiles, and accessories.`);
    }

    const existingItemWithName = await WindowItem.findOne({
      projectId,
      itemName: { $regex: new RegExp(`^${windowRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: windowId }
    });

    if (existingItemWithName) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          error: `An item with the name "${windowRef}" already exists in this project. Please choose a different name.`,
          field: 'windowRef'
        });
      }
      return res.status(400).send(`An item with the name "${windowRef}" already exists in this project. Please choose a different name.`);
    }

    console.log('Setting totalPrice to calculated value:', totalPrice);
    console.log('Setting unitPrice to:', unitPrice);

    await WindowItem.findByIdAndUpdate(windowId, {
      itemName: windowRef,
      width: Number.isNaN(windowWidth) ? 0 : windowWidth,
      height: Number.isNaN(windowHeight) ? 0 : windowHeight,
      quantity: Number.isNaN(windowQuantity) ? 1 : windowQuantity,
      unitPrice,
      totalPrice,
      material: 'Aluminum/Glass',
      color: 'Various',
      style: windowSystem.type,
      description,
      windowSystemId,
      selectedGlassId: glassType && glassType.trim() ? glassType : null,
      missileType: missileType || null,
      includeFlange: includeFlange === 'on' || includeFlange === true,
      selectedProfiles,
      selectedAccessories,
      muntinConfiguration: muntinConfig,
      notes: notes || ''
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

    // Get CURRENT exchange rate for the new project (not the frozen one from original)
    const currentExchangeRate = await getExchangeRate();

    // Create new project with same details but new quote number and CURRENT exchange rate
    const newProject = new Project({
      projectName: originalProject.projectName,
      clientName: originalProject.clientName,
      quoteNumber: newQuoteNumber,
      userId: userId,
      // Freeze the current exchange rate for the duplicated project
      frozenExchangeRate: currentExchangeRate,
      exchangeRateFrozenAt: new Date()
    });

    await newProject.save();
    console.log('Duplicated project with new exchange rate:', currentExchangeRate, '(original was:', originalProject.frozenExchangeRate || 'not frozen', ')');

    // Duplicate all window items with recalculated prices using the NEW exchange rate
    const originalWindowItems = await WindowItem.find({ projectId: originalProject._id });
    for (const item of originalWindowItems) {
      // Recalculate prices with current costs and the NEW exchange rate
      const currentUser = await User.findById(userId).lean();
      const adminMarkupPercent = currentUser?.adminMarkupPercent || 0;
      const recalculatedPrices = await recalculateWindowItemPrices(item, currentExchangeRate, adminMarkupPercent);
      
      // Convert Mongoose document to plain object to avoid issues
      const itemObj = item.toObject ? item.toObject() : item;
      
      // Build the item data object, only including fields that are not null/undefined
      const newItemData = {
        projectId: newProject._id,
        itemName: itemObj.itemName,
        width: itemObj.width,
        height: itemObj.height,
        quantity: itemObj.quantity,
        unitPrice: recalculatedPrices.unitPrice,
        totalPrice: recalculatedPrices.totalPrice,
        material: itemObj.material,
        color: itemObj.color,
        style: itemObj.style,
        description: itemObj.description,
        windowSystemId: itemObj.windowSystemId || undefined,
        selectedGlassId: itemObj.selectedGlassId || undefined,
        missileType: itemObj.missileType || undefined,
        includeFlange: itemObj.includeFlange || false,
        selectedProfiles: itemObj.selectedProfiles || undefined,
        selectedAccessories: itemObj.selectedAccessories || undefined,
        notes: itemObj.notes || '',
        markup: itemObj.markup !== undefined ? itemObj.markup : 20 // Preserve markup from original (default 20%)
      };
      
      // Only include muntinConfiguration if it exists and has valid data
      if (itemObj.muntinConfiguration && 
          itemObj.muntinConfiguration !== null && 
          typeof itemObj.muntinConfiguration === 'object' &&
          !Array.isArray(itemObj.muntinConfiguration)) {
        // Check if it has at least one meaningful property
        const hasValidData = Object.values(itemObj.muntinConfiguration).some(val => val !== null && val !== undefined);
        if (hasValidData) {
          newItemData.muntinConfiguration = itemObj.muntinConfiguration;
        }
      }
      
      const newItem = new WindowItem(newItemData);
      await newItem.save();
    }

    res.redirect(`/projects/${newProject._id}`);

  } catch (error) {
    console.error("Error duplicating project:", error);
    res.status(500).send('Failed to duplicate project.');
  }
});

// Route to export quote as PDF (for quote preview)
router.get('/projects/:id/quote-pdf', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    // Get unit preference from query parameter (default to inches)
    const unit = req.query.unit || 'inches';

    // Find the project and ensure it belongs to the current user
    const project = await Project.findOne({ _id: projectId, userId });

    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Get all window items for this project
    const windowItems = await WindowItem.find({ projectId }).sort({ createdAt: -1 });

    // Calculate total project value
    const projectTotal = windowItems.reduce((total, item) => total + item.totalPrice, 0);
    
    // Helper function to format dimensions based on unit
    const formatDimension = (widthInches, heightInches) => {
      if (unit === 'mm') {
        const widthMm = Math.round(widthInches * 25.4);
        const heightMm = Math.round(heightInches * 25.4);
        return `${widthMm} × ${heightMm}`;
      } else {
        return `${parseFloat(widthInches).toFixed(2)} × ${parseFloat(heightInches).toFixed(2)}`;
      }
    };
    
    const dimensionUnitLabel = unit === 'mm' ? 'mm' : 'in';

    // Get company logo path from user's database record
    const user = await User.findById(userId).lean();
    let logoPath = null;
    if (user?.companyLogo) {
      // Convert the URL path to a file system path
      const logoUrl = user.companyLogo;
      // Remove leading slash and join with public directory
      const relativePath = logoUrl.startsWith('/') ? logoUrl.substring(1) : logoUrl;
      const fullPath = path.join(__dirname, '../public', relativePath);
      if (fs.existsSync(fullPath)) {
        logoPath = fullPath;
      }
    }

    // Calculate dates
    const quoteDate = new Date();
    const validThroughDate = new Date(quoteDate);
    validThroughDate.setMonth(validThroughDate.getMonth() + 1);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Quote_${project.projectName.replace(/[^a-z0-9]/gi, '_')}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header Section
    let yPos = 50;
    
    // Logo (if available)
    if (logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, yPos, { width: 100, height: 100, fit: [100, 100] });
      } catch (e) {
        console.error('Error loading logo:', e);
      }
    }
    
    // Title and project info
    doc.fontSize(24).font('Helvetica-Bold')
       .text(project.projectName, 450, yPos, { align: 'right', width: 100 });
    
    yPos += 30;
    
    if (project.clientName) {
      doc.fontSize(14).font('Helvetica')
         .text(`Client: ${project.clientName}`, 450, yPos, { align: 'right', width: 100 });
      yPos += 20;
    }
    
    // Dates
    doc.fontSize(10).font('Helvetica')
       .text(`Quote Date: ${quoteDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 450, yPos, { align: 'right', width: 100 });
    yPos += 15;
    doc.text(`Valid Through: ${validThroughDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 450, yPos, { align: 'right', width: 100 });
    
    yPos = 180;

    // Window Items Table
    if (windowItems.length > 0) {
      doc.fontSize(18).font('Helvetica-Bold')
         .text('Window Items', 50, yPos);
      yPos += 30;

      // Table headers
      const tableTop = yPos;
      const colWidths = [30, 180, 100, 60, 100, 100];
      const tableLeft = 50;
      
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('#', tableLeft, tableTop);
      doc.text('Item Name', tableLeft + colWidths[0], tableTop);
      doc.text(`Dimensions (${dimensionUnitLabel})`, tableLeft + colWidths[0] + colWidths[1], tableTop);
      doc.text('Qty', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop, { width: colWidths[3], align: 'center' });
      doc.text('Unit Price', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop, { width: colWidths[4], align: 'right' });
      doc.text('Total', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop, { width: colWidths[5], align: 'right' });
      
      // Draw header line
      doc.moveTo(tableLeft, tableTop + 15)
         .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
         .stroke();
      
      yPos = tableTop + 25;
      doc.font('Helvetica');
      
      windowItems.forEach((item, index) => {
        // Check if we need a new page
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.fontSize(9);
        doc.text((index + 1).toString(), tableLeft, yPos);
        
        // Item name with description if available
        let itemText = item.itemName;
        if (item.description && item.description.length > 60) {
          itemText += '\n' + item.description.substring(0, 60) + '...';
        } else if (item.description) {
          itemText += '\n' + item.description;
        }
        doc.text(itemText, tableLeft + colWidths[0], yPos, { width: colWidths[1] });
        
        doc.text(formatDimension(item.width, item.height), 
                 tableLeft + colWidths[0] + colWidths[1], yPos, { width: colWidths[2] });
        doc.text(item.quantity.toString(), 
                 tableLeft + colWidths[0] + colWidths[1] + colWidths[2], yPos, { width: colWidths[3], align: 'center' });
        doc.text(`$${parseFloat(item.unitPrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 
                 tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos, { width: colWidths[4], align: 'right' });
        doc.text(`$${parseFloat(item.totalPrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 
                 tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPos, { width: colWidths[5], align: 'right' });
        
        // Calculate height needed for this row
        const lines = item.description ? Math.ceil(item.description.length / 60) + 1 : 1;
        yPos += (lines * 12) + 5;
      });

      // Total row
      yPos += 10;
      doc.moveTo(tableLeft, yPos)
         .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), yPos)
         .stroke();
      
      yPos += 15;
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Total Project Value:', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos, { width: colWidths[4], align: 'right' });
      doc.fontSize(16);
      doc.text(`$${parseFloat(projectTotal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 
               tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPos, { width: colWidths[5], align: 'right' });
    } else {
      doc.fontSize(12).text('No window items in this quote.', { align: 'center' });
    }

    // Footer
    yPos = 750;
    doc.fontSize(8).font('Helvetica')
       .text('This is a preview of the quotation. For official quotes, please contact your representative.', 
             50, yPos, { align: 'center', width: 500 });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error("Error generating quote PDF:", error);
    res.status(500).send('Failed to generate PDF.');
  }
});

// Route to export project as PDF
router.get('/projects/:id/export-pdf', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId;
    const PDFDocument = require('pdfkit');

    // Find the project and ensure it belongs to the current user
    const project = await Project.findOne({ _id: projectId, userId });

    if (!project) {
      return res.status(404).send('Project not found or access denied.');
    }

    // Get all window items for this project
    const windowItems = await WindowItem.find({ projectId }).sort({ createdAt: -1 });

    // Calculate total project value
    const projectTotal = windowItems.reduce((total, item) => total + item.totalPrice, 0);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Project_${project.projectName.replace(/[^a-z0-9]/gi, '_')}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text(project.projectName, { align: 'center' });
    doc.moveDown();
    
    if (project.clientName) {
      doc.fontSize(14).text(`Client: ${project.clientName}`, { align: 'center' });
      doc.moveDown();
    }
    
    doc.fontSize(12).text(`Created: ${project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}`);
    doc.text(`Last Updated: ${project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'N/A'}`);
    doc.moveDown();

    // Add window items table
    if (windowItems.length > 0) {
      doc.fontSize(16).text('Window Items', { underline: true });
      doc.moveDown(0.5);

      // Table headers
      const tableTop = doc.y;
      let tableLeft = 50;
      const colWidths = [150, 100, 50, 100, 100];
      
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Item Name', tableLeft, tableTop);
      doc.text('Dimensions', tableLeft + colWidths[0], tableTop);
      doc.text('Qty', tableLeft + colWidths[0] + colWidths[1], tableTop);
      doc.text('Unit Price', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
      doc.text('Total', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
      
      let yPos = tableTop + 20;
      doc.font('Helvetica');
      
      windowItems.forEach(item => {
        if (yPos > 700) { // New page if needed
          doc.addPage();
          yPos = 50;
        }
        
        doc.fontSize(9);
        doc.text(item.itemName || 'N/A', tableLeft, yPos, { width: colWidths[0] });
        doc.text(`${parseFloat(item.width).toFixed(2)} × ${parseFloat(item.height).toFixed(2)} in`, tableLeft + colWidths[0], yPos, { width: colWidths[1] });
        doc.text(item.quantity.toString(), tableLeft + colWidths[0] + colWidths[1], yPos, { width: colWidths[2] });
        doc.text(`$${parseFloat(item.unitPrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2], yPos, { width: colWidths[3] });
        doc.text(`$${parseFloat(item.totalPrice).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos, { width: colWidths[4] });
        
        yPos += 20;
      });

      // Total row
      yPos += 10;
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('TOTAL:', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 50, yPos);
      doc.text(`$${parseFloat(projectTotal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPos);
    } else {
      doc.fontSize(12).text('No window items added to this project yet.', { align: 'center' });
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send('Failed to generate PDF.');
  }
});

module.exports = router;