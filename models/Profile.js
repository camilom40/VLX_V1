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
});

module.exports = mongoose.model('Profile', profileSchema);
