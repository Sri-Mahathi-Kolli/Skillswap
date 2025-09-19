// ADMIN: Delete all messages for all users (dangerous, use with caution)
exports.deleteAllMessages = async (req, res) => {
  try {
    await Message.deleteMany({});
    res.json({ success: true, message: 'All messages deleted for all users.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const Message = require('../models/Message');
const User = require('../models/User');

// Get all conversations for the current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.userId;
    console.log('getConversations called for userId:', userId);
    
    // Get recent conversations with last message and unread count
    const conversations = await Message.getRecentConversations(userId, 50);
    console.log('getConversations - raw conversations from DB:', conversations);
    
    // Format conversations for frontend - STRICT FILTERING
    const formattedConversations = conversations
      .map(conv => {
        // Determine which user is the "other" user (not the current user)
        const isCurrentUserSender = conv.sender._id.toString() === userId;
        const otherUser = isCurrentUserSender ? conv.receiver : conv.sender;
        
        console.log(`Conversation formatting - userId: ${userId}, sender: ${conv.sender._id}, receiver: ${conv.receiver._id}`);
        console.log(`Conversation formatting - isCurrentUserSender: ${isCurrentUserSender}, otherUser: ${otherUser.name}`);
        console.log(`Conversation formatting - otherUser ID: ${otherUser._id.toString()}`);
        
        // STRICT FILTERING: Never show current user in conversations
        if (otherUser._id.toString() === userId) {
          console.log(`❌ FILTERED OUT: Current user found in conversations - ${otherUser.name}`);
          return null;
        }
        
        // Only show conversations where the other user sent the last message
        const lastMessageFromOtherUser = conv.lastMessage.sender._id.toString() === otherUser._id.toString();
        
        if (!lastMessageFromOtherUser) {
          console.log(`❌ FILTERED OUT: Last message not from other user`);
          return null;
        }
        
        return {
          id: conv._id,
          conversationId: conv._id,
          participantId: otherUser._id.toString(),
          name: otherUser.name,
          avatar: otherUser.photo || 'assets/avatar.png',
          lastMessage: conv.lastMessage.content,
          timestamp: new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          unreadCount: conv.unreadCount,
          isOnline: otherUser.isOnline || false,
          messages: []
        };
      })
      .filter(conv => conv !== null); // Remove null entries
    
    console.log('✅ getConversations - final filtered conversations:', formattedConversations.map(c => c.name));
    res.json(formattedConversations);
  } catch (err) {
    console.error('Error getting conversations:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get messages for a specific conversation
exports.getConversationMessages = async (req, res) => {
    // Original logic before blue tick/real-time changes
    const { conversationId } = req.params;
    try {
        const messages = await Message.find({
            conversationId: conversationId,
            isDeleted: false
        })
        .sort({ createdAt: 1 })
        .populate('sender', 'name photo isOnline')
        .populate('receiver', 'name photo isOnline');

        // Format messages for frontend (original format)
        const formattedMessages = messages.map(msg => {
            const isSent = msg.sender._id.toString() === (msg.sender._id.toString());
            return {
                id: msg._id,
                text: msg.content,
                time: new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                isSent: isSent,
                senderId: msg.sender._id,
                receiverId: msg.receiver._id,
                senderName: msg.sender.name,
                senderAvatar: msg.sender.photo || 'assets/avatar.png',
                receiverName: msg.receiver.name,
                receiverAvatar: msg.receiver.photo || 'assets/avatar.png'
            };
        });
        res.json(formattedMessages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Start a new conversation
exports.startConversation = async (req, res) => {
  try {
    console.log('startConversation called with body:', req.body);
    const { participantId } = req.body;
    const userId = req.userId;
    
    console.log('startConversation - participantId:', participantId);
    console.log('startConversation - userId:', userId);
    
    if (!participantId) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }
    
    // Prevent self-messaging
    if (participantId === userId) {
      return res.status(400).json({ error: 'You cannot start a conversation with yourself' });
    }
    
    // Check if user exists
    const participant = await User.findById(participantId);
    console.log('startConversation - participant found:', participant ? participant.name : 'not found');
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Generate conversation ID
    const conversationId = Message.generateConversationId(userId, participantId);
    console.log('startConversation - generated conversationId:', conversationId);
    
    // Check if conversation already exists
    const existingConversation = await Message.findOne({ conversationId });
    console.log('startConversation - existing conversation found:', !!existingConversation);
    if (existingConversation) {
      // Return existing conversation
      const messages = await Message.getConversation(userId, participantId, 50, 0);
      const formattedMessages = messages.map(msg => ({
        id: msg._id,
        text: msg.content,
        time: new Date(msg.createdAt).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isSent: msg.sender._id.toString() === userId,
        senderId: msg.sender._id,
        receiverId: msg.receiver._id,
        senderName: msg.sender.name,
        senderAvatar: msg.sender.photo || 'assets/avatar.png',
        receiverName: msg.receiver.name,
        receiverAvatar: msg.receiver.photo || 'assets/avatar.png'
      }));
      
      return res.json({
        id: conversationId,
        conversationId,
        participantId: participant._id.toString(), // Ensure it's a string
        name: participant.name,
        avatar: participant.photo || 'assets/avatar.png',
        lastMessage: '',
        timestamp: '',
        unreadCount: 0,
        isOnline: participant.isOnline || false,
        messages: formattedMessages
      });
    }
    
    // Create new conversation
    const newConversation = {
      id: conversationId,
      conversationId: conversationId, // Ensure this is the actual conversation ID
      participantId: participant._id.toString(), // Ensure it's a string
      name: participant.name,
      avatar: participant.photo || 'assets/avatar.png',
      lastMessage: '',
      timestamp: '',
      unreadCount: 0,
      isOnline: participant.isOnline || false,
      messages: []
    };
    
    console.log('startConversation - sending new conversation:', newConversation);
    res.status(201).json(newConversation);
  } catch (err) {
    console.error('Error starting conversation:', err);
    res.status(500).json({ error: err.message });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.userId;
    
    if (!receiverId || !text) {
      return res.status(400).json({ error: 'Receiver ID and message text are required' });
    }
    
    // Prevent self-messaging
    if (receiverId === senderId) {
      return res.status(400).json({ error: 'You cannot send messages to yourself' });
    }
    
    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }
    
    // Create new message
    const conversationId = Message.generateConversationId(senderId, receiverId);
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content: text,
      messageType: 'text',
      conversationId: conversationId
    });
    
    await message.save();
    console.log('[DEBUG] Message saved:', message);
    
    // Populate sender and receiver details
    await message.populate('sender', 'name photo isOnline');
    await message.populate('receiver', 'name photo isOnline');
    console.log('[DEBUG] Message after populate:', message);
    
    // Format message for response
    const formattedMessage = {
      id: message._id,
      text: message.content,
      time: new Date(message.createdAt).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isSent: true,
      senderId: message.sender._id,
      receiverId: message.receiver._id,
      conversationId: message.conversationId,
      senderName: message.sender.name,
      senderAvatar: message.sender.photo || 'assets/avatar.png',
      receiverName: message.receiver.name,
      receiverAvatar: message.receiver.photo || 'assets/avatar.png'
    };
    
    // Emit Socket.IO event to notify other users
    const socketService = req.app.get('socketService');
    if (socketService) {
      console.log('Emitting new_message event for conversation:', conversationId);
      socketService.io.to(conversationId).emit('new_message', {
        message: {
          id: message._id,
          content: message.content,
          messageType: 'text',
          sender: {
            id: message.sender._id,
            name: message.sender.name,
            photo: message.sender.photo,
            isOnline: message.sender.isOnline
          },
          receiver: message.receiver._id,
          conversationId: message.conversationId,
          isRead: false,
          createdAt: message.createdAt
        }
      });
    }
    
    res.status(201).json(formattedMessage);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: err.message });
  }
};

// Send message with attachments
exports.sendMessageWithAttachments = async (req, res) => {
  try {
    console.log('sendMessageWithAttachments called with body:', req.body);
    console.log('sendMessageWithAttachments files:', req.files);
    console.log('sendMessageWithAttachments userId:', req.userId);
    
    const { receiverId, text, conversationId } = req.body;
    const senderId = req.userId;
    const files = req.files || [];
    
    console.log('sendMessageWithAttachments - receiverId:', receiverId);
    console.log('sendMessageWithAttachments - text:', text);
    console.log('sendMessageWithAttachments - conversationId:', conversationId);
    console.log('sendMessageWithAttachments - files count:', files.length);
    
    if (!receiverId) {
      console.log('sendMessageWithAttachments - receiverId missing');
      return res.status(400).json({ error: 'Receiver ID is required' });
    }
    
    // Prevent self-messaging
    if (receiverId === senderId) {
      console.log('sendMessageWithAttachments - self-messaging attempt');
      return res.status(400).json({ error: 'You cannot send messages to yourself' });
    }
    
    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    console.log('sendMessageWithAttachments - receiver found:', receiver ? receiver.name : 'not found');
    if (!receiver) {
      console.log('sendMessageWithAttachments - receiver not found');
      return res.status(404).json({ error: 'Receiver not found' });
      console.log('[DEBUG] getConversationMessages - userId:', userId, 'conversationId:', conversationId);
    }
    
    // Process attachments with error handling
    const attachments = [];
    try {
      for (const file of files) {
        console.log('Processing file:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          filename: file.filename
        });
        
        attachments.push({
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
          url: `/api/files/${file.filename}`,
          filename: file.filename,
          originalName: file.originalname
        });
      }
    } catch (fileError) {
      console.error('Error processing files:', fileError);
      return res.status(500).json({ error: 'Error processing uploaded files' });
    }
    
    console.log('sendMessageWithAttachments - processed attachments:', attachments);
    
    // Create new message
    const messageConversationId = conversationId || Message.generateConversationId(senderId, receiverId);
    console.log('sendMessageWithAttachments - conversationId:', messageConversationId);
    
    // Set default content if empty but attachments exist
    const messageContent = text || (attachments.length > 0 ? `Sent ${attachments.length} attachment(s)` : '');
    
    const messageData = {
      sender: senderId,
      receiver: receiverId,
      conversationId: messageConversationId,
      messageType: attachments.length > 0 ? 'attachment' : 'text',
      attachments: attachments
    };
    
    // Only add content if it's not empty or if there are no attachments
    if (messageContent.trim() || attachments.length === 0) {
      messageData.content = messageContent;
    }
    
    const message = new Message(messageData);
    
    console.log('sendMessageWithAttachments - message object created:', {
      sender: message.sender,
      receiver: message.receiver,
      content: message.content,
      messageType: message.messageType,
      conversationId: message.conversationId,
      attachmentsCount: message.attachments.length
    });
    
    await message.save();
    console.log('sendMessageWithAttachments - message saved successfully');
    
    // Populate sender and receiver details
    await message.populate('sender', 'name photo isOnline');
    await message.populate('receiver', 'name photo isOnline');
    
    // Format message for response
    const formattedMessage = {
      id: message._id,
      text: message.content,
      time: new Date(message.createdAt).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isSent: true,
      senderId: message.sender._id,
      receiverId: message.receiver._id,
      conversationId: message.conversationId,
      senderName: message.sender.name,
      senderAvatar: message.sender.photo || 'assets/avatar.png',
      receiverName: message.receiver.name,
      receiverAvatar: message.receiver.photo || 'assets/avatar.png',
      attachments: attachments
    };
    
    console.log('sendMessageWithAttachments - sending response:', formattedMessage);
    
    // Emit Socket.IO event to notify other users
    const socketService = req.app.get('socketService');
    if (socketService) {
      console.log('Emitting new_message event for conversation with attachments:', messageConversationId);
      socketService.io.to(messageConversationId).emit('new_message', {
        message: {
          id: message._id,
          content: message.content,
          messageType: message.messageType,
          attachments: attachments,
          sender: {
            id: message.sender._id,
            name: message.sender.name,
            photo: message.sender.photo,
            isOnline: message.sender.isOnline
          },
          receiver: message.receiver._id,
          conversationId: message.conversationId,
          isRead: false,
          createdAt: message.createdAt
        }
      });
    }
    
    res.status(201).json(formattedMessage);
    
  } catch (err) {
    console.error('Error in sendMessageWithAttachments:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Internal server error while sending message with attachments',
      details: err.message 
    });
  }
};

// Mark conversation as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;
    
    await Message.markConversationAsRead(userId, conversationId);
    
    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete all conversations for the current user
exports.deleteAllConversations = async (req, res) => {
  try {
    const userId = req.userId;
    console.log('deleteAllConversations called for userId:', userId);
    
    // Delete all messages where the user is either sender or receiver
    const result = await Message.deleteMany({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    });
    
    console.log('deleteAllConversations - deleted messages:', result.deletedCount);
    
    // Also clear any cached conversations
    console.log('deleteAllConversations - clearing conversation cache');
    
    res.json({ 
      success: true,
      message: 'All conversations deleted successfully',
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Error deleting all conversations:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete selected conversations
exports.deleteSelectedConversations = async (req, res) => {
  try {
    const { chatIds } = req.body;
    const userId = req.userId;
    
    if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
      return res.status(400).json({ error: 'Chat IDs array is required' });
    }
    
    console.log('deleteSelectedConversations called for userId:', userId, 'chatIds:', chatIds);
    
    // Delete messages for selected conversations
    const result = await Message.deleteMany({
      $or: [
        { sender: userId, conversationId: { $in: chatIds } },
        { receiver: userId, conversationId: { $in: chatIds } }
      ]
    });
    
    console.log('deleteSelectedConversations - deleted messages:', result.deletedCount);
    
    res.json({ 
      success: true,
      message: 'Selected conversations deleted successfully',
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Error deleting selected conversations:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete selected conversations and users
exports.deleteSelectedConversationsAndUsers = async (req, res) => {
  try {
    const { chatIds } = req.body;
    const userId = req.userId;
    
    if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
      return res.status(400).json({ error: 'Chat IDs array is required' });
    }
    
    console.log('deleteSelectedConversationsAndUsers called for userId:', userId, 'chatIds:', chatIds);
    
    // Delete messages for selected conversations
    const messageResult = await Message.deleteMany({
      $or: [
        { sender: userId, conversationId: { $in: chatIds } },
        { receiver: userId, conversationId: { $in: chatIds } }
      ]
    });
    
    console.log('deleteSelectedConversationsAndUsers - deleted messages:', messageResult.deletedCount);
    
    // Note: In a real application, you might want to also remove connections or relationships
    // between users, but for now we're just deleting the messages
    
    res.json({ 
      success: true,
      message: 'Selected conversations and user relationships deleted successfully',
      deletedMessagesCount: messageResult.deletedCount 
    });
  } catch (err) {
    console.error('Error deleting selected conversations and users:', err);
    res.status(500).json({ error: err.message });
  }
}; 