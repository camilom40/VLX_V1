const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const glassRestrictionSchema = new Schema({
  type: { type: String, enum: ['A', 'B', 'C', 'Ai', 'Bi',], required: true },
  width: { type: Number, required: true }, // in inches
  height: { type: Number, required: true }, // in inches
  positivePressure: { type: Number, required: true }, // EXT+
  negativePressure: { type: Number, required: true }  // EXT
});

const windowSchema = new Schema({
  type: { type: String, required: true },
  profiles: [{
    profile: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    quantity: { type: Number, required: true },
    orientation: { type: String, required: true },
    lengthDiscount: { type: Number, required: true } // in inches
  }],
  accessories: [{
    accessory: { type: Schema.Types.ObjectId, ref: 'Accessory', required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true }
  }],
  glassRestrictions: [glassRestrictionSchema] // Embedded glass restrictions
});

module.exports = mongoose.model('Window', windowSchema);
