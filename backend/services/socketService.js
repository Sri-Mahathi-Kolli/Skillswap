const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

class SocketService {
  constructor(server) {

    
    this.io = socketIO(server, {
      cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000, // 60 seconds
      pingInterval: 25000  // 25 seconds
    });

    this.connectedUsers = new Map(); // userId -> socket
    this.userConversations = new Map(); // userId -> Set of conversationIds
    this.userHeartbeats = new Map(); // userId -> last heartbeat timestamp
    this.heartbeatInterval = null;

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHeartbeatMonitoring();
   

  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_make_it_long_and_random';
        const decoded = jwt.verify(token, jwtSecret);
        
        const user = await User.findById(decoded.userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        // Update user online status
        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();

        socket.userId = user._id;
        socket.user = {

          id: user._id,
          name: user.name,
          email: user.email,
          photo: user.photo,
          isOnline: user.isOnline
        };

        // User is now connected and authenticated

        // Add user to their own room for receiving user-specific events
        socket.join(socket.userId.toString());
        console.log(`[Socket] User ${socket.userId} joined their own room for direct events.`);

        
        // Add to connected users
        this.connectedUsers.set(socket.userId.toString(), {
          socketId: socket.id,
          userId: socket.userId,
          name: socket.user.name,
          connectedAt: new Date()
        });

        // Initialize heartbeat for this user
        this.userHeartbeats.set(socket.userId.toString(), new Date());

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      // Always join user to their own room (id as string) on every connection
      if (!socket.rooms.has(socket.userId.toString())) {
        socket.join(socket.userId.toString());
        console.log(`[BlueTick] [Connection] Socket ${socket.id} joined its own room ${socket.userId}`);
      } else {
        console.log(`[BlueTick] [Connection] Socket ${socket.id} already in its own room ${socket.userId}`);
      }

      // Store connected user
      this.connectedUsers.set(socket.userId.toString(), {
        socketId: socket.id,
        userId: socket.userId,
        name: socket.user.name,
        connectedAt: new Date()
      });
      this.userConversations.set(socket.userId.toString(), new Set());

      // Initialize heartbeat for this user
      this.userHeartbeats.set(socket.userId.toString(), new Date());

      // Broadcast user online status to all users
      this.io.emit('user_online', {
        userId: socket.userId,
        isOnline: true,
        lastSeen: new Date()
      });
      console.log(`👤 Broadcasting user online: ${socket.userId}`);

      // Handle heartbeat from client
      socket.on('heartbeat', () => {
        console.log(`💓 Heartbeat received from user ${socket.userId}`);
        this.userHeartbeats.set(socket.userId.toString(), new Date());
        
        // Update lastSeen in database
        User.findByIdAndUpdate(socket.userId, {
          lastSeen: new Date()
        }).catch(err => console.error('Error updating heartbeat:', err));
      });

      // Handle join conversation
      socket.on('join_conversation', (data) => {
        const { conversationId, otherUserId } = data;

        
        // Leave all previous conversation rooms, but NEVER the user's own user room
        socket.rooms.forEach(room => {
          if (room !== socket.id && room !== socket.userId.toString()) {
            socket.leave(room);
            console.log(`[BlueTick] [join_conversation] Socket ${socket.id} left room ${room}`);
          }
        });

        // Always (re)join own user room as failsafe
        if (!socket.rooms.has(socket.userId.toString())) {
          socket.join(socket.userId.toString());
          console.log(`[BlueTick] [join_conversation] Failsafe: Socket ${socket.id} joined its own room ${socket.userId}`);
        }

        // Join the new conversation room
        socket.join(conversationId);
        console.log(`[BlueTick] [join_conversation] Socket ${socket.id} joined conversation room ${conversationId}`);

        // Track user's conversations
        const userConversations = this.userConversations.get(socket.userId.toString()) || new Set();
        userConversations.clear(); // Clear previous conversations
        userConversations.add(conversationId);
        this.userConversations.set(socket.userId.toString(), userConversations);

        // Notify other users in the conversation
        socket.to(conversationId).emit('user_joined_conversation', {
          conversationId,
          user: {
            id: socket.userId,
            name: socket.user.name,
            photo: socket.user.photo
          }
        });


      });

      // Handle send message - DISABLED: Messages are now saved via HTTP API only
      socket.on('send_message', async (data) => {

        socket.emit('message_error', { 
          error: 'Message sending via socket is disabled. Use HTTP API instead.',
          details: 'Messages should be sent via HTTP POST /api/chat/messages'
        });
      });

      // Handle typing indicators
      socket.on('typing', (data) => {
        const { conversationId, isTyping } = data;

        
        socket.to(conversationId).emit('user_typing', {
          conversationId,
          userId: socket.userId,
          userName: socket.user.name,
          isTyping
        });
      });

      // Handle real-time message read receipts
      socket.on('message_read', async (data) => {
        const { conversationId, readerId } = data;
        try {
          // Find all unread messages in this conversation sent to the reader
          const unreadMessages = await Message.find({
            conversationId,
            receiver: readerId,
            isRead: false
          });

          if (unreadMessages.length > 0) {
            // Mark as read
            const messageIds = unreadMessages.map(msg => msg._id);
            await Message.updateMany({ _id: { $in: messageIds } }, { isRead: true });

            // Notify the sender(s) in real time (only once per sender)
            const senderIds = [...new Set(unreadMessages.map(msg => msg.sender.toString()))];
            senderIds.forEach(senderId => {
                // Failsafe: force this socket to join its own user room if not already
                if (!socket.rooms.has(socket.userId.toString())) {
                    socket.join(socket.userId.toString());
                    console.log(`[BlueTick] [Failsafe] Socket ${socket.id} joined its own room ${socket.userId}`);
                }
                // Log all sockets in the sender's room
                const room = this.io.sockets.adapter.rooms.get(senderId.toString());
                const socketsInRoom = room ? Array.from(room) : [];
                console.log(`[BlueTick] [message_read] Sockets in room for sender ${senderId}:`, socketsInRoom);
                // Log all rooms for this socket
                console.log(`[BlueTick] [message_read] Socket ${socket.id} rooms:`, Array.from(socket.rooms));
                // Emit event
                console.log(`[BlueTick] [message_read] Emitting messages_read to sender ${senderId} for conversation ${conversationId}`);
                this.io.to(senderId.toString()).emit('messages_read', {
                    conversationId,
                    readerId
                });
            });
          }
        } catch (err) {
          console.error('Error handling message_read event:', err);
        }
      });

      // Handle disconnect
      socket.on('disconnect', async () => {

        
        // Update user offline status
        try {
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date()
          });
        } catch (error) {
          console.error('Error updating user offline status:', error);
        }

        // Remove from connected users
        this.connectedUsers.delete(socket.userId.toString());
        this.userConversations.delete(socket.userId.toString());
        this.userHeartbeats.delete(socket.userId.toString());

        // Broadcast user offline status
        this.io.emit('user_offline', {
          userId: socket.userId,
          isOnline: false,
          lastSeen: new Date()
        });
        console.log(`👤 Broadcasting user offline: ${socket.userId}`);
      });
    });
  }

  // Start heartbeat monitoring to detect inactive users
  startHeartbeatMonitoring() {
    this.heartbeatInterval = setInterval(async () => {
      const now = new Date();
      const inactiveThreshold = 60000; // 60 seconds (reduced from 90 seconds)
      
      for (const [userId, lastHeartbeat] of this.userHeartbeats.entries()) {
        const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat > inactiveThreshold) {
          // User is inactive, mark as offline
          try {
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen: lastHeartbeat
            });
            
            // Remove from connected users
            this.connectedUsers.delete(userId);
            this.userConversations.delete(userId);
            this.userHeartbeats.delete(userId);
            
            // Broadcast user offline status
            this.io.emit('user_offline', {
              userId: userId,
              isOnline: false,
              lastSeen: lastHeartbeat
            });
            
            console.log(`👤 User ${userId} marked as offline due to inactivity (${timeSinceLastHeartbeat}ms since last heartbeat)`);
          } catch (error) {
            console.error('Error marking user as offline:', error);
          }
        }
      }
    }, 20000); // Check every 20 seconds (reduced from 30 seconds)
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get user's active conversations
  getUserActiveConversations(userId) {
    return this.userConversations.get(userId.toString()) || new Set();
  }

  // Send notification to specific user
  sendNotification(userId, notification) {
    const userSocketInfo = this.connectedUsers.get(userId.toString());
    if (userSocketInfo) {
      const socket = this.io.sockets.sockets.get(userSocketInfo.socketId);
            if (socket) {
        socket.emit('notification', notification);
      }
    }
  }

  // Send any event to a specific user
  sendToUser(userId, event, data) {
    const userSocketInfo = this.connectedUsers.get(userId.toString());
    if (userSocketInfo) {
      const socket = this.io.sockets.sockets.get(userSocketInfo.socketId);
      if (socket) {
        socket.emit(event, data);
        console.log(`📡 Sent ${event} to user ${userId}`);
        return true;
      }
    }
    console.log(`⚠️ User ${userId} not connected, cannot send ${event}`);
    return false;
  }

  // Broadcast to all connected users
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Cleanup method
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}

module.exports = SocketService;