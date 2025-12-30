require('dotenv').config();
const mongoose = require('mongoose');
const Accessory = require('../models/Accessory');
const Glass = require('../models/Glass');
const Profile = require('../models/Profile');
const Window = require('../models/Window');

/**
 * Script to clear all accessories, glass, and profiles from the database
 * 
 * WARNING: This will permanently delete ALL accessories, glass, and profiles!
 * This may break existing window systems that reference these components.
 * Make sure you have a backup if needed.
 */
async function clearComponents() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    // Count existing components
    const [accessoryCount, glassCount, profileCount] = await Promise.all([
      Accessory.countDocuments({}),
      Glass.countDocuments({}),
      Profile.countDocuments({})
    ]);

    console.log('='.repeat(60));
    console.log('📊 Current Database Status:');
    console.log(`   Accessories: ${accessoryCount}`);
    console.log(`   Glass Types: ${glassCount}`);
    console.log(`   Profiles: ${profileCount}`);
    console.log('='.repeat(60));

    // Check for window systems that reference these components
    const windowCount = await Window.countDocuments({});
    if (windowCount > 0) {
      console.log(`\n⚠️  WARNING: Found ${windowCount} window system(s) in the database.`);
      console.log('   Window systems may reference accessories, glass, or profiles.');
      console.log('   These references will become invalid after deletion.');
      console.log('   Consider clearing window systems first if needed.\n');
    }

    if (accessoryCount === 0 && glassCount === 0 && profileCount === 0) {
      console.log('✅ All component databases are already empty!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Delete all components
    console.log('\n🗑️  Starting deletion...\n');
    
    const [accessoryResult, glassResult, profileResult] = await Promise.all([
      Accessory.deleteMany({}),
      Glass.deleteMany({}),
      Profile.deleteMany({})
    ]);

    console.log('='.repeat(60));
    console.log('📊 Deletion Summary:');
    console.log(`   ✅ Accessories deleted: ${accessoryResult.deletedCount}`);
    console.log(`   ✅ Glass types deleted: ${glassResult.deletedCount}`);
    console.log(`   ✅ Profiles deleted: ${profileResult.deletedCount}`);
    console.log('='.repeat(60));
    console.log('\n✅ All components have been cleared from the database.');
    console.log('\n📝 Next steps:');
    console.log('   1. Add new accessories, glass, and profiles through the admin interface');
    console.log('   2. Or use Excel import if you have data files');
    console.log('   3. Update any window systems that referenced deleted components\n');

  } catch (error) {
    console.error('❌ Error clearing components:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  console.log('🚀 Starting component deletion...\n');
  console.log('⚠️  WARNING: This will delete ALL accessories, glass, and profiles!');
  console.log('   This may break existing window systems that reference these components.');
  console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
  
  // Give user 5 seconds to cancel
  setTimeout(() => {
    clearComponents();
  }, 5000);
}

module.exports = { clearComponents };

