const Connection = require('../models/Connection');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get socket service instance
let socketService;
try {
  socketService = require('../services/socketService');
} catch (error) {
  console.log('Socket service not available');
}

// Send connection request
exports.sendConnectionRequest = async (req, res) => {
  try {
    const { recipientId, message = '', skillContext = '' } = req.body;
    const requesterId = req.userId;

    // Defensive: Validate ObjectId for requester and recipient
    if (!mongoose.Types.ObjectId.isValid(requesterId) || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid requester or recipient ID'
      });
    }

    // Validate recipient
    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required'
      });
    }

    // Prevent self-connection
    if (requesterId === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a connection request to yourself'
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

    // Allow "Connect Back" requests even if connection exists
    if (existingConnection && skillContext !== 'Connect Back') {
      return res.status(400).json({
        success: false,
        message: 'Connection request already exists',
        data: {
          status: existingConnection.status,
          connectionId: existingConnection._id
        }
      });
    }

    // For "Connect Back" requests, we allow creating a new connection request
    // even if an existing connection exists
    const connection = new Connection({
      requester: requesterId,
      recipient: recipientId,
      message: message.trim(),
      skillContext: skillContext.trim()
    });

    await connection.save();

    // Populate requester details for response
    await connection.populate('requester', 'name email photo');

    // Emit socket event to notify both users about the new connection request
    if (socketService && socketService.io) {
      // Notify the recipient about the new connection request
      socketService.io.to(recipientId.toString()).emit('connection_request_received', {
        connectionId: connection._id,
        requester: connection.requester,
        status: connection.status,
        message: connection.message,
        skillContext: connection.skillContext,
        createdAt: connection.createdAt
      });

      // Notify the requester about the sent request
      socketService.io.to(requesterId.toString()).emit('connection_request_sent', {
        connectionId: connection._id,
        recipient: recipientId,
        status: connection.status,
        message: connection.message,
        skillContext: connection.skillContext,
        createdAt: connection.createdAt
      });

      // Broadcast connection status update to all users
      socketService.io.emit('connection_status_update', {
        withUser: recipientId,
        status: connection.status,
        userRole: 'requester' // For the requester
      });

      socketService.io.emit('connection_status_update', {
        withUser: requesterId,
        status: connection.status,
        userRole: 'recipient' // For the recipient
      });
    }

    res.status(201).json({
      success: true,
      message: 'Connection request sent successfully',
      data: {
        connectionId: connection._id,
        status: connection.status,
        requester: connection.requester,
        message: connection.message,
        skillContext: connection.skillContext,
        createdAt: connection.createdAt
      }
    });

  } catch (error) {
    console.error('Send connection request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send connection request',
      error: error.message
    });
  }
};

// Accept connection request
exports.acceptConnectionRequest = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    // Defensive: Validate ObjectId for connectionId and userId
    if (!mongoose.Types.ObjectId.isValid(connectionId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid connection or user ID'
      });
    }

    const connection = await Connection.findById(connectionId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection request not found'
      });
    }

    // Verify user is the recipient
    console.log('🔍 Debug - Connection recipient:', connection.recipient.toString());
    console.log('🔍 Debug - Current user ID:', userId);
    console.log('🔍 Debug - Are they equal?', connection.recipient.toString() === userId);
    
    if (connection.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only accept connection requests sent to you'
      });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Connection request is not pending'
      });
    }

    // Accept the connection
    await connection.accept();

    // Only add the recipient to the requester's connections list
    // This ensures only the sender's connection count increases
    await User.findByIdAndUpdate(connection.requester, {
      $addToSet: { connections: connection.recipient }
    });

    // Don't add the requester to the recipient's connections list
    // This keeps the recipient's connection count unchanged

    // Populate user details
    await connection.populate('requester', 'name email photo');
    await connection.populate('recipient', 'name email photo');

    // Emit socket events for connection acceptance
    if (socketService && socketService.io) {
      // Notify the requester that their request was accepted
      socketService.io.to(connection.requester.toString()).emit('connection_request_response', {
        from: connection.recipient._id,
        fromName: connection.recipient.name,
        status: 'accepted',
        connectionId: connection._id
      });

      // Notify the recipient that they accepted the request
      socketService.io.to(connection.recipient.toString()).emit('connection_request_accepted', {
        from: connection.requester._id,
        fromName: connection.requester.name,
        status: 'accepted',
        connectionId: connection._id
      });

      // Broadcast connection status update to all users
      socketService.io.emit('connection_status_update', {
        withUser: connection.requester._id,
        status: connection.status,
        userRole: 'requester'
      });

      socketService.io.emit('connection_status_update', {
        withUser: connection.recipient._id,
        status: connection.status,
        userRole: 'recipient'
      });
    }

    res.json({
      success: true,
      message: 'Connection request accepted',
      data: {
        connectionId: connection._id,
        status: connection.status,
        requester: connection.requester,
        recipient: connection.recipient,
        acceptedAt: connection.acceptedAt
      }
    });

  } catch (error) {
    console.error('Accept connection request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept connection request',
      error: error.message
    });
  }
};

// Reject connection request
exports.rejectConnectionRequest = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    // Defensive: Validate ObjectId for connectionId and userId
    if (!mongoose.Types.ObjectId.isValid(connectionId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid connection or user ID'
      });
    }

    const connection = await Connection.findById(connectionId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection request not found'
      });
    }

    // Verify user is the recipient
    if (connection.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject connection requests sent to you'
      });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Connection request is not pending'
      });
    }

    // Reject the connection
    await connection.reject();

    res.json({
      success: true,
      message: 'Connection request rejected',
      data: {
        connectionId: connection._id,
        status: connection.status,
        rejectedAt: connection.rejectedAt
      }
    });

  } catch (error) {
    console.error('Reject connection request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject connection request',
      error: error.message
    });
  }
};

// Withdraw connection request
exports.withdrawConnectionRequest = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    // Defensive: Validate ObjectId for connectionId and userId
    if (!mongoose.Types.ObjectId.isValid(connectionId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid connection or user ID'
      });
    }

    const connection = await Connection.findById(connectionId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection request not found'
      });
    }

    // Verify user is the requester
    if (connection.requester.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only withdraw your own connection requests'
      });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Connection request is not pending'
      });
    }

    // Permanently delete the connection
    await Connection.findByIdAndDelete(connectionId);

    // Optionally, remove references from both users' connections arrays
    await User.updateMany(
      { connections: connectionId },
      { $pull: { connections: connectionId } }
    );

    res.json({
      success: true,
      message: 'Connection request permanently deleted',
      data: {
        connectionId
      }
    });

  } catch (error) {
    console.error('Withdraw connection request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw connection request',
      error: error.message
    });
  }
};

// Get connection requests (pending, sent, received)
exports.getConnectionRequests = async (req, res) => {
  try {
    const userId = req.userId;
    // Defensive: Validate ObjectId for userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    const { type = 'received', status = 'pending', page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (type === 'received') {
      query.recipient = userId;
    } else if (type === 'sent') {
      query.requester = userId;
    }

    if (status) {
      query.status = status;
    }

    const connections = await Connection.find(query)
      .populate('requester', 'name email photo bio')
      .populate('recipient', 'name email photo bio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Connection.countDocuments(query);

    res.json({
      success: true,
      data: {
        connections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get connection requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connection requests',
      error: error.message
    });
  }
};

// Get connection status between two users
exports.getConnectionStatus = async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.userId;

    console.log('🔍 getConnectionStatus called with:');
    console.log('  Current User ID (from req.userId):', currentUserId);
    console.log('  Other User ID (from params):', otherUserId);
    console.log('  Current User ID type:', typeof currentUserId);
    console.log('  Other User ID type:', typeof otherUserId);

    // Defensive: Validate ObjectId for both user IDs
    if (!mongoose.Types.ObjectId.isValid(currentUserId) || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID(s)'
      });
    }

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Get detailed connection information
    const connection = await Connection.findOne({
      $or: [
        { requester: currentUserId, recipient: otherUserId },
        { requester: otherUserId, recipient: currentUserId }
      ]
    });

    const status = connection ? connection.status : null;
    const areConnected = status === 'accepted';
    
    // Determine the role of current user in this connection
    let userRole = null;
    if (connection) {
      console.log('🔍 Debug - Connection found:');
      console.log('  Connection ID:', connection._id);
      console.log('  Requester ID:', connection.requester.toString());
      console.log('  Recipient ID:', connection.recipient.toString());
      console.log('  Current User ID:', currentUserId);
      console.log('  Other User ID:', otherUserId);
      console.log('  Requester ID type:', typeof connection.requester.toString());
      console.log('  Current User ID type:', typeof currentUserId);
      console.log('  String comparison - Requester === CurrentUser:', connection.requester.toString() === currentUserId);
      console.log('  String comparison - Recipient === CurrentUser:', connection.recipient.toString() === currentUserId);
      
      // Convert both to strings for comparison to avoid ObjectId vs String issues
      const requesterIdStr = connection.requester.toString();
      const recipientIdStr = connection.recipient.toString();
      const currentUserIdStr = currentUserId.toString();
      
      console.log('  String comparison details:');
      console.log('    Requester ID (string):', requesterIdStr);
      console.log('    Current User ID (string):', currentUserIdStr);
      console.log('    Are they equal?', requesterIdStr === currentUserIdStr);
      
      userRole = requesterIdStr === currentUserIdStr ? 'requester' : 'recipient';
      console.log('  Calculated User Role:', userRole);
    } else {
      console.log('🔍 No connection found between users');
    }

    res.json({
      success: true,
      data: {
        status,
        areConnected,
        userRole, // 'requester' or 'recipient' or null
        canSendRequest: !status || status === 'rejected' || status === 'withdrawn'
      }
    });

  } catch (error) {
    console.error('Get connection status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connection status',
      error: error.message
    });
  }
};

// Get user's connections (accepted connections)
exports.getUserConnections = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Defensive: Validate ObjectId for userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    const { page = 1, limit = 20, includeAllUsers = false } = req.query;

    // If includeAllUsers is true, return all users (for testing/debugging)
    if (includeAllUsers === 'true') {
      const allUsers = await User.find({ _id: { $ne: userId } })
        .select('name email photo bio skills')
        .limit(parseInt(limit));
      
      return res.json({
        success: true,
        data: {
          connectedUsers: allUsers.map(user => ({
            connection: { status: 'none' },
            user: user,
            connectionCount: 0
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: allUsers.length,
            pages: 1
          }
        }
      });
    }

    const skip = (page - 1) * limit;

    // Get accepted connections where the user is either requester or recipient
    const query = {
      $or: [
        { requester: userId, status: { $in: ['accepted', 'pending'] } },
        { recipient: userId, status: { $in: ['accepted', 'pending'] } }
      ]
    };
    const connections = await Connection.find(query)
      .populate('requester', 'name email photo bio skills')
      .populate('recipient', 'name email photo bio skills')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Connection.countDocuments(query);

    // Get connection counts for each connected user
    const connectedUsers = [];
    for (const connection of connections) {
      const otherUser = connection.requester._id.equals(userId) ? connection.recipient : connection.requester;
      // Skip adding self to connectedUsers
      if (otherUser._id.equals(userId)) continue;

      // Count accepted connections for this user (only where they are the requester/sender)
      const userConnectionCount = await Connection.countDocuments({
        requester: otherUser._id,
        status: 'accepted'
      });

      // Add connection count to the user object
      const userWithCount = {
        ...otherUser.toObject(),
        connectionCount: userConnectionCount
      };

      connectedUsers.push({
        connection: connection,
        user: userWithCount,
        connectionCount: userConnectionCount
      });
    }

    const response = {
      success: true,
      data: {
        connections: connections,
        connectedUsers: connectedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Get user connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user connections',
      error: error.message
    });
  }
};

// Reset all connections (ADMIN ONLY - for testing purposes)
exports.resetAllConnections = async (req, res) => {
  try {
    console.log('🔄 Admin resetting all connections...');
    
    // Step 1: Clear all connection documents from Connection collection
    const connectionResult = await Connection.deleteMany({});
    console.log(`✅ Deleted ${connectionResult.deletedCount} connection documents`);
    
    // Step 2: Reset connections and connection requests for each user
    const users = await User.find({});
    console.log(`Found ${users.length} users to reset`);
    
    for (const user of users) {
      // Clear connections array
      user.connections = [];
      
      // Clear connection requests array (if it exists)
      if (user.connectionRequests) {
        user.connectionRequests = [];
      }
      
      // Save the updated user
      await user.save();
    }
    
    console.log('🎉 All connections reset successfully');
    
    res.json({
      success: true,
      message: 'All connections have been reset successfully',
      data: {
        deletedConnections: connectionResult.deletedCount,
        updatedUsers: users.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error resetting connections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset connections',
      error: error.message
    });
  }
}; 