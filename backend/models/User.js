const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  photo: {
    type: String,
    default: ''
  },
  photoMimeType: {
    type: String,
    default: 'image/png'
  },
  location: {
    type: String,
    default: ''
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  availability: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    slots: [{
      start: String, // HH:MM format
      end: String    // HH:MM format
    }]
  }],
  // Enhanced availability for Scheduling Assistant
  customAvailability: [{
    date: {
      type: Date,
      required: true
    },
    slots: [{
      start: {
        type: Date,
        required: true
      },
      end: {
        type: Date,
        required: true
      },
      status: {
        type: String,
        enum: ['free', 'busy', 'tentative', 'out-of-office', 'unavailable'],
        default: 'free'
      },
      title: String,
      description: String
    }]
  }],
  // External calendar integration
  externalCalendars: [{
    provider: {
      type: String,
      enum: ['google', 'outlook', 'apple'],
      required: true
    },
    accessToken: String,
    refreshToken: String,
    tokenExpiry: Date,
    calendarId: String,
    isActive: {
      type: Boolean,
      default: true
    },
    lastSync: Date
  }],
  // Scheduling preferences
  schedulingPreferences: {
    defaultDuration: {
      type: Number,
      default: 30, // minutes
      min: 15,
      max: 480
    },
    bufferTime: {
      type: Number,
      default: 0, // minutes
      min: 0,
      max: 60
    },
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    workingDays: {
      type: [String],
      default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }
  },
  skills: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Ensure each skill has an _id
    name: {
      type: String,
      required: true
    },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Expert'],
      default: 'Beginner'
    },
    description: String,
    tags: [String],
    thumbnail: String,
    isOffering: {
      type: Boolean,
      default: false
    },
    isSeeking: {
      type: Boolean,
      default: false
    },
    hourlyRate: {
      type: Number,
      min: 0
    },
    sessionsCompleted: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    }
  }],
  badges: [{
    type: {
      type: String,
      enum: ['skill_master', 'helpful_mentor', 'quick_learner', 'community_builder', 'expert_teacher']
    },
    skill: String,
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reviews: [{
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    skill: String,
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  sessionsCompleted: {
    type: Number,
    default: 0
  },
  sessionsHosted: {
    type: Number,
    default: 0
  },
  credits: {
    type: Number,
    default: 0
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  stripeCustomerId: String,
  zoomAccessToken: String,
  zoomRefreshToken: String,
  zoomTokenExpiry: Date,
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  // Notification system for booking alerts
  notifications: [{
    type: {
      type: String,
      enum: ['new_session_booking', 'connection_request', 'session_reminder', 'payment_received'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  title: {
    type: String,
    default: ''
  },
  about: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  website: {
    type: String,
    default: ''
  },
  connectionRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  paymentSettings: {
    enablePayments: {
      type: Boolean,
      default: false
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true
    },
    freeSessionsOffered: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentRequired: {
      type: Boolean,
      default: false
    },
    stripeAccountId: String, // For future Connect integration
    paymentSettings: {
      stripeEnabled: {
        type: Boolean,
        default: false
      },
      pricing: {
        thirtyMin: {
          type: Number,
          default: 0,
          min: 0
        },
        sixtyMin: {
          type: Number,
          default: 0,
          min: 0
        },
        ninetyMin: {
          type: Number,
          default: 0,
          min: 0
        }
      },
      currency: {
        type: String,
        default: 'USD',
        uppercase: true
      }
    }
  },
  customPricing: [
    {
      duration: { type: Number, min: 1 },
      amount: { type: Number, min: 0 }
    }
  ]
}, {
  timestamps: true
});

// Indexes for efficient queries
// Note: email index is automatically created by unique: true constraint
userSchema.index({ 'skills.name': 1 });
userSchema.index({ 'skills.level': 1 });
userSchema.index({ location: 1 });
userSchema.index({ averageRating: -1 });
userSchema.index({ sessionsCompleted: -1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ referralCode: 1 });
// Note: Removed the problematic unique index on connectionRequests that was causing duplicate key errors

// Generate referral code
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

// Update average rating when reviews change
userSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = totalRating / this.reviews.length;
    this.totalReviews = this.reviews.length;
  }
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.addSkill = function(skillData) {
  const existingSkillIndex = this.skills.findIndex(skill => 
    skill.name.toLowerCase() === skillData.name.toLowerCase()
  );
  
  if (existingSkillIndex >= 0) {
    this.skills[existingSkillIndex] = { ...this.skills[existingSkillIndex], ...skillData };
  } else {
    this.skills.push(skillData);
  }
  
  return this.save();
};

userSchema.methods.addReview = function(reviewData) {
  // Check if user already reviewed this skill
  const existingReview = this.reviews.find(review => 
    review.reviewer.toString() === reviewData.reviewer.toString() && 
    review.skill === reviewData.skill
  );
  
  if (existingReview) {
    throw new Error('You have already reviewed this skill');
  }
  
  this.reviews.push(reviewData);
  return this.save();
};

userSchema.methods.addBadge = function(badgeType, skill = null) {
  const existingBadge = this.badges.find(badge => 
    badge.type === badgeType && badge.skill === skill
  );
  
  if (!existingBadge) {
    this.badges.push({ type: badgeType, skill });
  }
  
  return this.save();
};

// Static methods
userSchema.statics.findBySkill = function(skillName, level = null) {
  const query = { 'skills.name': skillName.toLowerCase() };
  if (level) {
    query['skills.level'] = level;
  }
  return this.find(query);
};

userSchema.statics.findExperts = function(skillName, limit = 10) {
  return this.find({
    'skills.name': skillName.toLowerCase(),
    'skills.level': { $in: ['pro', 'expert'] },
    'skills.isOffering': true
  })
  .sort({ 'skills.averageRating': -1, sessionsCompleted: -1 })
  .limit(limit);
};

module.exports = mongoose.model('User', userSchema); 