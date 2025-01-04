const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const Glass = require('../../models/Glass');
const { isAdmin } = require('../middleware/adminMiddleware');

// Middleware to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Log utility
const logger = require('../../utils/logger');

// Route to list all glasses
router.get('/', isAdmin, async (req, res) => {
  try {
    const glasses = await Glass.find({});
    res.render('admin/listGlasses', { glasses });
  } catch (error) {
    logger.error('Failed to fetch glasses:', error);
    res.status(500).send('Failed to fetch glasses');
  }
});

// Route to show the form for adding a new glass
router.get('/add', isAdmin, (req, res) => {
  res.render('admin/addGlass');
});

router.post('/add', isAdmin, async (req, res) => {
  try {
    const { glass_type, description, missile_type, pricePerSquareMeter, weight } = req.body;
    const newGlass = new Glass({ glass_type, description, missile_type, pricePerSquareMeter, weight });
    await newGlass.save();
    res.redirect('/admin/glasses');
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).send(error.message);
    }
    console.error('Error creating glass:', error);
    res.status(500).send('Error creating glass');
  }
});

// Route to show the form for editing a glass
router.get('/edit/:id', isAdmin, async (req, res) => {
  try {
    const glass = await Glass.findById(req.params.id);
    if (!glass) {
      logger.warn(`Glass with ID: ${req.params.id} not found.`);
      return res.status(404).send('Glass not found');
    }
    res.render('admin/editGlass', { glass });
  } catch (error) {
    logger.error('Failed to fetch glass for editing:', error);
    res.status(500).send('Failed to fetch glass for editing');
  }
});

// Route to update a glass
router.post('/update/:id', isAdmin, async (req, res) => {
  try {
    const { glass_type, description, missile_type, pricePerSquareMeter, weight } = req.body;
    await Glass.findByIdAndUpdate(req.params.id, { glass_type, description, missile_type, pricePerSquareMeter, weight });
    logger.info(`Glass with ID: ${req.params.id} updated successfully.`);
    res.redirect('/admin/glasses');
  } catch (error) {
    logger.error('Failed to update glass:', error);
    res.status(500).send('Failed to update glass');
  }
});

// Route to handle glass deletion
router.post('/delete/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedGlass = await Glass.findByIdAndDelete(id);
    if (!deletedGlass) {
      return res.status(404).send('Glass not found');
    }
    logger.info(`Glass ${id} deleted successfully.`);
    res.redirect('/admin/glasses');
  } catch (error) {
    logger.error('Failed to delete glass:', error);
    res.status(500).send('Failed to delete glass');
  }
});

// Route to export glasses to Excel
router.get('/export-glasses', isAdmin, async (req, res) => {
  try {
    const glasses = await Glass.find({});
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Glasses');

    worksheet.columns = [
      { header: 'Type', key: 'glass_type', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Missile Type', key: 'missile_type', width: 15 },
      { header: 'Price Per Square Meter', key: 'pricePerSquareMeter', width: 20 },
      { header: 'Weight', key: 'weight', width: 20 }
    ];

    glasses.forEach(glass => {
      worksheet.addRow(glass);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=glasses.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).send('Failed to export data');
  }
});

// Route to import glasses from Excel
router.post('/import-glasses', isAdmin, upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  try {
    console.log('Starting import process...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Glasses');
    const glasses = [];

    console.log('Reading rows...');
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      const [glass_type, description, missile_type, pricePerSquareMeter, weight] = row.values.slice(1);
      if (glass_type && description && missile_type && pricePerSquareMeter && weight) {
        glasses.push({ glass_type, description, missile_type, pricePerSquareMeter, weight });
      } else {
        console.warn('Skipping row due to missing values:', row.values);
      }
    });

    console.log('Read glasses:', glasses);

    console.log('Clearing existing data...');
    await Glass.deleteMany({});

    console.log('Inserting new data...');
    await Glass.insertMany(glasses);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete the uploaded file after processing
    }

    console.log('Import process completed successfully.');
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
