const mongoose = require('mongoose');

const glassSchema = new mongoose.Schema({
  glass_type: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  missile_type: {
    type: String,
    required: true,
    enum: ['LMI', 'SMI'] // Ensure only 'LMI' or 'SMI' are allowed
  },
  pricePerSquareMeter: {
    type: Number,
    required: true
  },
  currency: { 
    type: String, 
    required: true,
    enum: ['COP', 'USD'],
    default: 'COP'
  },
  weight: {
    type: Number,
    required: true
  },
  isLowE: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('Glass', glassSchema);
