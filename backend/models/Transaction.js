const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // For session payments, this is the host/mentor
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'fee', 'earning', 'withdrawal'],
    required: true
  },
  category: {
    type: String,
    enum: ['session_booking', 'quick_payment', 'subscription', 'credits', 'premium', 'platform_fee'],
    required: true
  },
  direction: {
    type: String,
    enum: ['debit', 'credit'], // debit = money out, credit = money in
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String // Reference number for tracking
  },
  balance: {
    before: {
      type: Number,
      default: 0
    },
    after: {
      type: Number,
      default: 0
    }
  },
  fees: {
    platformFee: {
      type: Number,
      default: 0
    },
    processingFee: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    source: String, // 'quick_payment', 'session_booking', 'stripe_webhook'
    stripePaymentIntentId: String,
    sessionTitle: String,
    skillCategory: String,
    originalAmount: Number, // Before fees
    ipAddress: String,
    userAgent: String
  },
  reconciliation: {
    isReconciled: {
      type: Boolean,
      default: false
    },
    reconciledAt: Date,
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ recipient: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ payment: 1 });
transactionSchema.index({ session: 1 });
transactionSchema.index({ type: 1, category: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });

// Virtual for transaction summary
transactionSchema.virtual('summary').get(function() {
  return {
    id: this.transactionId,
    amount: this.amount,
    direction: this.direction,
    type: this.type,
    category: this.category,
    description: this.description,
    date: this.createdAt,
    status: this.status
  };
});

// Method to format amount for display
transactionSchema.methods.getDisplayAmount = function() {
  const sign = this.direction === 'debit' ? '-' : '+';
  return `${sign}$${(this.amount / 100).toFixed(2)}`;
};

// Method to get transaction parties
transactionSchema.methods.getParties = async function() {
  await this.populate([
    { path: 'user', select: 'name email' },
    { path: 'recipient', select: 'name email' }
  ]);
  
  return {
    from: this.user,
    to: this.recipient || { name: 'SkillSwap Platform', email: 'platform@skillswap.com' }
  };
};

// Static method to create transaction from payment
transactionSchema.statics.createFromPayment = async function(paymentData, sessionData = null) {
  const { payment, user, recipient, type = 'payment' } = paymentData;
  
  // Determine direction based on user perspective
  const direction = user.toString() === payment.user.toString() ? 'debit' : 'credit';
  
  // Calculate fees (5% platform fee)
  const platformFeeRate = 0.05;
  const platformFee = Math.round(payment.amount * platformFeeRate);
  const processingFee = Math.round(payment.amount * 0.029) + 30; // Stripe fees
  const totalFees = platformFee + processingFee;
  
  const transaction = new this({
    user: user,
    recipient: recipient,
    payment: payment._id,
    session: sessionData?._id,
    type: type,
    category: payment.paymentType === 'session' ? 'session_booking' : payment.paymentType,
    direction: direction,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status === 'succeeded' ? 'completed' : payment.status,
    description: payment.description,
    reference: `REF_${payment.stripePaymentIntentId}`,
    fees: {
      platformFee: platformFee,
      processingFee: processingFee,
      total: totalFees
    },
    metadata: {
      source: payment.metadata?.source || 'unknown',
      stripePaymentIntentId: payment.stripePaymentIntentId,
      sessionTitle: sessionData?.title,
      skillCategory: sessionData?.skill,
      originalAmount: payment.amount,
      ...payment.metadata
    }
  });
  
  return await transaction.save();
};

// Pre-save middleware to generate transaction ID if not provided
transactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
