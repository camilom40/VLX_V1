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
      const unitPrice = isNaN(this.unitPrice) ? 0 : this.unitPrice;
      const quantity = isNaN(this.quantity) ? 1 : this.quantity;
      return unitPrice * quantity;
    }
  },
  // Store selected configurations for restoration in edit mode
  windowSystemId: {
    type: Schema.Types.ObjectId,
    ref: 'Window',
    default: null
  },
  selectedGlassId: {
    type: Schema.Types.ObjectId,
    ref: 'Glass',
    default: null
  },
  missileType: {
    type: String,
    enum: ['LMI', 'SMI', ''],
    default: ''
  },
  includeFlange: {
    type: Boolean,
    default: false
  },
  // Store user-selected profiles (for user-configurable profiles only)
  selectedProfiles: [{
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    quantity: { type: Number, required: true, default: 1 },
    lengthDiscount: { type: Number, default: 0 }, // Stored in inches
    orientation: { type: String, enum: ['horizontal', 'vertical'], default: 'horizontal' }
  }],
  // Store user-selected accessories
  selectedAccessories: [{
    accessoryId: { type: Schema.Types.ObjectId, ref: 'Accessory', required: true },
    quantity: { type: Number, required: true, default: 1 },
    componentGroup: { type: String, default: null }, // For choice groups
    selectionType: { type: String, enum: ['single', 'multiple', 'quantity'], default: 'quantity' }
  }],
  // Store muntin configuration if applicable
  muntinConfiguration: {
    muntinType: { type: String, enum: ['colonial', 'geometric', 'custom'], default: null },
    horizontalDivisions: { type: Number, default: null },
    verticalDivisions: { type: Number, default: null },
    spacing: { type: Number, default: null },
    muntinProfileId: { type: Schema.Types.ObjectId, ref: 'Profile', default: null }
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Update total price when quantity or unit price changes
windowItemSchema.pre('save', function(next) {
  // Validate unitPrice and quantity before calculation
  const unitPrice = isNaN(this.unitPrice) ? 0 : this.unitPrice;
  const quantity = isNaN(this.quantity) ? 1 : this.quantity;
  
  this.totalPrice = unitPrice * quantity;
  
  // Ensure no NaN values are saved
  if (isNaN(this.totalPrice)) {
    this.totalPrice = 0;
  }
  if (isNaN(this.unitPrice)) {
    this.unitPrice = 0;
  }
  if (isNaN(this.quantity)) {
    this.quantity = 1;
  }
  
  next();
});

module.exports = mongoose.model('WindowItem', windowItemSchema); 