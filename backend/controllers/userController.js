const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

exports.getProfile = async (req, res) => {
  try {
    console.log('🔍 getProfile called for user ID:', req.userId);
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 Request user object:', req.user);
    
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    console.log('✅ User found:', user.name);
    
    // Get pending connection requests from Connection model
    const Connection = require('../models/Connection');
    console.log('🔍 Searching for pending requests where recipient =', req.userId);
    
    const pendingRequests = await Connection.find({
      recipient: req.userId,
      status: 'pending'
    }).populate('requester', 'name email photo bio');
    
    console.log('📝 Found pending requests:', pendingRequests.length);
    pendingRequests.forEach((conn, index) => {
      console.log(`  ${index + 1}. From: ${conn.requester.name} - ${conn.message}`);
    });
    
    // Also check all connections for this user to see what's in the database
    const allConnections = await Connection.find({
      $or: [
        { requester: req.userId },
        { recipient: req.userId }
      ]
    }).populate('requester', 'name email').populate('recipient', 'name email');
    
    console.log('🔍 All connections for this user:', allConnections.length);
    allConnections.forEach((conn, index) => {
      console.log(`  ${index + 1}. ${conn.requester.name} -> ${conn.recipient.name} (${conn.status})`);
    });
    
    // Convert MongoDB _id to id for frontend compatibility
    const userResponse = user.toObject();
    userResponse.id = userResponse._id.toString(); // Convert ObjectId to string
    
    // Add connection requests to user response
    userResponse.connectionRequests = pendingRequests.map(conn => ({
      _id: conn._id,
      from: conn.requester._id,
      status: conn.status,
      message: conn.message,
      skillContext: conn.skillContext,
      createdAt: conn.createdAt,
      requester: conn.requester
    }));
    
    console.log('📤 Sending response with connectionRequests:', userResponse.connectionRequests.length);
    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error('❌ Error in getProfile:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
};

exports.updateProfile = async (req, res) => {
  console.log('=== UPDATE PROFILE BACKEND ===');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  console.log('Request headers:', req.headers);
  
  const updates = req.body || {};
  delete updates.password;
  
  // Handle both 'bio' and 'about' fields - they should be the same
  if (updates.about) {
    updates.about = updates.about;
    updates.bio = updates.about; // Also update bio field for compatibility
  } else if (updates.bio) {
    updates.bio = updates.bio;
    updates.about = updates.bio; // Also update about field for compatibility
  }

  console.log('Updates object:', updates);

  // Handle photo upload and save as file
  if (req.file && req.file.buffer) {
    console.log('Received file:', req.file);
    // Save file to public/images with a unique name
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${req.file.originalname}`;
    const filePath = path.join(__dirname, '../public/images', filename);
    fs.writeFileSync(filePath, req.file.buffer);
    updates.photo = filename;
    updates.photoMimeType = req.file.mimetype || 'image/png';
  } else {
    console.log('No file received for photo upload. req.file:', req.file);
  }

  console.log('Final updates object:', updates);

  // If no updates, just return the current user
  if (Object.keys(updates).length === 0) {
    console.log('No updates to make, returning current user');
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    // Convert MongoDB _id to id for frontend compatibility
    const userResponse = user.toObject();
    userResponse.id = userResponse._id.toString(); // Convert ObjectId to string
    
    return res.json({ success: true, user: userResponse });
  }
  
  console.log('Updating user with ID:', req.userId);
  const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password');
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  
  // Convert MongoDB _id to id for frontend compatibility
  const userResponse = user.toObject();
  userResponse.id = userResponse._id.toString(); // Convert ObjectId to string
  
  console.log('Sending response:', { success: true, user: userResponse });
  res.json({ success: true, user: userResponse });
};

exports.deleteProfile = async (req, res) => {
  await User.findByIdAndDelete(req.userId);
  res.json({ message: 'Profile deleted' });
};

exports.addUserSkill = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.skills.push(req.body); // Optionally validate/transform
    await user.save();
    
    // Get the newly added skill and convert _id to id for frontend compatibility
    const newSkill = user.skills[user.skills.length - 1];
    const skillResponse = newSkill.toObject();
    skillResponse.id = skillResponse._id;
    
    // Convert user _id to id for frontend compatibility
    const userResponse = user.toObject();
    userResponse.id = userResponse._id.toString(); // Convert ObjectId to string
    
    res.status(201).json({ success: true, user: userResponse });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateUserSkill = async (req, res) => {
  try {
    console.log('updateUserSkill called with skillId:', req.params.skillId);
    console.log('Request body:', req.body);
    
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const skill = user.skills.id(req.params.skillId);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    console.log('Skill before update:', {
      name: skill.name,
      level: skill.level,
      description: skill.description,
      tags: skill.tags
    });

    // Update skill fields
    Object.assign(skill, req.body);

    console.log('Skill after update:', {
      name: skill.name,
      level: skill.level,
      description: skill.description,
      tags: skill.tags
    });

    await user.save();
    
    // Convert skill _id to id for frontend compatibility
    const skillResponse = skill.toObject();
    skillResponse.id = skillResponse._id;
    
    console.log('Sending response:', skillResponse);
    res.json(skillResponse);
  } catch (err) {
    console.error('Error in updateUserSkill:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.deleteUserSkill = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const skillId = req.params.skillId;
    const skill = user.skills.id(skillId);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    user.skills.pull({ _id: skillId });
    await user.save();
    res.json({ message: 'Skill deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    // Convert MongoDB _id to id for frontend compatibility
    const usersResponse = users.map(user => {
      const userObj = user.toObject();
      userObj.id = userObj._id;
      // Ensure customPricing is always present
      userObj.customPricing = userObj.customPricing ?? [];
      // Convert skill _id fields to id for frontend compatibility
      if (userObj.skills && Array.isArray(userObj.skills)) {
        userObj.skills = userObj.skills.map(skill => ({
          ...skill,
          id: skill._id
        }));
      }
      return userObj;
    });
    
    res.json({ success: true, users: usersResponse });
  } catch (err) {
    console.error('Error in getAllUsers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    // Convert MongoDB _id to id for frontend compatibility
    const userResponse = user.toObject();
    userResponse.id = userResponse._id.toString(); // Convert ObjectId to string
    
    // Convert skill _id fields to id for frontend compatibility
    if (userResponse.skills && Array.isArray(userResponse.skills)) {
      userResponse.skills = userResponse.skills.map(skill => ({
        ...skill,
        id: skill._id.toString() // Convert ObjectId to string
      }));
    }
    
    res.json({ success: true, user: userResponse });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.sendConnectionRequest = async (req, res) => {
  try {
    const sender = await User.findById(req.userId);
    if (!sender) return res.status(404).json({ error: 'Sender not found' });
    
    const receiverId = req.params.userId;
    if (sender._id.toString() === receiverId) {
      return res.status(400).json({ error: 'Cannot send connection request to yourself' });
    }
    
    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
    
    // Check if they are already connected
    const areAlreadyConnected = sender.connections && sender.connections.some(conn => 
      conn.toString() === receiverId
    );
    
    if (areAlreadyConnected) {
      return res.status(400).json({ error: 'Already connected with this user' });
    }
    
    // Check if there's already a pending request from sender to receiver
    const existingPendingRequest = receiver.connectionRequests && receiver.connectionRequests.find(req => 
      req.from.toString() === sender._id.toString() && req.status === 'pending'
    );
    
    if (existingPendingRequest) {
      return res.status(400).json({ error: 'Connection request already sent' });
    }
    
    // Check if there's already a pending request from receiver to sender
    const existingReverseRequest = sender.connectionRequests && sender.connectionRequests.find(req => 
      req.from.toString() === receiverId && req.status === 'pending'
    );
    
    if (existingReverseRequest) {
      return res.status(400).json({ error: 'This user has already sent you a connection request' });
    }
    
    // Add connection request to receiver
    receiver.connectionRequests = receiver.connectionRequests || [];
    receiver.connectionRequests.push({
      from: sender._id,
      status: 'pending',
      createdAt: new Date()
    });
    
    await receiver.save();
    res.json({ success: true, message: 'Connection request sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.respondToConnectionRequest = async (req, res) => {
  try {
    const Connection = require('../models/Connection');
    const connectionId = req.params.requestId;
    
    // Find the connection request in the Connection model
    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }
    
         // Debug logging for the 403 error
     console.log('🔍 DEBUG 403 ERROR:');
     console.log('🔍 Connection ID:', connectionId);
     console.log('🔍 Connection recipient:', connection.recipient.toString());
     console.log('🔍 Current user ID (req.userId):', req.userId);
     console.log('🔍 Connection requester:', connection.requester.toString());
     console.log('🔍 Are recipient and current user equal?', connection.recipient.toString() === req.userId.toString());
     
     // Verify the current user is the recipient
     if (connection.recipient.toString() !== req.userId.toString()) {
       console.log('❌ 403 ERROR: User is not the recipient');
       console.log('❌ Expected recipient:', connection.recipient.toString());
       console.log('❌ Actual user ID:', req.userId.toString());
       return res.status(403).json({ success: false, message: 'You can only respond to requests sent to you' });
     }
    
    if (connection.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already handled' });
    }
    
    // Get sender and receiver
    const sender = await User.findById(connection.requester);
    const receiver = await User.findById(connection.recipient);
    
    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update the connection status
    const responseStatus = req.body.response === 'accept' ? 'accepted' : 'rejected';
    connection.status = responseStatus;
    
    if (responseStatus === 'accepted') {
      // Only add the receiver to the sender's connections array
      // This ensures only the sender's connection count increases
      sender.connections = sender.connections || [];
      
      // Add receiver to sender's connections (only if not already connected)
      const senderConnections = sender.connections.map(conn => conn.toString());
      
      if (!senderConnections.includes(receiver._id.toString())) {
        sender.connections.push(receiver._id);
      }
      
      // Save only the sender (receiver's connections remain unchanged)
      await sender.save();
    }
    
    // Save the updated connection
    await connection.save();
    
    // Emit socket events if socket service is available
    const socketService = req.app.get('socketService');
    if (socketService) {
      // Notify the sender that their request was accepted/rejected
      const senderEvent = {
        type: 'connection_request_responded',
        data: {
          status: responseStatus,
          from: receiver._id.toString(),
          fromName: receiver.name,
          requestId: connection._id.toString(),
          timestamp: new Date()
        }
      };
      
      socketService.sendNotification(sender._id.toString(), senderEvent);
      
      // Notify the receiver about the status change
      const receiverEvent = {
        type: 'connection_status_updated',
        data: {
          withUser: sender._id.toString(),
          status: responseStatus,
          timestamp: new Date()
        }
      };
      
      socketService.sendNotification(receiver._id.toString(), receiverEvent);
    }
    
    res.json({ 
      success: true, 
      message: `Request ${responseStatus}`,
      data: {
        connectionId: connection._id,
        status: connection.status
      }
    });
    
  } catch (err) {
    console.error('Error in respondToConnectionRequest:', err);
    res.status(500).json({ success: false, message: 'Failed to respond to connection request' });
  }
};

// Get connection status between current user and another user
exports.getConnectionStatus = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) return res.status(404).json({ error: 'Current user not found' });
    
    const otherUserId = req.params.userId;
    if (!otherUserId) return res.status(400).json({ error: 'Other user ID is required' });
    
         // Check if they are connected (only check if current user has the other user in their connections)
     // This follows the one-way connection model where only the sender gets the connection
     const areConnected = currentUser.connections && currentUser.connections.some(conn => 
       conn.toString() === otherUserId
     );
    
    // Check if there's a pending request from current user to other user
    // This would be in the other user's connectionRequests array
         const otherUser = await User.findById(otherUserId);
     if (!otherUser) return res.status(404).json({ error: 'Other user not found' });
    
         const pendingRequestFromCurrentUser = otherUser.connectionRequests && otherUser.connectionRequests.find(connectionReq => {
       const fromId = connectionReq.from.toString();
       const currentUserId = req.userId.toString();
       const isMatch = fromId === currentUserId;
       const isPending = connectionReq.status === 'pending';
       return isMatch && isPending;
     });
    
    // Check if there's a pending request from other user to current user
    const pendingRequestFromOtherUser = currentUser.connectionRequests && currentUser.connectionRequests.find(requestItem => 
      requestItem.from.toString() === otherUserId && requestItem.status === 'pending'
    );
    
    
    
         let status = null;
     if (areConnected) {
       status = 'accepted';
     } else if (pendingRequestFromCurrentUser) {
       status = 'pending';
     } else if (pendingRequestFromOtherUser) {
       status = 'pending';
     }
    
    // Determine if current user is the requester or recipient
    let isRequester = false;
    let isRecipient = false;
    
    if (status === 'pending') {
      if (pendingRequestFromCurrentUser) {
        isRequester = true;
      } else if (pendingRequestFromOtherUser) {
        isRecipient = true;
      }
         } else if (status === 'accepted') {
       // For accepted connections, check if current user has the other user in their connections
       // If yes, they are the requester (sender); if no, they are the recipient
       isRequester = areConnected;
       isRecipient = !areConnected;
     }
    
    const response = {
      success: true,
      data: {
        status,
        areConnected,
        canSendRequest: !status || status === 'rejected',
        isRequester,
        isRecipient
      }
    };
    
         res.json(response);
  } catch (err) {
    console.error('Error in getConnectionStatus:', err);
    res.status(500).json({ error: err.message });
  }
}; 

// Get online status for multiple users
exports.getUsersOnlineStatus = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    // Validate ObjectIds
    const validUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid user IDs provided'
      });
    }

    // Get online status for the specified users
    const users = await User.find(
      { _id: { $in: validUserIds } },
      'name email photo isOnline lastSeen'
    );

    const statusMap = {};
    users.forEach(user => {
      statusMap[user._id.toString()] = {
        isOnline: user.isOnline || false,
        lastSeen: user.lastSeen,
        name: user.name
      };
    });

    res.json({
      success: true,
      data: {
        userStatuses: statusMap
      }
    });

  } catch (error) {
    console.error('Get users online status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users online status',
      error: error.message
    });
  }
}; 

 