const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const Accessory = require('../../models/Accessory');
const { isAdmin } = require('../middleware/adminMiddleware');

// Middleware to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware specifically for accessory image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/accessories/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'accessory-' + uniqueSuffix + '.' + file.originalname.split('.').pop())
  }
});

const accessoryImageUpload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Log utility
const logger = require('../../utils/logger');

// Route to list all accessories
router.get('/', isAdmin, async (req, res) => {
  try {
    const CostSettings = require('../../models/CostSettings');
    const [accessories, costSettings] = await Promise.all([
      Accessory.find({}),
      CostSettings.findOne()
    ]);
    
    res.render('admin/listAccessories', { 
      accessories,
      exchangeRate: costSettings?.exchangeRate || 4000
    });
  } catch (error) {
    logger.error('Failed to fetch accessories:', error);
    res.status(500).send('Failed to fetch accessories');
  }
});

// Route to show the form for adding a new accessory
router.get('/add', isAdmin, (req, res) => {
  res.render('admin/addAccessory');
});

router.post('/add', isAdmin, accessoryImageUpload.single('image'), async (req, res) => {
  console.log('🔥 ACCESSORY CREATION ROUTE HIT! 🔥');
  console.log('Headers:', req.headers['content-type']);
  console.log('Has file:', !!req.file);
  console.log('Body keys:', Object.keys(req.body));
  
  try {
    // Debug: Log entire request body
    console.log('=== DEBUGGING ACCESSORY CREATION ===');
    console.log('req.body:', JSON.stringify(req.body, null, 2));
    console.log('req.file:', req.file ? req.file.filename : 'No file uploaded');
    console.log('======================================');
    
    const { name, price, currency, weight, unit, referenceNumber, providerName, customUnit } = req.body;
    const imageFilename = req.file ? req.file.filename : '';
    
    // Validate required fields before proceeding
    if (!name || !price || !unit || !referenceNumber || !currency) {
      const missingFields = [];
      if (!name) missingFields.push('name');
      if (!price) missingFields.push('price');
      if (!currency) missingFields.push('currency');
      if (!unit) missingFields.push('unit');
      if (!referenceNumber) missingFields.push('referenceNumber');
      
      console.log('Missing required fields:', missingFields);
      return res.status(400).send(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Handle custom unit
    const finalUnit = unit === 'custom' ? customUnit : unit;
    
    // Enhanced debug logging
    console.log('=== ENHANCED DEBUGGING ===');
    console.log('req.file object:', req.file);
    console.log('req.body:', req.body);
    console.log('imageFilename:', imageFilename);
    console.log('multer storage destination:', accessoryImageUpload._storage);
    console.log('==========================');
    
    logger.info('Form data received:', {
      name,
      price,
      weight,
      unit,
      customUnit,
      finalUnit,
      referenceNumber,
      providerName,
      hasImage: !!req.file,
      imageDetails: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        destination: req.file.destination,
        path: req.file.path
      } : 'No file uploaded'
    });
    
    const newAccessory = new Accessory({ 
      name, 
      price, 
      currency,
      weight, 
      unit: finalUnit, 
      referenceNumber, 
      providerName,
      image: imageFilename
    });
    await newAccessory.save();
    logger.info(`New accessory created: ${name} with image: ${imageFilename}`);
    res.redirect('/admin/accessories');
  } catch (error) {
    if (error.name === 'ValidationError') {
      logger.error('Validation error:', error.message);
      return res.status(400).send(error.message);
    }
    logger.error('Error creating accessory:', error);
    res.status(500).send('Error creating accessory');
  }
});

// Route to show the form for editing an accessory
router.get('/edit/:id', isAdmin, async (req, res) => {
  try {
    const accessory = await Accessory.findById(req.params.id);
    if (!accessory) {
      logger.warn(`Accessory with ID: ${req.params.id} not found.`);
      return res.status(404).send('Accessory not found');
    }
    res.render('admin/editAccessory', { accessory });
  } catch (error) {
    logger.error('Failed to fetch accessory for editing:', error);
    res.status(500).send('Failed to fetch accessory for editing');
  }
});

// Route to update an accessory
router.post('/update/:id', isAdmin, accessoryImageUpload.single('image'), async (req, res) => {
  try {
    const { name, price, currency, weight, unit, referenceNumber, providerName, removeImage } = req.body;
    
    // Debug logging
    console.log('=== UPDATING ACCESSORY ===');
    console.log('req.body:', JSON.stringify(req.body, null, 2));
    console.log('req.file:', req.file ? req.file.filename : 'No new file uploaded');
    console.log('removeImage flag:', removeImage);
    console.log('==========================');
    
    const updateFields = { 
      name, 
      price, 
      currency,
      weight, 
      unit, 
      referenceNumber, 
      providerName 
    };
    
    // Handle image updates
    if (removeImage === 'true') {
      // User wants to remove the image
      updateFields.image = '';
      logger.info(`Image will be removed for accessory ID: ${req.params.id}`);
    } else if (req.file) {
      // User uploaded a new image
      updateFields.image = req.file.filename;
      logger.info(`New image uploaded for accessory ID: ${req.params.id}: ${req.file.filename}`);
    }
    // If neither removeImage nor new file, keep existing image unchanged
    
    await Accessory.findByIdAndUpdate(req.params.id, updateFields);
    logger.info(`Accessory with ID: ${req.params.id} updated successfully.`);
    res.redirect('/admin/accessories');
  } catch (error) {
    logger.error('Failed to update accessory:', error);
    res.status(500).send('Failed to update accessory');
  }
});

// Route to handle accessory deletion
router.post('/delete/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAccessory = await Accessory.findByIdAndDelete(id);
    if (!deletedAccessory) {
      return res.status(404).send('Accessory not found');
    }
    logger.info(`Accessory ${id} deleted successfully.`);
    res.redirect('/admin/accessories');
  } catch (error) {
    logger.error('Failed to delete accessory:', error);
    res.status(500).send('Failed to delete accessory');
  }
});

// Route to export accessories to Excel
router.get('/export-accessories', isAdmin, async (req, res) => {
  try {
    const accessories = await Accessory.find({});
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Accessories');

    // Define all columns to match our displayed data
    worksheet.columns = [
      { header: 'Reference Number', key: 'referenceNumber', width: 20 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Provider', key: 'providerName', width: 25 },
      { header: 'Unit', key: 'unit', width: 15 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Weight', key: 'weight', width: 15 }
    ];

    // Add styling to the header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // Indigo color
    };

    // Format the data
    accessories.forEach(accessory => {
      const row = worksheet.addRow({
        referenceNumber: accessory.referenceNumber || 'N/A',
        name: accessory.name,
        providerName: accessory.providerName || 'Not specified',
        unit: accessory.unit,
        price: accessory.price,
        weight: accessory.weight || 0
      });
      
      // Format price as currency
      if (row.getCell('price').value) {
        row.getCell('price').numFmt = '"$"#,##0';
      }
      
      // Format weight with 2 decimal places
      if (row.getCell('weight').value) {
        row.getCell('weight').numFmt = '#,##0.00 "kg"';
      }
    });

    // Auto-filter for all columns
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 6 }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=accessories.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).send('Failed to export data');
  }
});

// Route to import accessories from Excel
router.post('/import-accessories', isAdmin, upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  try {
    logger.info('Starting import process...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Accessories');
    const accessories = [];

    logger.info('Reading rows...');
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      
      // Extract all values using column keys
      const [_, referenceNumber, name, providerName, unit, price, weight] = row.values;
      
      // Create accessory object with all fields
      accessories.push({ 
        referenceNumber: referenceNumber || generateReferenceNumber(name),
        name, 
        providerName: providerName || '',
        unit, 
        price: parseFloat(price) || 0,
        weight: weight ? parseFloat(weight) : null
      });
    });

    logger.info('Validating data...');
    // Validate required fields
    const invalidAccessories = accessories.filter(acc => 
      !acc.name || !acc.unit || acc.price === undefined
    );
    
    if (invalidAccessories.length > 0) {
      throw new Error(`${invalidAccessories.length} accessories are missing required fields (name, unit, or price)`);
    }

    logger.info('Clearing existing data...');
    await Accessory.deleteMany({});

    logger.info('Inserting new data...');
    await Accessory.insertMany(accessories);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete the uploaded file after processing
    }

    logger.info('Import process completed successfully.');
    res.json({ message: 'File uploaded successfully!' });
  } catch (error) {
    logger.error('Error importing data:', error);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete the uploaded file in case of error
    }
    res.status(500).json({ message: `File upload failed: ${error.message}` });
  }
});

// Helper function to generate reference numbers
function generateReferenceNumber(name) {
  if (!name) return `REF-ACC-${Date.now().toString().substring(6)}`;
  return `REF-${name.substring(0, 4).toUpperCase()}-${Date.now().toString().substring(6)}`;
}

module.exports = router;
