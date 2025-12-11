require('dotenv').config();
const mongoose = require('mongoose');
const WindowItem = require('../models/WindowItem');
const { getExchangeRate } = require('../utils/currencyConverter');

/**
 * Migration script to convert all window item prices from COP to USD
 * 
 * This script:
 * 1. Gets the current exchange rate
 * 2. Finds all WindowItems in the database
 * 3. Converts unitPrice and totalPrice from COP to USD (divides by exchange rate)
 * 4. Saves the updated items
 * 
 * IMPORTANT: Run this script ONCE after updating the codebase to use USD internally
 */
async function migratePricesToUSD() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    // Get current exchange rate
    const exchangeRate = await getExchangeRate();
    console.log(`\n📊 Current exchange rate: 1 USD = ${exchangeRate} COP`);
    console.log(`   Converting prices by dividing by ${exchangeRate}\n`);

    // Find all window items
    const windowItems = await WindowItem.find({});
    console.log(`📦 Found ${windowItems.length} window items to migrate\n`);

    if (windowItems.length === 0) {
      console.log('✅ No window items to migrate. Database is ready!');
      await mongoose.disconnect();
      process.exit(0);
    }

    let migratedCount = 0;
    let errorCount = 0;

    // Convert each item's prices from COP to USD
    for (const item of windowItems) {
      try {
        const oldUnitPrice = item.unitPrice;
        const oldTotalPrice = item.totalPrice;

        // Convert from COP to USD (divide by exchange rate)
        const newUnitPrice = oldUnitPrice / exchangeRate;
        const newTotalPrice = oldTotalPrice / exchangeRate;

        // Update the item
        item.unitPrice = parseFloat(newUnitPrice.toFixed(2));
        item.totalPrice = parseFloat(newTotalPrice.toFixed(2));

        await item.save();

        migratedCount++;
        console.log(`✓ Migrated: ${item.itemName} - Unit: ${oldUnitPrice.toLocaleString()} COP → $${item.unitPrice.toFixed(2)} USD`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error migrating ${item.itemName} (ID: ${item._id}):`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount} items`);
    if (errorCount > 0) {
      console.log(`   ⚠️  Errors: ${errorCount} items`);
    }
    console.log(`   📈 Exchange rate used: ${exchangeRate}`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration completed!');
    console.log('   All prices are now stored in USD in the database.');
    console.log('   The system will display them in the selected currency (COP or USD).\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the migration
if (require.main === module) {
  console.log('🚀 Starting price migration from COP to USD...\n');
  migratePricesToUSD();
}

module.exports = { migratePricesToUSD };

