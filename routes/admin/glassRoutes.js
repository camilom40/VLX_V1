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
    const CostSettings = require('../../models/CostSettings');
    const [glasses, costSettings] = await Promise.all([
      Glass.find({}),
      CostSettings.findOne()
    ]);
    
    res.render('admin/listGlasses', { 
      glasses,
      exchangeRate: costSettings?.exchangeRate || 4000
    });
  } catch (error) {
    logger.error('Failed to fetch glasses:', error);
    res.status(500).send('Failed to fetch glasses');
  }
});

// Route to show the form for adding a new glass
router.get('/add', isAdmin, async (req, res) => {
  try {
    const CostSettings = require('../../models/CostSettings');
    const costSettings = await CostSettings.findOne();
    const exchangeRate = costSettings?.exchangeRate || 4000;
    
    res.render('admin/addGlass', { exchangeRate });
  } catch (error) {
    console.error('Error loading add glass page:', error);
    res.render('admin/addGlass', { exchangeRate: 4000 });
  }
});

router.post('/add', isAdmin, async (req, res) => {
  try {
    const { glass_type, description, missile_type, pricePerSquareMeter, currency, weight, isLowE, color } = req.body;
    const newGlass = new Glass({ 
      glass_type, 
      description, 
      missile_type: missile_type || '', 
      pricePerSquareMeter, 
      currency, 
      weight,
      isLowE: isLowE === 'on' || isLowE === true,
      color: color || ''
    });
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
    
    const CostSettings = require('../../models/CostSettings');
    const costSettings = await CostSettings.findOne();
    const exchangeRate = costSettings?.exchangeRate || 4000;
    
    res.render('admin/editGlass', { glass, exchangeRate });
  } catch (error) {
    logger.error('Failed to fetch glass for editing:', error);
    res.status(500).send('Failed to fetch glass for editing');
  }
});

// Route to update a glass
router.post('/update/:id', isAdmin, async (req, res) => {
  try {
    const { glass_type, description, missile_type, pricePerSquareMeter, currency, weight, isLowE, color } = req.body;
    await Glass.findByIdAndUpdate(req.params.id, { 
      glass_type, 
      description, 
      missile_type: missile_type || '', 
      pricePerSquareMeter, 
      currency, 
      weight,
      isLowE: isLowE === 'on' || isLowE === true,
      color: color || ''
    });
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

    // Define all columns for export
    worksheet.columns = [
      { header: 'Type', key: 'glass_type', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Missile Type', key: 'missile_type', width: 15 },
      { header: 'Price Per Square Meter', key: 'pricePerSquareMeter', width: 20 },
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
    glasses.forEach(glass => {
      const row = worksheet.addRow({
        glass_type: glass.glass_type,
        description: glass.description,
        missile_type: glass.missile_type,
        pricePerSquareMeter: glass.pricePerSquareMeter,
        weight: glass.weight
      });
      
      // Format price as currency
      if (row.getCell('pricePerSquareMeter').value) {
        row.getCell('pricePerSquareMeter').numFmt = '"$"#,##0';
      }
      
      // Format weight with 2 decimal places
      if (row.getCell('weight').value) {
        row.getCell('weight').numFmt = '#,##0.00 "kg/m²"';
      }
    });
    
    // Auto-filter for all columns
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 5 }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=glasses.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting data:', error);
    res.status(500).send('Failed to export data');
  }
});

// Route to import glasses from Excel
router.post('/import-glasses', isAdmin, upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  try {
    logger.info('Starting glass import process...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Glasses');
    const glasses = [];

    logger.info('Reading rows from glass import...');
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      
      // Extract values using indexes
      const [_, glass_type, description, missile_type, pricePerSquareMeter, weight] = row.values;
      
      // Validate the data
      if (glass_type && description && pricePerSquareMeter !== undefined) {
        glasses.push({ 
          glass_type, 
          description, 
          missile_type: missile_type || '', 
          pricePerSquareMeter: parseFloat(pricePerSquareMeter) || 0, 
          weight: weight ? parseFloat(weight) : null 
        });
      } else {
        logger.warn('Skipping row due to missing values:', row.values);
      }
    });

    logger.info('Validating glass data...');
    // Validate required fields
    const invalidGlasses = glasses.filter(glass => 
      !glass.glass_type || !glass.description || glass.pricePerSquareMeter === undefined
    );
    
    if (invalidGlasses.length > 0) {
      throw new Error(`${invalidGlasses.length} glasses are missing required fields (type, description, missile type, or price)`);
    }

    logger.info('Clearing existing glass data...');
    await Glass.deleteMany({});

    logger.info('Inserting new glass data...');
    await Glass.insertMany(glasses);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete the uploaded file after processing
    }

    logger.info('Glass import process completed successfully.');
    res.json({ message: 'Glasses uploaded successfully!' });
  } catch (error) {
    logger.error('Error importing glass data:', error);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete the uploaded file in case of error
    }
    res.status(500).json({ message: `File upload failed: ${error.message}` });
  }
});

module.exports = router;
