const mongoose = require('mongoose');
require('dotenv').config();

const ComponentGroup = require('../models/ComponentGroup');

// Default component groups to initialize
const defaultGroups = [
  {
    name: 'handles',
    displayName: 'Handles',
    description: 'Window handles and operating hardware',
    sortOrder: 10,
    isActive: true
  },
  {
    name: 'locks',
    displayName: 'Locks & Security',
    description: 'Locking mechanisms and security hardware',
    sortOrder: 20,
    isActive: true
  },
  {
    name: 'hinges',
    displayName: 'Hinges',
    description: 'Hinge systems and mounting hardware',
    sortOrder: 30,
    isActive: true
  },
  {
    name: 'seals',
    displayName: 'Seals & Weatherstripping',
    description: 'Weather sealing and insulation components',
    sortOrder: 40,
    isActive: true
  },
  {
    name: 'hardware',
    displayName: 'Hardware & Fasteners',
    description: 'General hardware, screws, and fastening components',
    sortOrder: 50,
    isActive: true
  },
  {
    name: 'glass-options',
    displayName: 'Glass Options',
    description: 'Glass-related accessories and options',
    sortOrder: 60,
    isActive: true
  },
  {
    name: 'mechanisms',
    displayName: 'Operating Mechanisms',
    description: 'Window operators and movement mechanisms',
    sortOrder: 70,
    isActive: true
  },
  {
    name: 'finishes',
    displayName: 'Finishes & Colors',
    description: 'Color and finish options for components',
    sortOrder: 80,
    isActive: true
  }
];

async function initializeComponentGroups() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to database');

    // Check if any component groups already exist
    const existingCount = await ComponentGroup.countDocuments();
    
    if (existingCount > 0) {
      console.log(`${existingCount} component groups already exist. Skipping initialization.`);
      process.exit(0);
    }

    // Create default component groups
    console.log('Creating default component groups...');
    
    for (const groupData of defaultGroups) {
      const group = new ComponentGroup(groupData);
      await group.save();
      console.log(`✓ Created component group: ${group.displayName}`);
    }

    console.log('\n✅ Successfully initialized default component groups!');
    console.log('\nDefault groups created:');
    defaultGroups.forEach(group => {
      console.log(`   • ${group.displayName} (${group.name})`);
    });

    console.log('\nYou can now:');
    console.log('1. View and manage component groups at: /admin/component-groups');
    console.log('2. Use these groups when configuring window system accessories');
    console.log('3. Add, edit, or deactivate groups as needed');

  } catch (error) {
    console.error('Error initializing component groups:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

// Run the initialization
if (require.main === module) {
  initializeComponentGroups();
}

module.exports = { initializeComponentGroups, defaultGroups }; 