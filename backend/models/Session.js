const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  skill: {
    type: String,
    required: true,
    lowercase: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    role: {
      type: String,
      enum: ['learner', 'mentor', 'observer'],
      default: 'learner'
    },
    joinedAt: Date,
    leftAt: Date,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String
  }],
  maxParticipants: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 15,
    max: 480 // 8 hours max
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  meetingStatus: {
    type: String,
    enum: ['not-started', 'live', 'ended'],
    default: 'not-started'
  },
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date
  },
  hostJoinedAt: {
    type: Date
  },
  sessionType: {
    type: String,
    enum: ['one-on-one', 'group', 'workshop'],
    default: 'one-on-one'
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  stripePaymentIntentId: String,
  zoomMeeting: {
    meetingId: String,
    joinUrl: String,
    startUrl: String,
    password: String
  },
  materials: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['document', 'video', 'link', 'file']
    }
  }],
  notes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  attendeeEmails: [String], // Store extracted attendee emails from Zoom invitations
  originalInvitationHost: String, // Store original host name from invitation
  userRole: {
    type: String,
    enum: ['host', 'attendee'],
    default: 'host'
  }, // Track user's actual role in the meeting
  displayHostName: String, // Host name for display purposes
  category: {
    type: String,
    enum: ['technology', 'design', 'business', 'creative', 'health', 'education', 'other'],
    default: 'other'
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  recordingUrl: String,
  chatHistory: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  analytics: {
    totalParticipants: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'push', 'sms']
    },
    sentAt: Date,
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
sessionSchema.index({ host: 1 });
sessionSchema.index({ 'participants.user': 1 });
sessionSchema.index({ skill: 1 });
sessionSchema.index({ startTime: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ category: 1 });
sessionSchema.index({ isPremium: 1 });
sessionSchema.index({ paymentStatus: 1 });
sessionSchema.index({ startTime: 1, status: 1 });

// Virtual for checking if session is full
sessionSchema.virtual('isFull').get(function() {
  return this.participants.length >= this.maxParticipants;
});

// Virtual for checking if session is in the past
sessionSchema.virtual('isPast').get(function() {
  return new Date() > this.endTime;
});

// Virtual for checking if session is starting soon (within 15 minutes)
sessionSchema.virtual('isStartingSoon').get(function() {
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
  return this.startTime <= fifteenMinutesFromNow && this.startTime > now;
});

// Pre-save middleware
sessionSchema.pre('save', function(next) {
  // Calculate duration if not provided
  if (!this.duration && this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  
  // Validate time constraints
  if (this.startTime >= this.endTime) {
    return next(new Error('Start time must be before end time'));
  }
  
  next();
});

// Instance methods
sessionSchema.methods.addParticipant = function(userId, role = 'learner') {
  if (this.isFull) {
    throw new Error('Session is full');
  }
  
  const existingParticipant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  );
  
  if (existingParticipant) {
    throw new Error('User is already a participant');
  }
  
  this.participants.push({
    user: userId,
    role,
    joinedAt: new Date()
  });
  
  return this.save();
};

sessionSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(p => 
    p.user.toString() === userId.toString()
  );
  
  if (participantIndex === -1) {
    throw new Error('User is not a participant');
  }
  
  this.participants[participantIndex].leftAt = new Date();
  return this.save();
};

sessionSchema.methods.addRating = function(userId, rating, feedback = '') {
  const participant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('User is not a participant');
  }
  
  if (participant.rating) {
    throw new Error('User has already rated this session');
  }
  
  participant.rating = rating;
  participant.feedback = feedback;
  
  // Update analytics
  this.analytics.totalRatings += 1;
  const totalRating = this.participants
    .filter(p => p.rating)
    .reduce((sum, p) => sum + p.rating, 0);
  this.analytics.averageRating = totalRating / this.analytics.totalRatings;
  
  return this.save();
};

sessionSchema.methods.startSession = function() {
  if (this.status !== 'scheduled') {
    throw new Error('Session cannot be started');
  }
  
  this.status = 'in-progress';
  this.analytics.totalParticipants = this.participants.length;
  
  return this.save();
};

sessionSchema.methods.completeSession = function() {
  if (this.status !== 'in-progress') {
    throw new Error('Session is not in progress');
  }
  
  this.status = 'completed';
  
  return this.save();
};

sessionSchema.methods.cancelSession = function(userId, reason = '') {
  if (this.status === 'completed' || this.status === 'cancelled') {
    throw new Error('Session cannot be cancelled');
  }
  
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  
  return this.save();
};

// Static methods
sessionSchema.statics.findUpcoming = function(userId, limit = 10) {
  return this.find({
    $or: [
      { host: userId },
      { 'participants.user': userId }
    ],
    startTime: { $gt: new Date() },
    status: { $in: ['scheduled', 'in-progress'] }
  })
  .sort({ startTime: 1 })
  .limit(limit)
  .populate('host', 'name photo')
  .populate('participants.user', 'name photo');
};

sessionSchema.statics.findBySkill = function(skillName, limit = 20) {
  return this.find({
    skill: skillName.toLowerCase(),
    startTime: { $gt: new Date() },
    status: 'scheduled'
  })
  .sort({ startTime: 1 })
  .limit(limit)
  .populate('host', 'name photo averageRating');
};

sessionSchema.statics.findTrending = function(limit = 10) {
  return this.aggregate([
    {
      $match: {
        status: 'completed',
        'analytics.totalRatings': { $gte: 1 }
      }
    },
    {
      $group: {
        _id: '$skill',
        totalSessions: { $sum: 1 },
        averageRating: { $avg: '$analytics.averageRating' },
        totalParticipants: { $sum: '$analytics.totalParticipants' }
      }
    },
    {
      $sort: { totalSessions: -1, averageRating: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

module.exports = mongoose.model('Session', sessionSchema); 