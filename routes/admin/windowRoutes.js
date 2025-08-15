const express = require('express');
const router = express.Router();
const multer = require('multer');
const Profile = require('../../models/Profile');
const Accessory = require('../../models/Accessory');
const WindowSystem = require('../../models/Window');
const { isAdmin } = require('../middleware/adminMiddleware');
const ExcelJS = require('exceljs');
const upload = multer({ storage: multer.memoryStorage() });
const fs = require('fs');
const User = require('../../models/User'); // Adjust the path based on your project structure
const Project = require('../../models/Project'); // Added for project aggregation


// Route to render the compose window form
router.get('/compose-window', isAdmin, async (req, res) => {
  try {
    const profiles = await Profile.find({});
    const accessories = await Accessory.find({});
    const ComponentGroup = require('../../models/ComponentGroup');
    const componentGroups = await ComponentGroup.find({ isActive: true }).sort({ sortOrder: 1, displayName: 1 });
    res.render('admin/composeWindow', { profiles, accessories, componentGroups });
  } catch (error) {
    console.error('Failed to fetch profiles and accessories:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Route to render the add user form
router.get('/users/add', async (req, res) => {
  res.render('admin/addUser'); // Create `addUser.ejs` later
});

// Route to handle adding a new user
router.post('/users/add', async (req, res) => {
  try {
    const { username, password, role, pricingTier } = req.body;

    // Create a new user
    const newUser = new User({ username, password, role, pricingTier });
    await newUser.save();

    console.log('New user added:', username);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error adding user:', error.message);
    res.status(500).send('Error adding user');
  }
});


// Route to handle removing a user
router.post('/users/remove', async (req, res) => {
  try {
    const { userId } = req.body;

    // Delete the user by ID
    await User.findByIdAndDelete(userId);

    console.log('User removed:', userId);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error removing user:', error.message);
    res.status(500).send('Error removing user');
  }
});

// Route to handle updating a user's role
router.post('/users/update-role', async (req, res) => {
  try {
    const { userId, newRole } = req.body;

    // Update the user's role
    await User.findByIdAndUpdate(userId, { role: newRole });

    console.log('User role updated:', userId, newRole);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating user role:', error.message);
    res.status(500).send('Error updating user role');
  }
});

// Route to handle updating a user's pricing tier
router.post('/users/update-pricing', async (req, res) => {
  try {
    const { userId, pricingTier } = req.body;

    // Update the user's pricing tier
    await User.findByIdAndUpdate(userId, { pricingTier: pricingTier });

    console.log('User pricing tier updated:', userId, pricingTier);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating pricing tier:', error.message);
    res.status(500).send('Error updating pricing tier');
  }
});

// Route to get a user's password (for admin view only)
router.get('/users/get-password/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow for admins
    if (req.session.user && req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Find the user by ID
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if plainPassword exists
    if (!user.plainPassword) {
      // Get at least the hashed password if plain not available
      return res.json({ password: 'Enter new password to update (original not stored in plaintext)' });
    }
    
    // Return the plain unhashed password
    res.json({ password: user.plainPassword });
  } catch (error) {
    console.error('Error retrieving user password:', error.message);
    res.status(500).json({ error: 'Error retrieving password' });
  }
});

// Route to update a user's password
router.post('/users/update-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    
    // Only allow for admins
    if (req.session.user && req.session.user.role !== 'admin') {
      return res.status(403).send('Unauthorized access');
    }

    // Find the user by ID
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    // Update both the password and plainPassword fields
    user.password = newPassword; // Will be hashed by the pre-save hook
    user.plainPassword = newPassword; // Store the plain text version for admin viewing
    
    await user.save(); // This will trigger the pre-save hook to hash the password
    
    console.log('Password updated for user:', user.username);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating password:', error.message);
    res.status(500).send('Error updating password');
  }
});

// New route to handle batch update of multiple users
router.post('/users/update-all', async (req, res) => {
  try {
    const { userId, newRole, pricingTier } = req.body;
    
    // Check if we have arrays of user IDs and data
    if (Array.isArray(userId)) {
      // Process each user update in parallel
      const updatePromises = userId.map(async (id, index) => {
        const updateData = {
          role: newRole[index],
          pricingTier: pricingTier[index]
        };
        
        // Update the user with the corresponding data
        return User.findByIdAndUpdate(id, updateData);
      });
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      console.log(`Batch updated ${userId.length} users`);
    }
    
    // Redirect back to the users page
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error batch updating users:', error.message);
    res.status(500).send('Error updating users');
  }
});

// Route to view registered users
router.get('/users', async (req, res) => {
  try {
    // Fetch users first
    const users = await User.find({}, 'username role lastLogin pricingTier');
    
    // Get project counts for all users in a single efficient query
    const projectCounts = await Project.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);
    
    // Convert to a lookup object for easier access
    const projectCountMap = {};
    projectCounts.forEach(item => {
      projectCountMap[item._id.toString()] = item.count;
    });
    
    // Add project count to each user object
    const usersWithProjects = users.map(user => {
      const userObj = user.toObject();
      userObj.projectCount = projectCountMap[user._id.toString()] || 0;
      return userObj;
    });
    
    res.render('admin/users', { users: usersWithProjects });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).send('Error loading users');
  }
});

// Route to handle the composition of a new window
router.post('/compose-window/compose', isAdmin, upload.single('windowImage'), async (req, res) => {
  try {
    console.log('Compose window request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? 'File uploaded' : 'No file');
    
    // Parse JSON arrays with error handling
    let profiles, accessories, glassRestrictions;
    
    try {
      profiles = JSON.parse(req.body.profiles || '[]');
    } catch (e) {
      console.error('Error parsing profiles:', e);
      profiles = [];
    }
    
    try {
      accessories = JSON.parse(req.body.accessories || '[]');
    } catch (e) {
      console.error('Error parsing accessories:', e);
      accessories = [];
    }
    
    try {
      glassRestrictions = JSON.parse(req.body.glassRestrictions || '[]');
    } catch (e) {
      console.error('Error parsing glassRestrictions:', e);
      glassRestrictions = [];
    }
    
    let muntinConfiguration;
    try {
      muntinConfiguration = JSON.parse(req.body.muntinConfiguration || '{}');
    } catch (e) {
      console.error('Error parsing muntinConfiguration:', e);
      muntinConfiguration = { enabled: false };
    }

    const { type } = req.body;
    
    // Validate required fields
    if (!type || type.trim() === '') {
      console.error('Window type is required');
      return res.status(400).json({ error: 'Window type is required' });
    }
    
    if (profiles.length === 0) {
      console.error('At least one profile is required');
      return res.status(400).json({ error: 'At least one profile is required' });
    }
    
    if (glassRestrictions.length === 0) {
      console.error('At least one glass restriction is required');
      return res.status(400).json({ error: 'At least one glass restriction is required' });
    }
    
    let imagePath = null;

    // Handle image upload (optional)
    if (req.file) {
      try {
        const sharp = require('sharp');
        const path = require('path');
        
        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../../public/uploads/window-systems');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const originalName = req.file.originalname;
        const extension = path.extname(originalName);
        const filename = `window-system-${timestamp}${extension}`;
        const filepath = path.join(uploadDir, filename);
        
        // Process and save image
        await sharp(req.file.buffer)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(filepath);
        
        imagePath = `/uploads/window-systems/${filename}`;
        console.log('Image processed and saved:', imagePath);
      } catch (imageError) {
        console.error('Error processing image:', imageError);
        // Continue without image if processing fails
        imagePath = null;
      }
    } else {
      console.log('No image uploaded - continuing without image');
    }

    const profileEntries = profiles.map(profile => ({
      profile: profile.profileId,
      quantity: parseInt(profile.quantity, 10),
      orientation: profile.orientation,
      lengthDiscount: parseFloat(profile.lengthDiscount),
      showToUser: Boolean(profile.showToUser),
    }));

    const accessoryEntries = accessories.map(accessory => ({
      accessory: accessory.accessoryId,
      quantity: parseInt(accessory.quantity, 10),
      unit: accessory.unit,
      showToUser: Boolean(accessory.showToUser),
      componentGroup: accessory.componentGroup || null,
      selectionType: accessory.selectionType || 'quantity',
      isDefault: Boolean(accessory.isDefault),
    }));

    const glassRestrictionEntries = glassRestrictions.map(glass => ({
      type: glass.type,
      width: parseFloat(glass.width),
      height: parseFloat(glass.height),
      positivePressure: parseFloat(glass.positivePressure),
      negativePressure: parseFloat(glass.negativePressure),
    }));

    console.log('Creating window system with data:', {
      type,
      imagePath,
      profileCount: profileEntries.length,
      accessoryCount: accessoryEntries.length,
      glassRestrictionCount: glassRestrictionEntries.length
    });

    const newWindow = new WindowSystem({
      type,
      image: imagePath,
      profiles: profileEntries,
      accessories: accessoryEntries,
      glassRestrictions: glassRestrictionEntries,
      muntinConfiguration: {
        enabled: Boolean(muntinConfiguration.enabled),
        muntinProfile: muntinConfiguration.muntinProfile || null,
        muntinType: muntinConfiguration.muntinType || 'colonial',
        showToUser: Boolean(muntinConfiguration.showToUser),
      },
    });

    await newWindow.save();
    console.log('Window system saved successfully');
    res.redirect('/admin/list-window-systems');
  } catch (error) {
    console.error('Failed to compose window:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Route to list all window systems
router.get('/list-window-systems', async (req, res) => {
  try {
    const windowSystems = await WindowSystem.find({})
      .populate('profiles.profile')
      .populate('accessories.accessory');
    res.render('admin/listWindowSystems', { windowSystems });
  } catch (error) {
    console.error('Error fetching window systems:', error);
    res.status(500).send('There was an error serving your request.');
  }
});

// Route to render the edit form
router.get('/edit/:id', isAdmin, async (req, res) => {
  try {
    const windowSystem = await WindowSystem.findById(req.params.id).populate('profiles.profile accessories.accessory');
    const profiles = await Profile.find({});
    const accessories = await Accessory.find({});
    const ComponentGroup = require('../../models/ComponentGroup');
    const componentGroups = await ComponentGroup.find({ isActive: true }).sort({ sortOrder: 1, displayName: 1 });
    res.render('admin/editWindowSystem', { windowSystem, profiles, accessories, componentGroups });
  } catch (error) {
    console.error('Failed to fetch window system:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Route to handle the update of a window system
router.post('/edit/:id', isAdmin, upload.single('windowImage'), async (req, res) => {
  try {
    const { type, profiles = [], accessories = [], glassRestrictions = [] } = req.body;
    let imagePath = null;

    // Handle image upload
    if (req.file) {
      try {
        const sharp = require('sharp');
        const path = require('path');
        
        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../../public/uploads/window-systems');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const originalName = req.file.originalname;
        const extension = path.extname(originalName);
        const filename = `window-system-${timestamp}${extension}`;
        const filepath = path.join(uploadDir, filename);
        
        // Process and save image
        await sharp(req.file.buffer)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(filepath);
        
        imagePath = `/uploads/window-systems/${filename}`;
        console.log('Image processed and saved:', imagePath);
      } catch (imageError) {
        console.error('Error processing image:', imageError);
        // Continue without image if processing fails
        imagePath = null;
      }
    }

    const profileEntries = JSON.parse(profiles).map(profile => ({
      profile: profile.profileId,
      quantity: parseInt(profile.quantity, 10),
      orientation: profile.orientation,
      lengthDiscount: parseFloat(profile.lengthDiscount),
      showToUser: Boolean(profile.showToUser),
    }));

    const accessoryEntries = JSON.parse(accessories).map(accessory => ({
      accessory: accessory.accessoryId,
      quantity: parseInt(accessory.quantity, 10),
      unit: accessory.unit,
      showToUser: Boolean(accessory.showToUser),
      componentGroup: accessory.componentGroup || null,
      selectionType: accessory.selectionType || 'quantity',
      isDefault: Boolean(accessory.isDefault),
    }));

    const glassRestrictionEntries = JSON.parse(glassRestrictions).map(glass => ({
      type: glass.type,
      width: parseFloat(glass.width),
      height: parseFloat(glass.height),
      positivePressure: parseFloat(glass.positivePressure),
      negativePressure: parseFloat(glass.negativePressure),
    }));

    // Parse muntin configuration
    let muntinConfigurationData = {};
    try {
      muntinConfigurationData = JSON.parse(req.body.muntinConfiguration || '{}');
    } catch (e) {
      console.error('Error parsing muntinConfiguration:', e);
      muntinConfigurationData = { enabled: false };
    }

    // Prepare update object
    const updateData = {
      type,
      profiles: profileEntries,
      accessories: accessoryEntries,
      glassRestrictions: glassRestrictionEntries,
      muntinConfiguration: {
        enabled: Boolean(muntinConfigurationData.enabled),
        muntinProfile: muntinConfigurationData.muntinProfile || null,
        muntinType: muntinConfigurationData.muntinType || 'colonial',
        showToUser: Boolean(muntinConfigurationData.showToUser),
      },
    };

    // Only update image if a new one was uploaded
    if (imagePath) {
      updateData.image = imagePath;
    }

    await WindowSystem.findByIdAndUpdate(req.params.id, updateData);

    res.redirect('/admin/list-window-systems');
  } catch (error) {
    console.error('Failed to update window system:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// Route to remove image from window system
router.post('/remove-image/:id', isAdmin, async (req, res) => {
  try {
    const windowSystem = await WindowSystem.findById(req.params.id);
    if (!windowSystem) {
      return res.status(404).json({ error: 'Window system not found' });
    }

    // Remove image field
    windowSystem.image = null;
    await windowSystem.save();

    res.json({ message: 'Image removed successfully!' });
  } catch (error) {
    console.error('Failed to remove image:', error.message);
    res.status(500).json({ error: 'Failed to remove image' });
  }
});

// Route to delete a window system
router.delete('/delete/:id', isAdmin, async (req, res) => {
  try {
    await WindowSystem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Window system deleted successfully!' });
  } catch (error) {
    console.error('Failed to delete window system:', error.message);
    res.status(500).json({ error: 'Failed to delete window system' });
  }
});

// Route to export data to Excel
router.get('/export-window-systems', isAdmin, async (req, res) => {
  try {
    const windowSystems = await WindowSystem.find({}).populate('profiles.profile accessories.accessory');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Window Systems');

    worksheet.columns = [
      { header: 'Window Type', key: 'type', width: 20 },
      { header: 'Profile Names', key: 'profileNames', width: 20 },
      { header: 'Profile Quantities', key: 'profileQuantities', width: 20 },
      { header: 'Profile Orientations', key: 'profileOrientations', width: 20 },
      { header: 'Profile Length Discounts', key: 'profileLengthDiscounts', width: 20 },
      { header: 'Accessory Names', key: 'accessoryNames', width: 20 },
      { header: 'Accessory Quantities', key: 'accessoryQuantities', width: 20 },
      { header: 'Accessory Units', key: 'accessoryUnits', width: 20 },
      { header: 'Glass Types', key: 'glassTypes', width: 20 },
      { header: 'Glass Sizes', key: 'glassSizes', width: 20 },
      { header: 'Positive Pressures', key: 'positivePressures', width: 20 },
      { header: 'Negative Pressures', key: 'negativePressures', width: 20 },
    ];

    windowSystems.forEach(ws => {
      const profileNames = ws.profiles.map(p => (p.profile ? p.profile.name : 'Unknown')).join(', ');
      const profileQuantities = ws.profiles.map(p => p.quantity).join(', ');
      const profileOrientations = ws.profiles.map(p => p.orientation).join(', ');
      const profileLengthDiscounts = ws.profiles.map(p => p.lengthDiscount).join(', ');

      const accessoryNames = ws.accessories.map(a => (a.accessory ? a.accessory.name : 'Unknown')).join(', ');
      const accessoryQuantities = ws.accessories.map(a => a.quantity).join(', ');
      const accessoryUnits = ws.accessories.map(a => a.unit).join(', ');

      const glassTypes = ws.glassRestrictions.map(g => g.type).join(', ');
      const glassSizes = ws.glassRestrictions.map(g => `${g.width}x${g.height}`).join(', ');
      const positivePressures = ws.glassRestrictions.map(g => g.positivePressure).join(', ');
      const negativePressures = ws.glassRestrictions.map(g => g.negativePressure).join(', ');

      worksheet.addRow({
        type: ws.type,
        profileNames,
        profileQuantities,
        profileOrientations,
        profileLengthDiscounts,
        accessoryNames,
        accessoryQuantities,
        accessoryUnits,
        glassTypes,
        glassSizes,
        positivePressures,
        negativePressures,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=window-systems.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).send('Failed to export data');
  }
});

// Route to import data from Excel
router.post('/import-window-systems', isAdmin, upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Window Systems');
    const windowSystems = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      const [
        type,
        profileNames,
        profileQuantities,
        profileOrientations,
        profileLengthDiscounts,
        accessoryNames,
        accessoryQuantities,
        accessoryUnits,
        glassTypes,
        glassSizes,
        positivePressures,
        negativePressures,
      ] = row.values.slice(1);

      const profiles = profileNames.split(', ').map((name, i) => ({
        profile: name,
        quantity: parseInt(profileQuantities.split(', ')[i], 10),
        orientation: profileOrientations.split(', ')[i],
        lengthDiscount: parseFloat(profileLengthDiscounts.split(', ')[i]),
      }));

      const accessories = accessoryNames.split(', ').map((name, i) => ({
        accessory: name,
        quantity: parseInt(accessoryQuantities.split(', ')[i], 10),
        unit: accessoryUnits.split(', ')[i],
      }));

      const glassRestrictions = glassTypes.split(', ').map((type, i) => ({
        type,
        width: parseFloat(glassSizes.split(', ')[i].split('x')[0]),
        height: parseFloat(glassSizes.split(', ')[i].split('x')[1]),
        positivePressure: parseFloat(positivePressures.split(', ')[i]),
        negativePressure: parseFloat(negativePressures.split(', ')[i]),
      }));

      windowSystems.push({ type, profiles, accessories, glassRestrictions });
    });

    await WindowSystem.deleteMany({});

    for (const ws of windowSystems) {
      const profiles = await Promise.all(
        ws.profiles.map(async p => {
          const profile = await Profile.findOne({ name: p.profile });
          if (!profile) {
            console.error(`Profile not found: ${p.profile}`);
            throw new Error(`Profile not found: ${p.profile}`);
          }
          return {
            profile: profile._id,
            quantity: p.quantity,
            orientation: p.orientation,
            lengthDiscount: p.lengthDiscount,
          };
        })
      );

      const accessories = await Promise.all(
        ws.accessories.map(async a => {
          const accessory = await Accessory.findOne({ name: a.accessory });
          if (!accessory) {
            console.error(`Accessory not found: ${a.accessory}`);
            throw new Error(`Accessory not found: ${a.accessory}`);
          }
          return {
            accessory: accessory._id,
            quantity: a.quantity,
            unit: a.unit,
          };
        })
      );

      const glassRestrictions = ws.glassRestrictions.map(g => ({
        type: g.type,
        width: g.width,
        height: g.height,
        positivePressure: g.positivePressure,
        negativePressure: g.negativePressure,
      }));

      await WindowSystem.create({ type: ws.type, profiles, accessories, glassRestrictions });
    }

    fs.unlinkSync(filePath); // Delete the uploaded file after processing
    res.json({ message: 'File uploaded successfully!' });
  } catch (error) {
    console.error('Error importing data:', error);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete the uploaded file in case of error
    }
    res.status(500).json({ message: `File upload failed: ${error.message}` });
  }
});

module.exports = router;
