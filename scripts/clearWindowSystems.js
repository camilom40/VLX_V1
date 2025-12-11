require('dotenv').config();
const mongoose = require('mongoose');
const WindowSystem = require('../models/Window');

/**
 * Script to clear all window systems from the database
 * 
 * WARNING: This will permanently delete ALL window systems!
 * Make sure you have a backup if needed.
 */
async function clearWindowSystems() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    // Count existing window systems
    const count = await WindowSystem.countDocuments({});
    console.log(`\n📦 Found ${count} window system(s) in the database\n`);

    if (count === 0) {
      console.log('✅ No window systems to delete. Database is already empty!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Delete all window systems
    const result = await WindowSystem.deleteMany({});

    console.log('='.repeat(60));
    console.log('📊 Deletion Summary:');
    console.log(`   ✅ Successfully deleted: ${result.deletedCount} window system(s)`);
    console.log('='.repeat(60));
    console.log('\n✅ All window systems have been cleared from the database.\n');

  } catch (error) {
    console.error('❌ Error clearing window systems:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  console.log('🚀 Starting window systems deletion...\n');
  console.log('⚠️  WARNING: This will delete ALL window systems from the database!');
  console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
  
  // Give user 3 seconds to cancel
  setTimeout(() => {
    clearWindowSystems();
  }, 3000);
}

module.exports = { clearWindowSystems };

