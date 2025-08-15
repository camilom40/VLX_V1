// models/Profile.js
const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  pricePerMeter: {
    type: Number,
    required: true,
  },
  currency: { 
    type: String, 
    required: true,
    enum: ['COP', 'USD'],
    default: 'COP'
  },
  weight: {
    type: Number,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  colorCode: {
    type: String,
    required: true,
  },
  ammaCertification: {
    type: String,
    required: true,
    enum: ['2603', '2604', '2605'],
  },
  // Muntin support
  isMuntin: {
    type: Boolean,
    default: false,
  },
  muntinType: {
    type: String,
    enum: ['colonial', 'geometric', 'custom', 'none'],
    default: 'none',
  },
  muntinPattern: {
    type: String,
    default: null, // For custom patterns
  },
  muntinSpacing: {
    type: Number,
    default: null, // Spacing in inches
  },
});

module.exports = mongoose.model('Profile', profileSchema);
