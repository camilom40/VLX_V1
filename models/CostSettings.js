const mongoose = require('mongoose');

const costSettingsSchema = new mongoose.Schema({
  seaFreight: {
    type: Number,
    required: true
  },
  landFreight: {
    type: Number,
    required: true
  },
  packaging: {
    type: Number,
    required: true
  },
  labor: {
    type: Number,
    required: true
  },
  indirectCosts: {
    type: Number,
    required: true
  },
  administrativeExpenses: {
    type: Number,
    required: true,
    default: 0
  },
  exchangeRate: {
    type: Number,
    required: true,
    default: 4000, // Default USD to COP rate
    min: 0
  },
  currency: { 
    type: String, 
    required: true,
    enum: ['COP', 'USD'],
    default: 'COP'
  }
});

costSettingsSchema.pre('save', async function(next) {
  console.log('Saving cost settings...');
  next();
});

costSettingsSchema.post('save', function(doc, next) {
  console.log(`Cost settings saved: ${doc._id}`);
  next();
});

costSettingsSchema.post('find', function(docs) {
  console.log(`Found cost settings documents: ${docs.length}`);
});

costSettingsSchema.post('findOneAndUpdate', function(doc) {
  console.log(`Cost settings document updated: ${doc._id}`);
});

costSettingsSchema.post('findOneAndDelete', function(doc) {
  console.log(`Cost settings document deleted: ${doc._id}`);
});

costSettingsSchema.post('error', function(error, doc, next) {
  console.error(`Error occurred in costSettingsSchema operation: ${error}`, error);
  next(error);
});

const CostSettings = mongoose.model('CostSettings', costSettingsSchema);

module.exports = CostSettings;
