
const mongoose = require('mongoose');


const paymentSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'completed',
    required: true
  },
  mentorName: {
    type: String,
    required: false
  },
  mentorEmail: {
    type: String,
    required: false
  },
  userName: {
    type: String,
    required: false
  },
  userEmail: {
    type: String,
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 30
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true
  },
  description: {
    type: String,
  },
  stripeSessionId: {
    type: String,
    unique: true,
    sparse: true
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  metadata: {
    sessionType: {
      type: String,
      default: 'mentoring'
    },
    notes: String,
    originalAmount: Number
  }
}, {
  timestamps: true
});

// Index for efficient queries
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ mentorId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ stripeSessionId: 1 });


// Virtual for mentor details (must be after schema definition)
paymentSchema.virtual('mentorDetails', {
  ref: 'User',
  localField: 'mentorId',
  foreignField: '_id',
  justOne: true
});

paymentSchema.set('toObject', { virtuals: true });
paymentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Payment', paymentSchema);
