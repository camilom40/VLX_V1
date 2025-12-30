// scripts/inspectWindowSystem.js
// Utility script to inspect a window system by name
// Run this with: node scripts/inspectWindowSystem.js fixed

require('dotenv').config();
const mongoose = require('mongoose');
const Window = require('../models/Window');
const Profile = require('../models/Profile');
const Accessory = require('../models/Accessory');
const Glass = require('../models/Glass');

// MongoDB connection string - uses DATABASE_URL from .env
const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/vlx_v1';

// Get window system name from command line argument
const windowSystemName = process.argv[2] || 'fixed';

async function inspectWindowSystem() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the window system (case-insensitive)
    const windowSystem = await Window.findOne({ 
      type: { $regex: new RegExp(`^${windowSystemName}$`, 'i') }
    })
      .populate('profiles.profile')
      .populate('accessories.accessory')
      .populate('muntinConfiguration.muntinProfile')
      .populate('missileImpactConfiguration.lmiGlasses')
      .populate('missileImpactConfiguration.smiGlasses');

    if (!windowSystem) {
      console.log(`❌ Window system "${windowSystemName}" not found.`);
      console.log('\nAvailable window systems:');
      const allSystems = await Window.find({}, 'type').sort({ type: 1 });
      if (allSystems.length === 0) {
        console.log('  (No window systems found)');
      } else {
        allSystems.forEach(sys => {
          console.log(`  - ${sys.type}`);
        });
      }
      return;
    }

    console.log('='.repeat(80));
    console.log(`Window System: ${windowSystem.type}`);
    console.log('='.repeat(80));
    
    // Basic Info
    console.log('\n📋 Basic Information:');
    console.log(`  ID: ${windowSystem._id}`);
    console.log(`  Type: ${windowSystem.type}`);
    if (windowSystem.image) {
      console.log(`  Image: ${windowSystem.image}`);
    }

    // Panel Configuration
    if (windowSystem.panelConfiguration) {
      console.log('\n🪟 Panel Configuration:');
      const pc = windowSystem.panelConfiguration;
      console.log(`  Operation Type: ${pc.operationType || 'N/A'}`);
      console.log(`  Orientation: ${pc.orientation || 'N/A'}`);
      console.log(`  Panels: ${pc.panels ? pc.panels.join(' ') : 'N/A'} (O=Fixed, X=Operable)`);
      if (pc.panelRatios && pc.panelRatios.length > 0) {
        console.log(`  Panel Ratios: ${pc.panelRatios.join(' : ')}`);
      }
      console.log(`  Has Mullion: ${pc.hasMullion ? 'Yes' : 'No'}`);
      if (pc.hasMullion) {
        console.log(`  Mullion Width: ${pc.mullionWidth || 0} inches`);
      }
      console.log(`  Show Logo: ${pc.showLogo ? 'Yes' : 'No'}`);
      
      if (pc.frenchDoor) {
        console.log(`  French Door Type: ${pc.frenchDoor.doorType || 'N/A'}`);
        console.log(`  Hinge Side: ${pc.frenchDoor.hingeSide || 'N/A'}`);
        console.log(`  Left Sidelites: ${pc.frenchDoor.leftSidelites || 0}`);
        console.log(`  Right Sidelites: ${pc.frenchDoor.rightSidelites || 0}`);
        console.log(`  Transom: ${pc.frenchDoor.transom || 'none'}`);
      }
    }

    // Profiles
    console.log('\n🔧 Profiles:');
    if (windowSystem.profiles && windowSystem.profiles.length > 0) {
      windowSystem.profiles.forEach((profileItem, index) => {
        console.log(`  ${index + 1}. ${profileItem.profile ? profileItem.profile.name : 'N/A'}`);
        console.log(`     - Quantity: ${profileItem.quantity}`);
        console.log(`     - Orientation: ${profileItem.orientation}`);
        console.log(`     - Length Discount: ${profileItem.lengthDiscount} inches`);
        console.log(`     - Category: ${profileItem.category || 'frame'}`);
        console.log(`     - Show to User: ${profileItem.showToUser ? 'Yes' : 'No'}`);
        if (profileItem.componentGroup) {
          console.log(`     - Component Group: ${profileItem.componentGroup}`);
          console.log(`     - Selection Type: ${profileItem.selectionType || 'quantity'}`);
          console.log(`     - Is Default: ${profileItem.isDefault ? 'Yes' : 'No'}`);
        }
        if (profileItem.profile) {
          console.log(`     - Price: $${profileItem.profile.pricePerMeter} ${profileItem.profile.currency}/m`);
          console.log(`     - Color: ${profileItem.profile.color}`);
          console.log(`     - AAMA: ${profileItem.profile.ammaCertification}`);
        }
        console.log('');
      });
    } else {
      console.log('  (No profiles configured)');
    }

    // Accessories
    console.log('\n🔩 Accessories:');
    if (windowSystem.accessories && windowSystem.accessories.length > 0) {
      windowSystem.accessories.forEach((accItem, index) => {
        console.log(`  ${index + 1}. ${accItem.accessory ? accItem.accessory.name : 'N/A'}`);
        console.log(`     - Quantity: ${accItem.quantity}`);
        console.log(`     - Unit: ${accItem.unit}`);
        console.log(`     - Show to User: ${accItem.showToUser ? 'Yes' : 'No'}`);
        if (accItem.componentGroup) {
          console.log(`     - Component Group: ${accItem.componentGroup}`);
          console.log(`     - Selection Type: ${accItem.selectionType || 'quantity'}`);
          console.log(`     - Is Default: ${accItem.isDefault ? 'Yes' : 'No'}`);
        }
        if (accItem.accessory) {
          console.log(`     - Price: $${accItem.accessory.price} ${accItem.accessory.currency}/${accItem.accessory.unit}`);
          console.log(`     - Reference: ${accItem.accessory.referenceNumber || 'N/A'}`);
        }
        console.log('');
      });
    } else {
      console.log('  (No accessories configured)');
    }

    // Muntin Configuration
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled) {
      console.log('\n🎨 Muntin Configuration:');
      const mc = windowSystem.muntinConfiguration;
      console.log(`  Enabled: Yes`);
      console.log(`  Type: ${mc.muntinType || 'N/A'}`);
      console.log(`  Horizontal Divisions: ${mc.horizontalDivisions || 1}`);
      console.log(`  Vertical Divisions: ${mc.verticalDivisions || 1}`);
      console.log(`  Spacing: ${mc.spacing || 0} inches`);
      console.log(`  Show to User: ${mc.showToUser ? 'Yes' : 'No'}`);
      if (mc.muntinProfile && mc.muntinProfile.name) {
        console.log(`  Profile: ${mc.muntinProfile.name}`);
      }
    } else {
      console.log('\n🎨 Muntin Configuration:');
      console.log('  Enabled: No');
    }

    // Flange Configuration
    if (windowSystem.flangeConfiguration) {
      console.log('\n📐 Flange Configuration:');
      const fc = windowSystem.flangeConfiguration;
      console.log(`  Has Flange: ${fc.hasFlange ? 'Yes' : 'No'}`);
      if (fc.hasFlange) {
        console.log(`  Flange Size: ${fc.flangeSize || 'N/A'}`);
        console.log(`  Is Trimable: ${fc.isTrimable ? 'Yes' : 'No'}`);
      }
    }

    // Missile Impact Configuration
    if (windowSystem.missileImpactConfiguration) {
      console.log('\n🛡️ Missile Impact Configuration:');
      const mic = windowSystem.missileImpactConfiguration;
      console.log(`  Supports LMI: ${mic.supportsLMI ? 'Yes' : 'No'}`);
      console.log(`  Supports SMI: ${mic.supportsSMI ? 'Yes' : 'No'}`);
      if (mic.supportsLMI && mic.lmiGlasses && mic.lmiGlasses.length > 0) {
        console.log(`  LMI Glasses (${mic.lmiGlasses.length}):`);
        mic.lmiGlasses.forEach(glass => {
          console.log(`    - ${glass.glass_type}`);
        });
      }
      if (mic.supportsSMI && mic.smiGlasses && mic.smiGlasses.length > 0) {
        console.log(`  SMI Glasses (${mic.smiGlasses.length}):`);
        mic.smiGlasses.forEach(glass => {
          console.log(`    - ${glass.glass_type}`);
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('Summary:');
    console.log(`  Total Profiles: ${windowSystem.profiles ? windowSystem.profiles.length : 0}`);
    console.log(`  User-Configurable Profiles: ${windowSystem.profiles ? windowSystem.profiles.filter(p => p.showToUser).length : 0}`);
    console.log(`  Total Accessories: ${windowSystem.accessories ? windowSystem.accessories.length : 0}`);
    console.log(`  User-Configurable Accessories: ${windowSystem.accessories ? windowSystem.accessories.filter(a => a.showToUser).length : 0}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error inspecting window system:', error);
    console.error(error.stack);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the script
inspectWindowSystem();

