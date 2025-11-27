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
    const CostSettings = require('../../models/CostSettings');
    const [profiles, costSettings] = await Promise.all([
      Profile.find().sort({ name: 1 }),
      CostSettings.findOne()
    ]);
    
    res.render('admin/listProfiles', { 
      profiles,
      exchangeRate: costSettings?.exchangeRate || 4000
    });
  } catch (error) {
    console.error('Error listing profiles:', error);
    res.status(500).send('An error occurred while listing profiles');
  }
});

// Route to show the form for adding a new profile
router.get('/add', isAdmin, (req, res) => {
  res.render('admin/addProfile');
});

router.post('/add', isAdmin, async (req, res) => {
  try {
    const { name, color, colorCode, pricePerMeter, currency, weight, ammaCertification, isMuntin, muntinType, muntinPattern, muntinSpacing } = req.body;
    
    const newProfile = new Profile({
      name,
      color,
      colorCode,
      pricePerMeter: Number(pricePerMeter),
      currency,
      weight: weight === '' ? undefined : Number(weight),
      ammaCertification,
      isMuntin: Boolean(isMuntin),
      muntinType: isMuntin ? muntinType : 'none',
      muntinPattern: isMuntin ? muntinPattern : null,
      muntinSpacing: isMuntin && muntinSpacing && muntinSpacing !== '' && !isNaN(Number(muntinSpacing)) ? Number(muntinSpacing) : null
    });
    
    await newProfile.save();
    res.redirect('/admin/profiles');
  } catch (error) {
    console.error('Error adding profile:', error);
    res.status(500).send('An error occurred while adding the profile');
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
    const { id } = req.params;
    const { name, color, colorCode, pricePerMeter, currency, weight, ammaCertification, isMuntin, muntinType, muntinPattern, muntinSpacing } = req.body;
    
    await Profile.findByIdAndUpdate(id, {
      name,
      color,
      colorCode,
      pricePerMeter: Number(pricePerMeter),
      currency,
      weight: weight === '' ? undefined : Number(weight),
      ammaCertification,
      isMuntin: Boolean(isMuntin),
      muntinType: isMuntin ? muntinType : 'none',
      muntinPattern: isMuntin ? muntinPattern : null,
      muntinSpacing: isMuntin && muntinSpacing && muntinSpacing !== '' && !isNaN(Number(muntinSpacing)) ? Number(muntinSpacing) : null
    });
    
    res.redirect('/admin/profiles');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('An error occurred while updating the profile');
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
    const profiles = await Profile.find().sort({ name: 1 });
    
    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Profiles');
    
    // Add column headers
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Color', key: 'color', width: 20 },
      { header: 'Reference', key: 'colorCode', width: 15 },
      { header: 'AMMA Certification', key: 'ammaCertification', width: 20 },
      { header: 'Price Per Meter (COP)', key: 'pricePerMeter', width: 25 },
      { header: 'Weight (kg/m)', key: 'weight', width: 15 }
    ];
    
    // Format the header row
    worksheet.getRow(1).font = { bold: true };
    
    // Add profile data to the worksheet
    profiles.forEach(profile => {
      worksheet.addRow({
        name: profile.name,
        color: profile.color,
        colorCode: profile.colorCode,
        ammaCertification: profile.ammaCertification,
        pricePerMeter: profile.pricePerMeter,
        weight: profile.weight
      });
    });
    
    // Format the price column
    worksheet.getColumn('pricePerMeter').numFmt = '#,##0';
    
    // Format the weight column
    worksheet.getColumn('weight').numFmt = '#,##0.00';
    
    // Set content type and disposition
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Profiles.xlsx');
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting profiles:', error);
    res.status(500).send('An error occurred while exporting profiles');
  }
});

// Route to import profiles from Excel
router.post('/import-profiles', isAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Read the Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    
    // Get the first worksheet
    const worksheet = workbook.getWorksheet('Profiles');
    if (!worksheet) {
      return res.status(400).json({ message: 'Worksheet "Profiles" not found in the Excel file' });
    }
    
    let importCount = 0;
    let errorCount = 0;
    
    // Process each row (skip the header row)
    worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      
      try {
        const profileData = {
          name: row.getCell(1).value,
          color: row.getCell(2).value,
          colorCode: row.getCell(3).value,
          ammaCertification: row.getCell(4).value,
          pricePerMeter: Number(row.getCell(5).value),
          weight: Number(row.getCell(6).value)
        };
        
        // Validate AMMA certification
        if (!['2603', '2604', '2605'].includes(profileData.ammaCertification)) {
          console.warn(`Invalid AMMA certification: ${profileData.ammaCertification} in row ${rowNumber}, setting default 2603`);
          profileData.ammaCertification = '2603';
        }
        
        // Check if profile already exists (by name)
        const existingProfile = await Profile.findOne({ name: profileData.name });
        
        if (existingProfile) {
          // Update existing profile
          await Profile.updateOne({ _id: existingProfile._id }, profileData);
        } else {
          // Create new profile
          const newProfile = new Profile(profileData);
          await newProfile.save();
        }
        
        importCount++;
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        errorCount++;
      }
    });
    
    // Delete the temporary file
    fs.unlinkSync(req.file.path);
    
    res.json({
      message: `Import complete: ${importCount} profiles imported successfully, ${errorCount} errors.`
    });
  } catch (error) {
    console.error('Error importing profiles:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error removing temp file:', unlinkError);
      }
    }
    
    res.status(500).json({ message: 'An error occurred while importing profiles' });
  }
});

module.exports = router;
