// routes/admin/profiles.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const Profile = require('../../models/Profile');
const { isAdmin } = require('../middleware/adminMiddleware');

// Middleware to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Log utility
const logger = require('../../utils/logger');

// Route to list all profiles
router.get('/', isAdmin, async (req, res) => {
  try {
    const profiles = await Profile.find({});
    res.render('admin/listProfiles', { profiles });
  } catch (error) {
    logger.error('Failed to fetch profiles:', error);
    res.status(500).send('Failed to fetch profiles');
  }
});

// Route to show the form for adding a new profile
router.get('/add', isAdmin, (req, res) => {
  res.render('admin/addProfile');
});

router.post('/add', isAdmin, async (req, res) => {
  try {
    const { name, pricePerMeter, weight, color, colorCode } = req.body;
    const newProfile = new Profile({ name, pricePerMeter, weight, color, colorCode });
    await newProfile.save();
    res.redirect('/admin/profiles');
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).send(error.message);
    }
    console.error('Error creating profile:', error);
    res.status(500).send('Error creating profile');
  }
});

// Route to show the form for editing a profile
router.get('/edit/:id', isAdmin, async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);
    if (!profile) {
      logger.warn(`Profile with ID: ${req.params.id} not found.`);
      return res.status(404).send('Profile not found');
    }
    res.render('admin/editProfile', { profile });
  } catch (error) {
    logger.error('Failed to fetch profile for editing:', error);
    res.status(500).send('Failed to fetch profile for editing');
  }
});

// Route to update a profile
router.post('/update/:id', isAdmin, async (req, res) => {
  try {
    const { name, pricePerMeter, weight, color, colorCode } = req.body;
    await Profile.findByIdAndUpdate(req.params.id, { name, pricePerMeter, weight, color, colorCode });
    logger.info(`Profile with ID: ${req.params.id} updated successfully.`);
    res.redirect('/admin/profiles');
  } catch (error) {
    logger.error('Failed to update profile:', error);
    res.status(500).send('Failed to update profile');
  }
});

// Route to handle profile deletion
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProfile = await Profile.findByIdAndDelete(id);
    if (!deletedProfile) {
      return res.status(404).send('Profile not found');
    }
    logger.info(`Profile ${id} deleted successfully.`);
    res.status(200).json({ message: 'Profile deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete profile:', error);
    res.status(500).json({ message: 'Failed to delete profile' });
  }
});

// Route to export profiles to Excel
router.get('/export-profiles', isAdmin, async (req, res) => {
  try {
    const profiles = await Profile.find({});
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Profiles');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Color', key: 'color', width: 15 },
      { header: 'Color Code', key: 'colorCode', width: 15 },
      { header: 'Price Per Meter', key: 'pricePerMeter', width: 15 },
      { header: 'Weight', key: 'weight', width: 10 },
    ];

    profiles.forEach(profile => {
      worksheet.addRow(profile);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=profiles.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).send('Failed to export data');
  }
});

// Route to import profiles from Excel
router.post('/import-profiles', isAdmin, upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Profiles');
    const profiles = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      const name = row.getCell(1).value;
      const color = row.getCell(2).value;
      const colorCode = row.getCell(3).value;
      const pricePerMeter = parseFloat(row.getCell(4).value);
      const weight = parseFloat(row.getCell(5).value);
      profiles.push({ name, color, colorCode, pricePerMeter, weight });
    });

    await Profile.deleteMany({});
    await Profile.insertMany(profiles);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete the uploaded file after processing
    }

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
