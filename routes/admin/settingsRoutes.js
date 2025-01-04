const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const CostSettings = require('../../models/CostSettings');

// Middleware to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Variable to store the exchange rate
let usdToCopRate = null;

// Fetch exchange rate
const fetchExchangeRate = async () => {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    usdToCopRate = response.data.rates.COP;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
  }
};

// Initial fetch of the exchange rate
fetchExchangeRate();
// Refresh exchange rate every hour
setInterval(fetchExchangeRate, 60 * 60 * 1000);

// Render settings page
router.get('/settings', async (req, res) => {
  try {
    const settings = await CostSettings.findOne();
    res.render('admin/settings', { settings, usdToCopRate });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).send('Server Error');
  }
});

// Save settings
router.post('/settings', async (req, res) => {
  try {
    let settings = await CostSettings.findOne();
    if (settings) {
      settings.seaFreight = req.body.seaFreight;
      settings.landFreight = req.body.landFreight;
      settings.packaging = req.body.packaging;
      settings.labor = req.body.labor;
      settings.indirectCosts = req.body.indirectCosts; // Add the new field
      settings.administrativeExpenses = req.body.administrativeExpenses;
      await settings.save();
    } else {
      settings = new CostSettings(req.body);
      await settings.save();
    }
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).send('Server Error');
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
