// Load environment variables
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function reactivateAdmin() {
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error('Error: DATABASE_URL not found in environment variables.');
      console.error('Please make sure your .env file contains DATABASE_URL');
      process.exit(1);
    }

    // Connect to MongoDB using the same connection as the app
    await mongoose.connect(process.env.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find all admin users
    const adminUsers = await User.find({ role: 'admin' });
    
    console.log('\n=== Admin Users Found ===');
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. Username: ${user.username}`);
      console.log(`   Active: ${user.isActive !== false ? 'YES' : 'NO'}`);
      console.log(`   ID: ${user._id}`);
      console.log('');
    });

    // Reactivate all admin users
    const result = await User.updateMany(
      { role: 'admin' },
      { $set: { isActive: true } }
    );

    console.log(`\n✅ Successfully reactivated ${result.modifiedCount} admin user(s)`);
    console.log('All admin accounts are now active.\n');

    // Close connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
reactivateAdmin();

