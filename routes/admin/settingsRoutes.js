const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const CostSettings = require('../../models/CostSettings');
const { getExchangeRate } = require('../../utils/currencyConverter');

// Middleware to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Render settings page
router.get('/settings', async (req, res) => {
  try {
    // Get the latest exchange rate from the utility
    const currentExchangeRate = await getExchangeRate();
    
    let costSettings = await CostSettings.findOne();
    if (!costSettings) {
      // Create default settings if none exist
      costSettings = new CostSettings({
        currency: 'COP',
        exchangeRate: currentExchangeRate,
        seaFreight: 0,
        landFreight: 0,
        packaging: 0,
        labor: 0,
        indirectCosts: 0,
        administrativeExpenses: 0
      });
      await costSettings.save();
    } else {
      // Update exchange rate with latest from API
      costSettings.exchangeRate = currentExchangeRate;
      await costSettings.save();
    }
    
    res.render('admin/settings', { 
      costSettings, 
      currentExchangeRate,
      success: req.query.success === 'true'
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).send('Server Error');
  }
});

// Save settings
router.post('/settings', async (req, res) => {
  try {
    const {
      currency,
      seaFreight,
      landFreight,
      packaging,
      labor,
      indirectCosts,
      administrativeExpenses
    } = req.body;

    console.log('Received form data:', req.body); // Debug log

    // Validate required fields - check for empty strings and undefined
    const requiredFields = { currency, seaFreight, landFreight, packaging, labor, indirectCosts, administrativeExpenses };
    const missingFields = [];
    
    for (const [key, value] of Object.entries(requiredFields)) {
      if (value === undefined || value === null || value === '') {
        missingFields.push(key);
      }
    }

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).render('admin/settings', {
        costSettings: req.body,
        currentExchangeRate: await getExchangeRate(),
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Get the latest exchange rate
    const currentExchangeRate = await getExchangeRate();

    // Find existing settings or create new one
    let costSettings = await CostSettings.findOne();
    
    if (costSettings) {
      // Update existing settings
      costSettings.currency = currency;
      costSettings.exchangeRate = currentExchangeRate;
      costSettings.seaFreight = parseFloat(seaFreight) || 0;
      costSettings.landFreight = parseFloat(landFreight) || 0;
      costSettings.packaging = parseFloat(packaging) || 0;
      costSettings.labor = parseFloat(labor) || 0;
      costSettings.indirectCosts = parseFloat(indirectCosts) || 0;
      costSettings.administrativeExpenses = parseFloat(administrativeExpenses) || 0;
      
      await costSettings.save();
    } else {
      // Create new settings
      costSettings = new CostSettings({
        currency,
        exchangeRate: currentExchangeRate,
        seaFreight: parseFloat(seaFreight) || 0,
        landFreight: parseFloat(landFreight) || 0,
        packaging: parseFloat(packaging) || 0,
        labor: parseFloat(labor) || 0,
        indirectCosts: parseFloat(indirectCosts) || 0,
        administrativeExpenses: parseFloat(administrativeExpenses) || 0
      });
      
      await costSettings.save();
    }
    
    console.log('Settings saved successfully:', costSettings); // Debug log
    res.redirect('/admin/settings?success=true');
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).render('admin/settings', {
      costSettings: req.body,
      currentExchangeRate: await getExchangeRate(),
      error: 'Server error while saving settings'
    });
  }
});

// Export settings to Excel
router.get('/export-settings', async (req, res) => {
  try {
    const settings = await CostSettings.findOne();
    if (!settings) {
      return res.status(404).send('Settings not found');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cost Settings');

    worksheet.columns = [
      { header: 'Sea Freight', key: 'seaFreight', width: 20 },
      { header: 'Land Freight', key: 'landFreight', width: 20 },
      { header: 'Packaging', key: 'packaging', width: 20 },
      { header: 'Labor', key: 'labor', width: 20 },
      { header: 'Indirect Costs', key: 'indirectCosts', width: 20 },
      { header: 'Administrative Expenses', key: 'administrativeExpenses', width: 30 },
    ];

    worksheet.addRow(settings.toObject());

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=cost-settings.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting settings:', error);
    res.status(500).send('Failed to export settings');
  }
});

// Import settings from Excel
router.post('/import-settings', upload.single('file'), async (req, res) => {
  const filePath = req.file.path;
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Cost Settings');

    const row = worksheet.getRow(2);
    const newSettings = {
      seaFreight: row.getCell('A').value,
      landFreight: row.getCell('B').value,
      packaging: row.getCell('C').value,
      labor: row.getCell('D').value,
      indirectCosts: row.getCell('E').value,
      administrativeExpenses: row.getCell('F').value,
    };

    let settings = await CostSettings.findOne();
    if (settings) {
      Object.assign(settings, newSettings);
      await settings.save();
    } else {
      settings = new CostSettings(newSettings);
      await settings.save();
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Settings imported successfully' });
  } catch (error) {
    console.error('Error importing settings:', error);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ message: `Failed to import settings: ${error.message}` });
  }
});

module.exports = router;
