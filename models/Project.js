// models/Project.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const projectSchema = new Schema({
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  clientName: {
    type: String,
    trim: true // Optional, remove if not needed
  },
  quoteNumber: {
    type: String,
    trim: true,
    index: true // Index for faster querying
  },
  // Link to the user who owns this project
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Refers to the 'User' model
    required: true,
    index: true // Index for faster querying by user
  },
  // Add other project-specific fields later if needed
  // e.g., windows: [ { type: Schema.Types.ObjectId, ref: 'WindowEstimate' } ]
}, {
  // Automatically add createdAt and updatedAt fields
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);