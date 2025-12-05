const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  plainPassword: { type: String, default: '' }, // Store plaintext password but don't make it select:false
  role:{ type: String, required: true, default: "User" },
  pricingTier: { 
    type: String, 
    enum: ['tier1', 'tier2', 'tier3', 'tier4', ''], 
    default: '' 
  },
  lastLogin: { type: Date, default: null },
  companyName: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  email: { type: String, default: '' },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  city: { type: String, default: '' }
}, { timestamps: true });

userSchema.pre('save', function(next) {
  const user = this;
  if (!user.isModified('password')) return next();
  
  // Store the plain password before hashing
  user.plainPassword = user.password;
  
  bcrypt.hash(user.password, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      return next(err);
    }
    user.password = hash;
    next();
  });
});

// Method to compare passwords
userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compareSync(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;