const express = require('express');
const router = express.Router();
const multer = require('multer');
const Profile = require('../../models/Profile');
const Accessory = require('../../models/Accessory');
const WindowSystem = require('../../models/Window');
const { isAdmin } = require('../middleware/adminMiddleware');
const ExcelJS = require('exceljs');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const User = require('../../models/User'); // Adjust the path based on your project structure


// Route to render the compose window form
router.get('/compose-window', isAdmin, async (req, res) => {
  try {
    const profiles = await Profile.find({});
    const accessories = await Accessory.find({});
    res.render('admin/composeWindow', { profiles, accessories });
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
    const { username, password, role } = req.body;

    // Create a new user
    const newUser = new User({ username, password, role });
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

    // Find the user and update their role
    const user = await User.findById(userId);
    if (user) {
      user.role = newRole;
      await user.save();
      console.log('User role updated:', user.username, 'New Role:', newRole);
    }

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating user role:', error.message);
    res.status(500).send('Error updating user role');
  }
});


// Route to view registered users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username role lastLogin'); // Fetch specific fields
    res.render('admin/users', { users });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).send('Error loading users');
  }
});

// Route to handle the composition of a new window
router.post('/compose-window/compose', isAdmin, async (req, res) => {
  try {
    const profiles = JSON.parse(req.body.profiles || '[]');
    const accessories = JSON.parse(req.body.accessories || '[]');
    const glassRestrictions = JSON.parse(req.body.glassRestrictions || '[]');

    const { type } = req.body;

    const profileEntries = profiles.map(profile => ({
      profile: profile.profileId,
      quantity: parseInt(profile.quantity, 10),
      orientation: profile.orientation,
      lengthDiscount: parseFloat(profile.lengthDiscount),
    }));

    const accessoryEntries = accessories.map(accessory => ({
      accessory: accessory.accessoryId,
      quantity: parseInt(accessory.quantity, 10),
      unit: accessory.unit,
    }));

    const glassRestrictionEntries = glassRestrictions.map(glass => ({
      type: glass.type,
      width: parseFloat(glass.width),
      height: parseFloat(glass.height),
      positivePressure: parseFloat(glass.positivePressure),
      negativePressure: parseFloat(glass.negativePressure),
    }));

    const newWindow = new WindowSystem({
      type,
      profiles: profileEntries,
      accessories: accessoryEntries,
      glassRestrictions: glassRestrictionEntries,
    });

    await newWindow.save();
    res.redirect('/admin/list-window-systems');
  } catch (error) {
    console.error('Failed to compose window:', error.message);
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
    res.render('admin/editWindowSystem', { windowSystem, profiles, accessories });
  } catch (error) {
    console.error('Failed to fetch window system:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Route to handle the update of a window system
router.post('/edit/:id', isAdmin, async (req, res) => {
  try {
    const { type, profiles = [], accessories = [], glassRestrictions = [] } = req.body;

    const profileEntries = JSON.parse(profiles).map(profile => ({
      profile: profile.profileId,
      quantity: parseInt(profile.quantity, 10),
      orientation: profile.orientation,
      lengthDiscount: parseFloat(profile.lengthDiscount),
    }));

    const accessoryEntries = JSON.parse(accessories).map(accessory => ({
      accessory: accessory.accessoryId,
      quantity: parseInt(accessory.quantity, 10),
      unit: accessory.unit,
    }));

    const glassRestrictionEntries = JSON.parse(glassRestrictions).map(glass => ({
      type: glass.type,
      width: parseFloat(glass.width),
      height: parseFloat(glass.height),
      positivePressure: parseFloat(glass.positivePressure),
      negativePressure: parseFloat(glass.negativePressure),
    }));

    await WindowSystem.findByIdAndUpdate(req.params.id, {
      type,
      profiles: profileEntries,
      accessories: accessoryEntries,
      glassRestrictions: glassRestrictionEntries,
    });

    res.redirect('/admin/list-window-systems');
  } catch (error) {
    console.error('Failed to update window system:', error.message);
    res.status(500).json({ error: error.message });
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
