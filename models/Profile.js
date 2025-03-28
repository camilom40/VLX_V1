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
  ammaCertification: {
    type: String,
    required: true,
    enum: ['2603', '2604', '2605'],
  },
});

module.exports = mongoose.model('Profile', profileSchema);
