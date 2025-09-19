const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  message: {
    type: String,
    maxlength: 500,
    default: ''
  },
  skillContext: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  rejectedAt: Date,
  withdrawnAt: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
connectionSchema.index({ requester: 1, recipient: 1 });
connectionSchema.index({ recipient: 1, status: 1 });
connectionSchema.index({ requester: 1, status: 1 });
connectionSchema.index({ status: 1, createdAt: -1 });

// Prevent duplicate connection requests
connectionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingConnection = await this.constructor.findOne({
      $or: [
        { requester: this.requester, recipient: this.recipient },
        { requester: this.recipient, recipient: this.requester }
      ]
    });
    
    // Allow "Connect Back" requests even if connection exists
    if (existingConnection && this.skillContext !== 'Connect Back') {
      return next(new Error('Connection request already exists'));
    }
  }
  next();
});

// Update timestamps when status changes
connectionSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.updatedAt = new Date();
    
    if (this.status === 'accepted') {
      this.acceptedAt = new Date();
    } else if (this.status === 'rejected') {
      this.rejectedAt = new Date();
    } else if (this.status === 'withdrawn') {
      this.withdrawnAt = new Date();
    }
  }
  next();
});

// Static method to check if users are connected
connectionSchema.statics.areConnected = async function(userId1, userId2) {
  const connection = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' }
    ]
  });
  return !!connection;
};

// Static method to get connection status between users
connectionSchema.statics.getConnectionStatus = async function(userId1, userId2) {
  const connection = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 }
    ]
  });
  
  if (!connection) {
    return null;
  }
  
  // Determine userRole for userId1
  let userRole = null;
  if (connection.requester.toString() === userId1.toString()) {
    userRole = 'requester';
  } else if (connection.recipient.toString() === userId1.toString()) {
    userRole = 'recipient';
  }
  
  return {
    status: connection.status,
    userRole: userRole,
    connection: connection
  };
};

// Instance method to accept connection
connectionSchema.methods.accept = function() {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  return this.save();
};

// Instance method to reject connection
connectionSchema.methods.reject = function() {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  return this.save();
};

// Instance method to withdraw connection request
connectionSchema.methods.withdraw = function() {
  this.status = 'withdrawn';
  this.withdrawnAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Connection', connectionSchema); 