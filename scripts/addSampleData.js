// scripts/addSampleData.js
// Utility script to create sample accessories, glasses, and profiles
// Run this with: node scripts/addSampleData.js

require('dotenv').config();
const mongoose = require('mongoose');
const Accessory = require('../models/Accessory');
const Glass = require('../models/Glass');
const Profile = require('../models/Profile');

// MongoDB connection string - uses DATABASE_URL from .env
const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/vlx_v1';

// Sample accessories to create
const sampleAccessories = [
  {
    name: 'Standard Window Lock',
    referenceNumber: 'ACC-LOCK-001',
    providerName: 'Hardware Pro',
    price: 15.50,
    currency: 'USD',
    weight: 0.2,
    unit: 'piece'
  },
  {
    name: 'Heavy Duty Lock',
    referenceNumber: 'ACC-LOCK-002',
    providerName: 'Hardware Pro',
    price: 28.00,
    currency: 'USD',
    weight: 0.4,
    unit: 'piece'
  },
  {
    name: 'Window Handle - Standard',
    referenceNumber: 'ACC-HANDLE-001',
    providerName: 'Window Components Inc',
    price: 12.00,
    currency: 'USD',
    weight: 0.15,
    unit: 'piece'
  },
  {
    name: 'Window Handle - Premium',
    referenceNumber: 'ACC-HANDLE-002',
    providerName: 'Window Components Inc',
    price: 22.50,
    currency: 'USD',
    weight: 0.25,
    unit: 'piece'
  },
  {
    name: 'Weather Stripping - EPDM',
    referenceNumber: 'ACC-WS-001',
    providerName: 'Seal Solutions',
    price: 8.50,
    currency: 'USD',
    weight: 0.1,
    unit: 'meter'
  },
  {
    name: 'Weather Stripping - Silicone',
    referenceNumber: 'ACC-WS-002',
    providerName: 'Seal Solutions',
    price: 12.00,
    currency: 'USD',
    weight: 0.12,
    unit: 'meter'
  },
  {
    name: 'Corner Bracket - Standard',
    referenceNumber: 'ACC-CB-001',
    providerName: 'Frame Hardware Co',
    price: 5.00,
    currency: 'USD',
    weight: 0.08,
    unit: 'piece'
  },
  {
    name: 'Corner Bracket - Reinforced',
    referenceNumber: 'ACC-CB-002',
    providerName: 'Frame Hardware Co',
    price: 9.50,
    currency: 'USD',
    weight: 0.15,
    unit: 'piece'
  },
  {
    name: 'Screw Set - Standard',
    referenceNumber: 'ACC-SCREW-001',
    providerName: 'Fasteners Plus',
    price: 3.50,
    currency: 'USD',
    weight: 0.05,
    unit: 'set'
  },
  {
    name: 'Screw Set - Stainless Steel',
    referenceNumber: 'ACC-SCREW-002',
    providerName: 'Fasteners Plus',
    price: 6.00,
    currency: 'USD',
    weight: 0.06,
    unit: 'set'
  }
];

// Sample glasses to create
const sampleGlasses = [
  {
    glass_type: 'Single Pane Clear',
    description: 'Standard single pane clear glass, 4mm thickness',
    missile_type: '',
    pricePerSquareMeter: 25.00,
    currency: 'USD',
    weight: 10.0,
    isLowE: false,
    color: 'Clear'
  },
  {
    glass_type: 'Double Pane Clear',
    description: 'Insulated double pane clear glass, 6mm + 12mm air gap + 6mm',
    missile_type: '',
    pricePerSquareMeter: 45.00,
    currency: 'USD',
    weight: 18.0,
    isLowE: false,
    color: 'Clear'
  },
  {
    glass_type: 'Double Pane Low-E',
    description: 'Insulated double pane with Low-E coating, 6mm + 12mm air gap + 6mm',
    missile_type: '',
    pricePerSquareMeter: 65.00,
    currency: 'USD',
    weight: 18.5,
    isLowE: true,
    color: 'Clear'
  },
  {
    glass_type: 'Triple Pane Clear',
    description: 'Triple pane insulated glass, 6mm + 12mm + 6mm + 12mm + 6mm',
    missile_type: '',
    pricePerSquareMeter: 85.00,
    currency: 'USD',
    weight: 28.0,
    isLowE: false,
    color: 'Clear'
  },
  {
    glass_type: 'Triple Pane Low-E',
    description: 'Triple pane with Low-E coating for maximum energy efficiency',
    missile_type: '',
    pricePerSquareMeter: 110.00,
    currency: 'USD',
    weight: 29.0,
    isLowE: true,
    color: 'Clear'
  },
  {
    glass_type: 'Tinted Glass - Bronze',
    description: 'Single pane bronze tinted glass, 4mm thickness',
    missile_type: '',
    pricePerSquareMeter: 32.00,
    currency: 'USD',
    weight: 10.0,
    isLowE: false,
    color: 'Bronze'
  },
  {
    glass_type: 'Tinted Glass - Gray',
    description: 'Single pane gray tinted glass, 4mm thickness',
    missile_type: '',
    pricePerSquareMeter: 32.00,
    currency: 'USD',
    weight: 10.0,
    isLowE: false,
    color: 'Gray'
  },
  {
    glass_type: 'Laminated Safety Glass',
    description: 'Laminated safety glass, 6mm thickness, impact resistant',
    missile_type: 'Impact Resistant',
    pricePerSquareMeter: 55.00,
    currency: 'USD',
    weight: 15.0,
    isLowE: false,
    color: 'Clear'
  },
  {
    glass_type: 'Tempered Glass',
    description: 'Tempered safety glass, 6mm thickness',
    missile_type: 'Tempered',
    pricePerSquareMeter: 48.00,
    currency: 'USD',
    weight: 15.0,
    isLowE: false,
    color: 'Clear'
  },
  {
    glass_type: 'Double Pane Tinted Low-E',
    description: 'Double pane with bronze tint and Low-E coating',
    missile_type: '',
    pricePerSquareMeter: 75.00,
    currency: 'USD',
    weight: 19.0,
    isLowE: true,
    color: 'Bronze'
  }
];

// Sample profiles to create (non-muntin)
const sampleProfiles = [
  {
    name: 'Standard Aluminum Profile - White',
    pricePerMeter: 18.00,
    currency: 'USD',
    weight: 1.2,
    color: 'White',
    colorCode: '#FFFFFF',
    ammaCertification: '2603',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Standard Aluminum Profile - Black',
    pricePerMeter: 18.00,
    currency: 'USD',
    weight: 1.2,
    color: 'Black',
    colorCode: '#000000',
    ammaCertification: '2603',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Standard Aluminum Profile - Bronze',
    pricePerMeter: 20.00,
    currency: 'USD',
    weight: 1.2,
    color: 'Bronze',
    colorCode: '#CD7F32',
    ammaCertification: '2603',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Heavy Duty Aluminum Profile - White',
    pricePerMeter: 25.00,
    currency: 'USD',
    weight: 1.8,
    color: 'White',
    colorCode: '#FFFFFF',
    ammaCertification: '2604',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Heavy Duty Aluminum Profile - Black',
    pricePerMeter: 25.00,
    currency: 'USD',
    weight: 1.8,
    color: 'Black',
    colorCode: '#000000',
    ammaCertification: '2604',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Premium Aluminum Profile - White',
    pricePerMeter: 32.00,
    currency: 'USD',
    weight: 2.0,
    color: 'White',
    colorCode: '#FFFFFF',
    ammaCertification: '2605',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Premium Aluminum Profile - Black',
    pricePerMeter: 32.00,
    currency: 'USD',
    weight: 2.0,
    color: 'Black',
    colorCode: '#000000',
    ammaCertification: '2605',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Premium Aluminum Profile - Silver',
    pricePerMeter: 35.00,
    currency: 'USD',
    weight: 2.0,
    color: 'Silver',
    colorCode: '#C0C0C0',
    ammaCertification: '2605',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Standard Aluminum Profile - Gray',
    pricePerMeter: 18.00,
    currency: 'USD',
    weight: 1.2,
    color: 'Gray',
    colorCode: '#808080',
    ammaCertification: '2603',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  },
  {
    name: 'Standard Aluminum Profile - Beige',
    pricePerMeter: 19.00,
    currency: 'USD',
    weight: 1.2,
    color: 'Beige',
    colorCode: '#F5F5DC',
    ammaCertification: '2603',
    isMuntin: false,
    muntinType: 'none',
    muntinPattern: null,
    muntinSpacing: null
  }
];

async function addSampleData() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Add Accessories
    console.log('📦 Adding Accessories...');
    const existingAccessories = await Accessory.find({});
    console.log(`Found ${existingAccessories.length} existing accessories`);
    
    if (existingAccessories.length === 0) {
      const createdAccessories = await Accessory.insertMany(sampleAccessories);
      console.log(`✅ Successfully created ${createdAccessories.length} accessories:`);
      createdAccessories.forEach(acc => {
        console.log(`   - ${acc.name} (${acc.referenceNumber}) - $${acc.price} ${acc.currency}`);
      });
    } else {
      console.log('⚠️  Accessories already exist. Skipping accessory creation.');
      console.log('   To add more accessories, use the admin interface or clear existing ones first.');
    }

    console.log('');

    // Add Glasses
    console.log('🪟 Adding Glasses...');
    const existingGlasses = await Glass.find({});
    console.log(`Found ${existingGlasses.length} existing glasses`);
    
    if (existingGlasses.length === 0) {
      const createdGlasses = await Glass.insertMany(sampleGlasses);
      console.log(`✅ Successfully created ${createdGlasses.length} glasses:`);
      createdGlasses.forEach(glass => {
        const lowEText = glass.isLowE ? ' (Low-E)' : '';
        const missileText = glass.missile_type ? ` [${glass.missile_type}]` : '';
        console.log(`   - ${glass.glass_type}${lowEText}${missileText} - $${glass.pricePerSquareMeter} ${glass.currency}/m²`);
      });
    } else {
      console.log('⚠️  Glasses already exist. Skipping glass creation.');
      console.log('   To add more glasses, use the admin interface or clear existing ones first.');
    }

    console.log('');

    // Add Profiles
    console.log('🔧 Adding Profiles...');
    const existingProfiles = await Profile.find({ isMuntin: false });
    console.log(`Found ${existingProfiles.length} existing non-muntin profiles`);
    
    if (existingProfiles.length === 0) {
      const createdProfiles = await Profile.insertMany(sampleProfiles);
      console.log(`✅ Successfully created ${createdProfiles.length} profiles:`);
      createdProfiles.forEach(profile => {
        console.log(`   - ${profile.name} - $${profile.pricePerMeter} ${profile.currency}/m (${profile.ammaCertification})`);
      });
    } else {
      console.log('⚠️  Non-muntin profiles already exist. Skipping profile creation.');
      console.log('   To add more profiles, use the admin interface or clear existing ones first.');
    }

    console.log('\n✨ Sample data addition completed!');
    console.log('You can now use these items when creating window systems and projects.');

  } catch (error) {
    console.error('❌ Error adding sample data:', error);
    console.error(error.stack);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the script
addSampleData();

