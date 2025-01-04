const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accessorySchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  price: { type: Number, required: true },
  weight: { type: Number, required: false },
  unit: { type: String, required: true }
});

module.exports = mongoose.model('Accessory', accessorySchema);
