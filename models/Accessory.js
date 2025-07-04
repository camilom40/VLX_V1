const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accessorySchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  referenceNumber: {
    type: String,
    required: true
  },
  providerName: {
    type: String,
    required: false,
    default: ''
  },
  price: { type: Number, required: true },
  currency: { 
    type: String, 
    required: true,
    enum: ['COP', 'USD'],
    default: 'COP'
  },
  weight: { type: Number, required: false },
  unit: { type: String, required: true },
  image: { 
    type: String, 
    required: false,
    default: ''
  }
});

module.exports = mongoose.model('Accessory', accessorySchema);
