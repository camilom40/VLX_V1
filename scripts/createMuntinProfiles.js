// scripts/createMuntinProfiles.js
// Utility script to create sample muntin profiles
// Run this with: node scripts/createMuntinProfiles.js

const mongoose = require('mongoose');
const Profile = require('../models/Profile');

// MongoDB connection string - update this to match your setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vlx_v1';

// Sample muntin profiles to create
const sampleMuntinProfiles = [
  {
    name: 'Colonial Muntin Profile',
    pricePerMeter: 25.00,
    currency: 'USD',
    weight: 0.5,
    color: 'White',
    colorCode: '#FFFFFF',
    ammaCertification: '2603',
    isMuntin: true,
    muntinType: 'colonial',
    muntinPattern: 'Traditional colonial grid',
    muntinSpacing: 0.25
  },
  {
    name: 'Geometric Muntin Profile',
    pricePerMeter: 30.00,
    currency: 'USD',
    weight: 0.6,
    color: 'Black',
    colorCode: '#000000',
    ammaCertification: '2604',
    isMuntin: true,
    muntinType: 'geometric',
    muntinPattern: 'Modern geometric pattern',
    muntinSpacing: 0.5
  },
  {
    name: 'Custom Muntin Profile',
    pricePerMeter: 35.00,
    currency: 'USD',
    weight: 0.7,
    color: 'Bronze',
    colorCode: '#CD7F32',
    ammaCertification: '2605',
    isMuntin: true,
    muntinType: 'custom',
    muntinPattern: 'Custom architectural pattern',
    muntinSpacing: 0.75
  },
  {
    name: 'Thin Colonial Muntin',
    pricePerMeter: 20.00,
    currency: 'USD',
    weight: 0.3,
    color: 'White',
    colorCode: '#FFFFFF',
    ammaCertification: '2603',
    isMuntin: true,
    muntinType: 'colonial',
    muntinPattern: 'Thin colonial bars',
    muntinSpacing: 0.125
  }
];

async function createMuntinProfiles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if muntin profiles already exist
    const existingMuntinProfiles = await Profile.find({ isMuntin: true });
    console.log(`Found ${existingMuntinProfiles.length} existing muntin profiles`);

    if (existingMuntinProfiles.length > 0) {
      console.log('Muntin profiles already exist. Skipping creation.');
      console.log('Existing muntin profiles:');
      existingMuntinProfiles.forEach(profile => {
        console.log(`- ${profile.name} (${profile.muntinType})`);
      });
      return;
    }

    // Create sample muntin profiles
    console.log('Creating sample muntin profiles...');
    const createdProfiles = await Profile.insertMany(sampleMuntinProfiles);
    
    console.log(`Successfully created ${createdProfiles.length} muntin profiles:`);
    createdProfiles.forEach(profile => {
      console.log(`- ${profile.name} (${profile.muntinType}) - $${profile.pricePerMeter}/${profile.currency}`);
    });

    console.log('\nMuntin profiles created successfully!');
    console.log('You can now use these profiles when creating window systems with muntins.');

  } catch (error) {
    console.error('Error creating muntin profiles:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
createMuntinProfiles();
