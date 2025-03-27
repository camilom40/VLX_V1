require('dotenv').config();
const mongoose = require('mongoose');
const Accessory = require('../models/Accessory');

// Function to generate a reference number based on accessory name
function generateReferenceNumber(name) {
  return 'REF-' + name.substring(0, 4).toUpperCase() + '-' + Date.now().toString().substring(6);
}

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL)
.then(() => {
  console.log('Connected to MongoDB');
  updateAccessories();
})
.catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

async function updateAccessories() {
  try {
    // Find all accessories that don't have a referenceNumber
    const accessories = await Accessory.find({ referenceNumber: { $exists: false } });
    console.log(`Found ${accessories.length} accessories without reference numbers`);

    // Update each accessory
    for (const accessory of accessories) {
      const referenceNumber = generateReferenceNumber(accessory.name);
      console.log(`Updating ${accessory.name} with reference number: ${referenceNumber}`);
      
      await Accessory.updateOne(
        { _id: accessory._id },
        { 
          $set: { 
            referenceNumber: referenceNumber,
            providerName: accessory.providerName || '' 
          } 
        }
      );
    }

    console.log('All accessories have been updated with reference numbers');
    process.exit(0);
  } catch (error) {
    console.error('Error updating accessories:', error);
    process.exit(1);
  }
} 