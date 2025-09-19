const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: false, // Make it not required by default
    trim: true,
    maxlength: 2000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video', 'attachment'],
    default: 'text'
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  clientMessageId: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });

// Unique compound index to prevent duplicate messages
messageSchema.index(
  { 
    sender: 1, 
    conversationId: 1, 
    content: 1, 
    createdAt: 1 
  }, 
  { 
    unique: true,
    partialFilterExpression: {
      createdAt: { $gte: new Date(Date.now() - 10000) } // Only apply uniqueness within 10 seconds
    }
  }
);

// Unique index on clientMessageId for absolute deduplication
messageSchema.index(
  { clientMessageId: 1 },
  { 
    unique: true,
    sparse: true // Allow null/undefined values
  }
);

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  if (!this.createdAt) return '';
  return this.createdAt.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
});

// Ensure virtual fields are serialized
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

// Pre-save middleware to validate content
messageSchema.pre('save', function(next) {
  // Check if we have either content or attachments
  const hasContent = this.content && this.content.trim().length > 0;
  const hasAttachments = this.attachments && this.attachments.length > 0;
  
  if (!hasContent && !hasAttachments) {
    return next(new Error('Message must have either content or attachments'));
  }
  
  // If content is empty, set a default message for attachments
  if (!hasContent && hasAttachments) {
    this.content = '📎 Attachment';
  }
  
  next();
});

// Static method to get conversation messages
messageSchema.statics.getConversationMessages = function(conversationId, userId, limit = 50, skip = 0) {
  return this.find({ 
    conversationId,
    deletedFor: { $ne: userId } // Exclude messages deleted for this user
  })
  .populate('sender', 'name photo isOnline')
  .populate('receiver', 'name photo isOnline')
  .sort({ createdAt: 1 })
  .limit(limit)
  .skip(skip)
  .lean();
};

// Static method to mark messages as read
messageSchema.statics.markAsRead = function(conversationId, userId) {
  return this.updateMany(
    {
      conversationId,
      receiver: userId,
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );
};

// Instance method to mark as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Instance method to edit message
messageSchema.methods.edit = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Instance method to delete message (soft delete)
messageSchema.methods.delete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to mark messages as deleted for a specific user
messageSchema.statics.deleteForUser = function(conversationId, userId) {
  return this.updateMany(
    {
      conversationId: conversationId,
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    },
    {
      $addToSet: { deletedFor: userId }
    }
  );
};

// Static method to generate conversation ID
messageSchema.statics.generateConversationId = function(userId1, userId2) {
  // Sort the user IDs to ensure consistent conversation ID regardless of sender/receiver
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

module.exports = mongoose.model('Message', messageSchema); 