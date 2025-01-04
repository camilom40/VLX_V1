const WindowSystem = require('../models/WindowSystem');
const AluminumExtrusion = require('../models/AluminumExtrusion');
const Accessory = require('../models/Accessory');

// Get profiles and accessories to create a new window system
exports.getNewWindowSystemPage = async (req, res) => {
  try {
    const profiles = await AluminumExtrusion.find({});
    const accessories = await Accessory.find({});
    res.render('admin/windowSystemManager', { profiles, accessories });
  } catch (error) {
    console.error('Failed to fetch profiles or accessories:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Create a new window system
exports.createNewWindowSystem = async (req, res) => {
  try {
    const { name, profiles, accessories } = req.body;
    const newWindowSystem = new WindowSystem({ name, profiles, accessories });
    await newWindowSystem.save();
    res.redirect('/admin/window-systems-manager');
  } catch (error) {
    console.error('Failed to create window system:', error);
    res.status(500).send('Internal Server Error');
  }
};

