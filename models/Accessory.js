const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accessorySchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  referenceNumber: {
    type: String,
    required: true,
    default: function() {
      // Generate a default reference number based on name if not provided
      return 'REF-' + this.name.substring(0, 4).toUpperCase() + '-' + Date.now().toString().substring(6);
    }
  },
  providerName: {
    type: String,
    required: false,
    default: ''
  },
  price: { type: Number, required: true },
  weight: { type: Number, required: false },
  unit: { type: String, required: true }
});

module.exports = mongoose.model('Accessory', accessorySchema);
