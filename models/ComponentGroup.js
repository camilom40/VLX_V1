const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const componentGroupSchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  displayName: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    default: ''
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  sortOrder: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: true
});

// Index for faster queries
componentGroupSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('ComponentGroup', componentGroupSchema); 