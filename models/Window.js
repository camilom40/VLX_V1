const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const glassRestrictionSchema = new Schema({
  type: { type: String, enum: ['A', 'B', 'C', 'Ai', 'Bi',], required: true },
  width: { type: Number, required: true }, // in inches
  height: { type: Number, required: true }, // in inches
  positivePressure: { type: Number, required: true }, // EXT+
  negativePressure: { type: Number, required: true }  // EXT
});

const muntinConfigurationSchema = new Schema({
  enabled: { type: Boolean, default: false },
  muntinProfile: { type: Schema.Types.ObjectId, ref: 'Profile' },
  muntinType: { type: String, enum: ['colonial', 'geometric', 'custom', 'none'], default: 'colonial' },
  horizontalDivisions: { type: Number, default: 1 }, // Number of horizontal divisions
  verticalDivisions: { type: Number, default: 1 },   // Number of vertical divisions
  spacing: { type: Number, default: 0 }, // Spacing in inches
  showToUser: { type: Boolean, default: false }, // Whether users can configure muntins
  isDefault: { type: Boolean, default: false }, // Default muntin configuration
});

// French door configuration sub-schema
const frenchDoorConfigSchema = new Schema({
  doorType: { type: String, enum: ['single', 'double'], default: 'double' },
  hingeSide: { type: String, enum: ['left', 'right'], default: 'left' }, // For single doors
  leftSidelites: { type: Number, default: 0, min: 0, max: 4 },
  rightSidelites: { type: Number, default: 0, min: 0, max: 4 },
  transom: { type: String, enum: ['none', 'full', 'over-door'], default: 'none' },
  showLogo: { type: Boolean, default: true }
}, { _id: false });

// Flange configuration sub-schema
const flangeConfigurationSchema = new Schema({
  hasFlange: { type: Boolean, default: false }, // Whether the window has a flange
  flangeSize: { type: String, default: null }, // Flange size (e.g., "1/2", "3/4", "1")
  isTrimable: { type: Boolean, default: false } // Whether the flange can be trimmed/removed by user
}, { _id: false });

// Missile impact configuration sub-schema
const missileImpactConfigurationSchema = new Schema({
  supportsLMI: { type: Boolean, default: false }, // Supports Large Missile Impact
  supportsSMI: { type: Boolean, default: false }, // Supports Small Missile Impact
  lmiGlasses: [{ type: Schema.Types.ObjectId, ref: 'Glass' }], // Available glasses for LMI
  smiGlasses: [{ type: Schema.Types.ObjectId, ref: 'Glass' }] // Available glasses for SMI
}, { _id: false });


// Panel configuration for dynamic preview (e.g., OXXO, OX, XOX)
const panelConfigurationSchema = new Schema({
  panels: [{ 
    type: String, 
    enum: ['O', 'X', 'F'], // X = Operable, O = Fixed, F = Fixed (alternative)
    default: 'O'
  }],
  panelRatios: [{ type: Number }], // Ratios for unequal panel sizes
  orientation: { 
    type: String, 
    enum: ['horizontal', 'vertical'], 
    default: 'horizontal' 
  },
  operationType: { 
    type: String, 
    enum: ['sliding', 'casement', 'awning', 'hopper', 'fixed', 'single-hung', 'double-hung', 'tilt-turn', 'french-door'],
    default: 'sliding'
  },
  hasMullion: { type: Boolean, default: true }, // Whether panels have mullions between them
  mullionWidth: { type: Number, default: 2 }, // Mullion width in inches
  showLogo: { type: Boolean, default: true }, // Show VITRALUX logo on glass
  frenchDoor: frenchDoorConfigSchema // French door specific configuration
});

const windowSchema = new Schema({
  type: { type: String, required: true },
  image: { type: String, default: null }, // Path to window system image
  profiles: [{
    profile: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    quantity: { type: Number, required: true },
    orientation: { type: String, required: true },
    lengthDiscount: { type: Number, required: true }, // Stored in inches for backend calculations
    lengthDiscountDisplay: { type: String, default: null }, // Original value as entered by user
    lengthUnit: { type: String, enum: ['in', 'mm'], default: 'in' }, // Unit used for display
    category: { type: String, enum: ['frame', 'fixed-vent', 'operable-vent', 'other'], default: 'frame' }, // Component category
    showToUser: { type: Boolean, default: false }, // Whether to show this profile to users for configuration
    componentGroup: { type: String, default: null }, // Group name for related components (e.g., "frame-types", "mullions")
    selectionType: { type: String, enum: ['single', 'multiple', 'quantity'], default: 'quantity' }, // How users can select this component
    isDefault: { type: Boolean, default: false } // Whether this is the default choice in a single-selection group
  }],
  accessories: [{
    accessory: { type: Schema.Types.ObjectId, ref: 'Accessory', required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    showToUser: { type: Boolean, default: false }, // Whether to show this accessory to users for configuration
    componentGroup: { type: String, default: null }, // Group name for related components (e.g., "handles", "locks")
    selectionType: { type: String, enum: ['single', 'multiple', 'quantity'], default: 'quantity' }, // How users can select this component
    isDefault: { type: Boolean, default: false } // Whether this is the default choice in a single-selection group
  }],
  glassRestrictions: [glassRestrictionSchema], // Embedded glass restrictions
  muntinConfiguration: muntinConfigurationSchema, // Muntin configuration
  panelConfiguration: panelConfigurationSchema, // Panel layout for dynamic preview
  flangeConfiguration: flangeConfigurationSchema, // Flange configuration
  missileImpactConfiguration: missileImpactConfigurationSchema // Missile impact capability
});

module.exports = mongoose.model('Window', windowSchema);
