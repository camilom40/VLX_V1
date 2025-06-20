const express = require('express');
const router = express.Router();
const ComponentGroup = require('../../models/ComponentGroup');
const { isAdmin } = require('../middleware/adminMiddleware');

// List all component groups
router.get('/component-groups', isAdmin, async (req, res) => {
  try {
    const componentGroups = await ComponentGroup.find({}).sort({ sortOrder: 1, displayName: 1 });
    res.render('admin/listComponentGroups', { componentGroups });
  } catch (error) {
    console.error('Error fetching component groups:', error);
    res.status(500).send('Error loading component groups');
  }
});

// Show form to add new component group
router.get('/component-groups/add', isAdmin, (req, res) => {
  res.render('admin/addComponentGroup');
});

// Create new component group
router.post('/component-groups/add', isAdmin, async (req, res) => {
  try {
    const { name, displayName, description, sortOrder } = req.body;
    
    // Create the component group
    const componentGroup = new ComponentGroup({
      name: name.toLowerCase().trim(),
      displayName: displayName.trim(),
      description: description || '',
      sortOrder: parseInt(sortOrder) || 0,
      isActive: true
    });
    
    await componentGroup.save();
    
    console.log('Component group created:', componentGroup.displayName);
    res.redirect('/admin/component-groups');
  } catch (error) {
    console.error('Error creating component group:', error);
    if (error.code === 11000) {
      res.status(400).send('Component group name already exists');
    } else {
      res.status(500).send('Error creating component group');
    }
  }
});

// Show form to edit component group
router.get('/component-groups/edit/:id', isAdmin, async (req, res) => {
  try {
    const componentGroup = await ComponentGroup.findById(req.params.id);
    if (!componentGroup) {
      return res.status(404).send('Component group not found');
    }
    res.render('admin/editComponentGroup', { componentGroup });
  } catch (error) {
    console.error('Error fetching component group:', error);
    res.status(500).send('Error loading component group');
  }
});

// Update component group
router.post('/component-groups/edit/:id', isAdmin, async (req, res) => {
  try {
    const { name, displayName, description, sortOrder, isActive } = req.body;
    
    const componentGroup = await ComponentGroup.findByIdAndUpdate(
      req.params.id,
      {
        name: name.toLowerCase().trim(),
        displayName: displayName.trim(),
        description: description || '',
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive === 'on'
      },
      { new: true }
    );
    
    if (!componentGroup) {
      return res.status(404).send('Component group not found');
    }
    
    console.log('Component group updated:', componentGroup.displayName);
    res.redirect('/admin/component-groups');
  } catch (error) {
    console.error('Error updating component group:', error);
    if (error.code === 11000) {
      res.status(400).send('Component group name already exists');
    } else {
      res.status(500).send('Error updating component group');
    }
  }
});

// Delete component group
router.delete('/component-groups/delete/:id', isAdmin, async (req, res) => {
  try {
    const componentGroup = await ComponentGroup.findByIdAndDelete(req.params.id);
    
    if (!componentGroup) {
      return res.status(404).json({ error: 'Component group not found' });
    }
    
    console.log('Component group deleted:', componentGroup.displayName);
    res.json({ message: 'Component group deleted successfully' });
  } catch (error) {
    console.error('Error deleting component group:', error);
    res.status(500).json({ error: 'Error deleting component group' });
  }
});

// Toggle active status
router.post('/component-groups/toggle/:id', isAdmin, async (req, res) => {
  try {
    const componentGroup = await ComponentGroup.findById(req.params.id);
    
    if (!componentGroup) {
      return res.status(404).send('Component group not found');
    }
    
    componentGroup.isActive = !componentGroup.isActive;
    await componentGroup.save();
    
    console.log('Component group status toggled:', componentGroup.displayName, componentGroup.isActive);
    res.redirect('/admin/component-groups');
  } catch (error) {
    console.error('Error toggling component group status:', error);
    res.status(500).send('Error updating component group status');
  }
});

module.exports = router; 