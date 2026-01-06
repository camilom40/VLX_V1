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
  // Note: This default is only used if totalPrice is not explicitly set
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
// BUT: Preserve totalPrice if it was explicitly set (allows backend to set it directly for precision)
windowItemSchema.pre('save', function(next) {
  // Validate unitPrice and quantity before calculation
  const unitPrice = isNaN(this.unitPrice) ? 0 : this.unitPrice;
  const quantity = isNaN(this.quantity) ? 1 : this.quantity;
  
  // Store the original totalPrice before any modifications
  const originalTotalPrice = this.totalPrice;
  
  // Check if totalPrice was explicitly set in this operation
  // Strategy: If totalPrice is set and doesn't match unitPrice * quantity (within rounding tolerance),
  // then it was explicitly set and should be preserved
  const calculatedTotalPrice = unitPrice * quantity;
  const priceDifference = Math.abs((originalTotalPrice || 0) - calculatedTotalPrice);
  const roundingTolerance = 0.01; // Allow 1 cent difference for rounding
  
  // totalPrice was explicitly set if:
  // 1. It's a new document and totalPrice is provided, OR
  // 2. It's an existing document and totalPrice was modified, OR
  // 3. The totalPrice differs from calculated value by more than rounding tolerance (explicitly set)
  const totalPriceExplicitlySet = (this.isNew && this.totalPrice !== undefined && this.totalPrice !== null && !isNaN(this.totalPrice)) ||
                                   (!this.isNew && this.isModified('totalPrice')) ||
                                   (priceDifference > roundingTolerance);
  
  // Only recalculate totalPrice if it wasn't explicitly set
  // This allows the backend to set totalPrice directly (e.g., from finalPrice) to maintain precision
  if (!totalPriceExplicitlySet) {
    // Recalculate from unitPrice * quantity
    this.totalPrice = calculatedTotalPrice;
  }
  // If totalPrice was explicitly set, keep it as-is (backend set it directly to maintain precision)
  
  // Debug logging (can be removed in production)
  if (this.isNew) {
    console.log('[WindowItem pre-save] New document:');
    console.log('  unitPrice:', unitPrice);
    console.log('  quantity:', quantity);
    console.log('  originalTotalPrice:', originalTotalPrice);
    console.log('  calculatedTotalPrice:', calculatedTotalPrice);
    console.log('  priceDifference:', priceDifference);
    console.log('  totalPriceExplicitlySet:', totalPriceExplicitlySet);
    console.log('  final totalPrice:', this.totalPrice);
  }
  
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