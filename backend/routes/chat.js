const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

// Create a new conversation
router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const { participants } = req.body;
    if (!participants || !Array.isArray(participants) || participants.length !== 2) {
      return res.status(400).json({ error: 'Exactly two participant IDs are required.' });
    }
    // Prevent self-messaging
    if (participants[0] === participants[1]) {
      return res.status(400).json({ error: 'Cannot create conversation with self.' });
    }
    // Generate conversation ID (sorted for consistency)
    const sortedIds = [...participants].sort();
    const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;
    // Check if conversation already exists
    const existingMessage = await Message.findOne({ conversationId });
    if (existingMessage) {
      return res.json({ id: conversationId, participants: sortedIds });
    }
    // No need to create a DB entry, just return the ID (messages will create it)
    return res.json({ id: conversationId, participants: sortedIds });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get all conversations for the current user
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    
    // Find all messages where user is sender or receiver (excluding deleted ones)
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ],
      $or: [
        { isDeleted: false },
        { 
          isDeleted: true, 
          deletedFor: { $ne: userId } 
        }
      ]
    }).populate('sender', 'name photo isOnline')
      .populate('receiver', 'name photo isOnline')
      .sort({ createdAt: -1 });

    // Group messages by conversation
    const conversations = new Map();
    
    messages.forEach(message => {
      const otherUserId = message.sender._id.toString() === userId ? 
        message.receiver._id.toString() : message.sender._id.toString();
      
      if (!conversations.has(otherUserId)) {
        conversations.set(otherUserId, {
          id: otherUserId,
          participant: message.sender._id.toString() === userId ? message.receiver : message.sender,
          lastMessage: message,
          unreadCount: 0
        });
      }
    });

    const conversationsList = Array.from(conversations.values());
    
    res.json(conversationsList);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a specific conversation
router.get('/messages/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId || req.user._id;
    
    console.log('📨 Fetching messages for conversation:', conversationId);
    console.log('📨 Current user ID:', userId);
    
    // Parse conversation ID to get participant IDs
    const [userId1, userId2] = conversationId.split('_');
    
    console.log('📨 Conversation ID:', conversationId);
    console.log('📨 Conversation participants:', { userId1, userId2 });
    console.log('📨 Current user ID (string):', userId.toString());
    console.log('📨 Current user ID (ObjectId):', userId);
    console.log('📨 Comparison results:', {
      'userId.toString() === userId1': userId.toString() === userId1,
      'userId.toString() === userId2': userId.toString() === userId2,
      'userId1Type': typeof userId1,
      'userId2Type': typeof userId2,
      'userIdToStringType': typeof userId.toString()
    });
    
    // Verify user is part of this conversation (convert to strings for comparison)
    const currentUserIdString = userId.toString();
    if (currentUserIdString !== userId1 && currentUserIdString !== userId2) {
      console.log('❌ Access denied - User not part of conversation');
      console.log('❌ Debug values:', {
        currentUserIdString,
        userId1,
        userId2,
        'currentUserIdString === userId1': currentUserIdString === userId1,
        'currentUserIdString === userId2': currentUserIdString === userId2
      });
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    const messages = await Message.getConversationMessages(conversationId, userId);
      
    console.log('✅ Found messages:', messages.length);
    console.log('📨 Messages:', messages.map(m => ({ id: m._id, content: m.content, sender: m.sender?.name })));

    // Mark messages as read
    await Message.updateMany(
      {
        conversationId: conversationId,
        receiver: userId,
        isRead: false
      },
      { isRead: true }
    );

    // Format messages for frontend (matching ChatMessage interface)
    const formattedMessages = messages.map(message => ({
      id: message._id.toString(),
      content: message.content,
      sender: {
        id: message.sender._id.toString(),
        name: message.sender.name,
        photo: message.sender.photo
      },
      receiver: message.receiver._id.toString(), // Just the ID as string
      conversationId: message.conversationId,
      timestamp: message.createdAt,
      isRead: message.isRead,
      messageType: message.messageType,
      attachments: message.attachments
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new message
router.post('/messages', requireAuth, async (req, res) => {
  try {
    const { conversationId, content, messageType = 'text', clientMessageId, attachments } = req.body;
    const senderId = req.userId || req.user._id;
    
    console.log('📨 Received message request:', {
      conversationId,
      content,
      messageType,
      senderId,
      clientMessageId,
      hasAttachments: !!attachments,
      attachmentsCount: attachments ? attachments.length : 0,
      attachments: attachments
    });
    
    // Parse conversation ID to get receiver ID
    const [userId1, userId2] = conversationId.split('_');
    const receiverId = senderId.toString() === userId1 ? userId2 : userId1;
    
    console.log('📨 Parsed conversation participants:', {
      userId1,
      userId2,
      senderId,
      receiverId
    });
    
    // NUCLEAR DEDUPLICATION: Check for duplicate messages with multiple criteria
    const tenSecondsAgo = new Date(Date.now() - 10000);
    
    // Check by client message ID first (most reliable)
    if (clientMessageId) {
      const existingByClientId = await Message.findOne({
        clientMessageId: clientMessageId
      });
      
      if (existingByClientId) {
        console.log('🚫 NUCLEAR: Duplicate detected by client message ID:', clientMessageId);
        await existingByClientId.populate('sender', 'name photo isOnline');
        await existingByClientId.populate('receiver', 'name photo isOnline');
        
        const formattedMessage = {
          id: existingByClientId._id.toString(),
          content: existingByClientId.content,
          sender: {
            id: existingByClientId.sender._id.toString(),
            name: existingByClientId.sender.name,
            photo: existingByClientId.sender.photo
          },
          receiver: existingByClientId.receiver._id.toString(),
          conversationId: existingByClientId.conversationId,
          timestamp: existingByClientId.createdAt,
          isRead: existingByClientId.isRead,
          messageType: existingByClientId.messageType,
          attachments: existingByClientId.attachments
        };
        
        return res.json(formattedMessage);
      }
    }
    
    // Check by content, sender, conversation within 10 seconds
    const existingMessage = await Message.findOne({
      sender: senderId,
      conversationId: conversationId,
      content: content,
      createdAt: { $gte: tenSecondsAgo }
    });
    
    if (existingMessage) {
      console.log('🚫 NUCLEAR: Duplicate detected by content/sender/timestamp');
      await existingMessage.populate('sender', 'name photo isOnline');
      await existingByClientId.populate('receiver', 'name photo isOnline');
      
      const formattedMessage = {
        id: existingMessage._id.toString(),
        content: existingMessage.content,
        sender: {
          id: existingMessage.sender._id.toString(),
          name: existingMessage.sender.name,
          photo: existingMessage.sender.photo
        },
        receiver: existingMessage.receiver._id.toString(),
        conversationId: existingMessage.conversationId,
        timestamp: existingMessage.createdAt,
        isRead: existingMessage.isRead,
        messageType: existingMessage.messageType,
        attachments: existingMessage.attachments
      };
      
      return res.json(formattedMessage);
    }
    
    console.log('📨 Creating message with attachments:', attachments);
    
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      conversationId,
      content,
      messageType,
      isRead: false,
      clientMessageId, // Store client message ID for deduplication
      attachments: attachments || [] // Include attachments
    });

    console.log('📨 Created message object:', message);
    console.log('📨 Message attachments before save:', message.attachments);
    console.log('📨 Message object keys:', Object.keys(message.toObject()));
    
    try {
      await message.save();
      console.log('✅ Message saved to database with ID:', message._id);
      console.log('✅ Message attachments after save:', message.attachments);
    } catch (saveError) {
      // Handle duplicate key errors
      if (saveError.code === 11000) {
        console.log('🚫 NUCLEAR: Duplicate key error detected, finding existing message');
        
        // Find the existing message that caused the duplicate key error
        let existingMessage;
        if (clientMessageId) {
          existingMessage = await Message.findOne({ clientMessageId: clientMessageId });
        } else {
          existingMessage = await Message.findOne({
            sender: senderId,
            conversationId: conversationId,
            content: content,
            createdAt: { $gte: tenSecondsAgo }
          });
        }
        
        if (existingMessage) {
          console.log('✅ Found existing message, returning it instead');
          await existingMessage.populate('sender', 'name photo isOnline');
          await existingMessage.populate('receiver', 'name photo isOnline');
          
          const formattedMessage = {
            id: existingMessage._id.toString(),
            content: existingMessage.content,
            sender: {
              id: existingMessage.sender._id.toString(),
              name: existingMessage.sender.name,
              photo: existingMessage.sender.photo
            },
            receiver: existingMessage.receiver._id.toString(),
            conversationId: existingMessage.conversationId,
            timestamp: existingMessage.createdAt,
            isRead: existingMessage.isRead,
            messageType: existingMessage.messageType,
            attachments: existingMessage.attachments
          };
          
          return res.json(formattedMessage);
        }
      }
      
      // Re-throw the error if it's not a duplicate key error
      throw saveError;
    }
    
    await message.populate('sender', 'name photo isOnline');
    await message.populate('receiver', 'name photo isOnline');
    
    console.log('✅ Message populated and ready to send:', message);

    // Format message for frontend (matching ChatMessage interface)
    const formattedMessage = {
      id: message._id.toString(),
      content: message.content,
      sender: {
        id: message.sender._id.toString(),
        name: message.sender.name,
        photo: message.sender.photo
      },
      receiver: message.receiver._id.toString(), // Just the ID as string
      conversationId: message.conversationId,
      timestamp: message.createdAt,
      isRead: message.isRead,
      messageType: message.messageType,
      attachments: message.attachments
    };

    console.log('✅ Sending formatted message:', formattedMessage);
    console.log('✅ Formatted message attachments:', formattedMessage.attachments);
    
    // Emit the message via socket for real-time delivery
    try {
      const socketService = req.app.get('socketService');
      if (socketService) {
        const socketPayload = { message: formattedMessage };
        console.log('📡 Socket payload being emitted:', socketPayload);
        socketService.io.to(conversationId).emit('new_message', socketPayload);
        // Also emit directly to the receiver's personal room for real-time notification
        socketService.io.to(formattedMessage.receiver).emit('new_message', socketPayload);
        console.log('📡 Message emitted via socket to conversation:', conversationId);
      }
    } catch (socketError) {
      console.warn('⚠️ Could not emit message via socket:', socketError.message);
    }
    
    res.json(formattedMessage);
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark conversation as read
router.put('/conversations/:conversationId/read', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId || req.user._id;
    
    const [userId1, userId2] = conversationId.split('_');
    
    await Message.updateMany(
      {
        conversationId: conversationId,
        receiver: userId,
        isRead: false
      },
      { isRead: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

// Clear conversation (mark messages as deleted for current user only)
router.delete('/conversations/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId || req.user._id;
    const { clearForAll = false } = req.query; // Optional query parameter
    
    // Parse conversation ID to get participant IDs
    const [userId1, userId2] = conversationId.split('_');
    
    // Verify user is part of this conversation (convert to strings for comparison)
    if (userId.toString() !== userId1 && userId.toString() !== userId2) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    let result;
    let message;
    
    if (clearForAll === 'true') {
      // Clear for all users (admin functionality)
      result = await Message.deleteMany({
        conversationId: conversationId
      });
      message = 'Conversation cleared for all users';
      console.log(`🗑️ Deleted ${result.deletedCount} messages from conversation ${conversationId} for all users`);
    } else {
      // Mark messages as deleted for this user only (not for the other user)
      result = await Message.deleteForUser(conversationId, userId);
      message = 'Conversation cleared successfully for you only';
      console.log(`🗑️ Marked messages as deleted for user ${userId} in conversation ${conversationId}`);
      console.log(`🗑️ Modified ${result.modifiedCount} messages`);
    }
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount || result.deletedCount,
      message: message
    });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    res.status(500).json({ error: 'Failed to clear conversation' });
  }
});

// ADMIN: Delete all messages for all users (dangerous, use with caution)
router.delete('/messages', async (req, res) => {
  try {
    await Message.deleteMany({});
    res.json({ success: true, message: 'All messages deleted for all users.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;