const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const windowItemSchema = new Schema({
  // Reference to the project this item belongs to
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  // Window item properties
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  width: {
    type: Number,
    required: true,
    min: 0
  },
  height: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  // Additional properties
  material: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  style: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Calculate total price for the item = unitPrice * quantity
  totalPrice: {
    type: Number,
    default: function() {
      return this.unitPrice * this.quantity;
    }
  }
}, {
  timestamps: true
});

// Update total price when quantity or unit price changes
windowItemSchema.pre('save', function(next) {
  this.totalPrice = this.unitPrice * this.quantity;
  next();
});

module.exports = mongoose.model('WindowItem', windowItemSchema); 