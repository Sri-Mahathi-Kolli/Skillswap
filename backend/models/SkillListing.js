const mongoose = require('mongoose');

const skillListingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  skillName: { type: String, required: true, index: true, lowercase: true },
  tags: [{ type: String, lowercase: true, index: true }],
  description: { type: String },
  thumbnail: { type: String },
  location: { type: String, index: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Expert'], default: 'Beginner' },
  // Legacy hourly rate field for compatibility
  hourlyRate: { type: Number, min: 0, default: 0 },
  // Optional: session rates for 30/60/90 min (for future compatibility)
  sessionRates: {
    thirtyMin: { type: Number, min: 0, default: 0 },
    sixtyMin: { type: Number, min: 0, default: 0 },
    ninetyMin: { type: Number, min: 0, default: 0 }
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

skillListingSchema.index({ skillName: 1, location: 1, createdAt: 1 });

module.exports = mongoose.model('SkillListing', skillListingSchema); 