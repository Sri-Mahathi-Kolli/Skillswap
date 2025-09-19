const Session = require('../models/Session');
const User = require('../models/User');
const ZoomService = require('../services/zoomService'); // Make sure this is implemented
const sendReminder = require('../utils/sendReminder'); // Implement this utility for reminders

// Create a new session (teacher/mentor)
exports.createSession = async (req, res) => {
  try {
    const {
      title, description, skill, startTime, endTime, price, currency = 'USD',
      sessionType = 'one-on-one', difficulty = 'beginner', maxParticipants = 10, tags = [],
      attendees = []
    } = req.body;
    
    const teacherId = req.userId || req.user._id;
    
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }
    
    // Parse attendees from description if not provided directly
    let attendeeEmails = attendees;
    if (!attendeeEmails && description) {
      const participantMatch = description.match(/Participants:\s*(.+)/);
      if (participantMatch) {
        attendeeEmails = participantMatch[1].split(',').map(email => email.trim()).filter(Boolean);
      }
    }
    
    // Create participants array starting with the host
    const participants = [{ user: teacherId, role: 'mentor', joinedAt: new Date() }];
    
    // Add attendee emails as participants
    if (attendeeEmails && Array.isArray(attendeeEmails)) {
      attendeeEmails.forEach(email => {
        if (email && email.trim()) {
          participants.push({
            email: email.trim().toLowerCase(),
            role: 'learner',
            joinedAt: new Date()
          });
        }
      });
    }
    
    const sessionData = {
      title,
      description,
      skill: skill,
      host: teacherId,
      participants: participants,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration: Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60)),
      price,
      currency,
      status: 'scheduled',
      sessionType,
      difficulty,
      maxParticipants,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()).filter(Boolean)
    };
    
    const session = new Session(sessionData);

    await session.save();
    
    // Populate teacher info
    await session.populate('host', 'name email photo');
    res.status(201).json(session);
  } catch (err) {
    console.error('Create session error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Get sessions for current user (host or attendee)
exports.getSessions = async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get current user to check their email
    const currentUser = await User.findById(userId).select('email');
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find sessions where user is either:
    // 1. The host, OR
    // 2. A participant, OR
    // 3. An invited attendee (by email)
    const sessions = await Session.find({
      $or: [
        { host: userId },
        { 'participants.user': userId },
        { 'participants.email': currentUser.email }
      ]
    })
      .populate('host', 'name email photo')
      .populate('participants.user', 'name email photo')
      .sort({ startTime: 1 });
    
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Get sessions by teacher
exports.getTeacherSessions = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const sessions = await Session.find({ host: teacherId })
      .populate('host', 'name email photo')
      .populate('participants.user', 'name email photo')
      .sort({ startTime: 1 });
    
    res.json(sessions);
  } catch (err) {
    console.error('Get teacher sessions error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Get sessions by student
exports.getStudentSessions = async (req, res) => {
  try {
    const { studentId } = req.params;
    const sessions = await Session.find({
      'participants.user': studentId,
      'participants.role': 'learner'
    })
      .populate('host', 'name email photo')
      .populate('participants.user', 'name email photo')
      .sort({ startTime: 1 });
    
    res.json(sessions);
  } catch (err) {
    console.error('Get student sessions error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Get a specific session
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId)
      .populate('host', 'name email photo')
      .populate('participants.user', 'name email photo');
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (err) {
    console.error('Get session error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Book a session (student)
exports.bookSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId, paymentIntentId } = req.body;
    
    const session = await Session.findById(sessionId).populate('host', 'name email');
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if student is already a participant
    const isAlreadyParticipant = session.participants.some(
      p => p.user.toString() === studentId && p.role === 'learner'
    );
    
    if (isAlreadyParticipant) {
      return res.status(400).json({ error: 'Student is already booked for this session' });
    }
    
    // Check if session is full
    if (session.participants.length >= session.maxParticipants) {
      return res.status(400).json({ error: 'Session is full' });
    }
    
    // Add student as participant
    session.participants.push({
      user: studentId,
      role: 'learner',
      joinedAt: new Date()
    });
    
    await session.save();
    
    // Create payment records for the session booking
    if (session.price > 0) {
      const Payment = require('../models/Payment');
      const User = require('../models/User');
      
      // Get student info
      const student = await User.findById(studentId).select('name email');
      
      console.log('💳 Creating session payment records for booking...');
      
      // Create payment record for the student (payer)
      const studentPayment = new Payment({
        user: studentId,
        session: sessionId,
        stripePaymentIntentId: paymentIntentId || `manual_${Date.now()}_student`,
        amount: session.price,
        currency: session.currency || 'USD',
  status: 'completed',
        paymentType: 'session',
        description: `Payment for ${session.skill} session: ${session.title}`,
        metadata: {
          isPayerRecord: true,
          fromUserId: studentId,
          fromUserName: student?.name || 'Student',
          toUserId: session.host._id,
          toUserName: session.host.name,
          sessionId: sessionId,
          skillName: session.skill,
          // Add fields expected by frontend
          recipientName: session.host.name,
          recipientId: session.host._id
        }
      });
        if (studentPayment.stripePaymentIntentId) {
          await studentPayment.save();
        } else {
          console.error('❌ stripePaymentIntentId is null for studentPayment. Not saved.');
        }
      
      // Create payment record for the host (recipient) 
      const hostPayment = new Payment({
        user: session.host._id,
        session: sessionId,
        stripePaymentIntentId: paymentIntentId || `manual_${Date.now()}_host`,
        amount: session.price,
        currency: session.currency || 'USD',
  status: 'completed',
        paymentType: 'session',
        description: `Received payment for ${session.skill} session: ${session.title}`,
        metadata: {
          isRecipientRecord: true,
          fromUserId: studentId,
          fromUserName: student?.name || 'Student',
          toUserId: session.host._id,
          toUserName: session.host.name,
          sessionId: sessionId,
          skillName: session.skill,
          // Add fields expected by frontend
          payerName: student?.name || 'Student',
          payerId: studentId
        }
      });
        if (hostPayment.stripePaymentIntentId) {
          await hostPayment.save();
        } else {
          console.error('❌ stripePaymentIntentId is null for hostPayment. Not saved.');
        }
      
      await Promise.all([studentPayment.save(), hostPayment.save()]);
      
      console.log('✅ Session payment dual records created:', {
        studentPaymentId: studentPayment._id,
        hostPaymentId: hostPayment._id,
        amount: session.price,
        session: session.title
      });
    }
    
    // Populate user info
    await session.populate('participants.user', 'name email photo');
    
    res.json(session);
  } catch (err) {
    console.error('Book session error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Cancel a session
exports.cancelSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if user is the host or a participant
    const userId = req.userId || req.user._id;
    const isHost = session.host.toString() === userId.toString();
    const isParticipant = session.participants.some(p => p.user.toString() === userId.toString());
    
    if (!isHost && !isParticipant) {
      return res.status(403).json({ error: 'Not authorized to cancel this session' });
    }
    
    session.status = 'cancelled';
    if (reason) {
      session.cancellationReason = reason;
    }
    
    await session.save();
    
    res.json(session);
  } catch (err) {
    console.error('Cancel session error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Update session status
exports.updateSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only host can update status
    const userId = req.userId || req.user._id;
    if (session.host.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Only the host can update session status' });
    }
    
    session.status = status;
    await session.save();
    
    res.json(session);
  } catch (err) {
    console.error('Update session status error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Update session
exports.updateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updateData = req.body;
    
    console.log('🔄 UPDATE SESSION - Starting updateSession');
    console.log('🆔 Session ID:', sessionId);
    console.log('📝 Update data:', updateData);
    
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ Session not found:', sessionId);
      return res.status(404).json({ error: 'Session not found' });
    }
    
    console.log('📋 Found session:', session.title);
    
    // Only host can update session
    const userId = req.userId || req.user._id;
    
    if (session.host.toString() !== userId.toString()) {
      console.log('❌ User is not the host of this session');
      return res.status(403).json({ error: 'Only the host can update this session' });
    }
    
    console.log('✅ User is authorized to update session');
    
    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'skill', 'startTime', 'endTime', 
      'price', 'currency', 'sessionType', 'difficulty', 'maxParticipants',
      'tags', 'timezone'
    ];
    
    console.log('🔧 Updating fields...');
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        session[field] = updateData[field];
        console.log(`✅ Updated ${field}:`, updateData[field]);
      }
    });
    
    // Handle tags array
    if (updateData.tags && typeof updateData.tags === 'string') {
      session.tags = updateData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      console.log('✅ Updated tags array:', session.tags);
    }
    
    // Recalculate duration if times changed
    if (updateData.startTime || updateData.endTime) {
      const startTime = updateData.startTime ? new Date(updateData.startTime) : session.startTime;
      const endTime = updateData.endTime ? new Date(updateData.endTime) : session.endTime;
      session.duration = Math.round((endTime - startTime) / (1000 * 60));
      console.log('✅ Recalculated duration:', session.duration, 'minutes');
    }
    
    // Handle attendees if provided
    if (updateData.attendees && Array.isArray(updateData.attendees)) {
      console.log('👥 Processing attendees update...');
      
      // Keep the host as the first participant
      const hostParticipant = session.participants.find(p => p.role === 'mentor');
      const newParticipants = hostParticipant ? [hostParticipant] : [];
      
      // Add new attendees
      updateData.attendees.forEach(email => {
        if (email && email.trim()) {
          newParticipants.push({
            email: email.trim().toLowerCase(),
            role: 'learner',
            joinedAt: new Date()
          });
        }
      });
      
      session.participants = newParticipants;
      console.log('✅ Updated participants:', session.participants.length);
    }
    
    // Validate that the session is not in the past
    if (session.startTime < new Date()) {
      console.log('❌ Cannot update session to past time');
      return res.status(400).json({ error: 'Cannot schedule sessions in the past' });
    }
    
    await session.save();
    console.log('✅ Session saved to database');
    
    // Populate user info
    await session.populate('host', 'name email photo');
    await session.populate('participants.user', 'name email photo');
    
    // Send real-time notification to all participants about the update
    const socketService = req.app.get('socketService');
    if (socketService) {
      console.log('📡 Sending real-time update notifications...');
      
      const notificationData = {
        type: 'session_updated',
        sessionId: session._id,
        sessionTitle: session.title,
        hostName: session.host.name,
        message: `Meeting "${session.title}" has been updated by the host`,
        updatedSession: session,
        timestamp: new Date().toISOString()
      };
      
      // Notify host
      socketService.sendToUser(session.host._id.toString(), 'session_updated', notificationData);
      
      // Notify all participants
      session.participants.forEach(participant => {
        if (participant.user) {
          socketService.sendToUser(participant.user._id.toString(), 'session_updated', notificationData);
        }
      });
      
      console.log(`📡 Sent update notifications to ${session.participants.length + 1} users`);
    }
    
    console.log('✅ Session update completed successfully');
    res.json(session);
    
  } catch (err) {
    console.error('❌ Update session error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Search sessions
exports.searchSessions = async (req, res) => {
  try {
    const { skillId, teacherId, date, minPrice, maxPrice, duration } = req.query;
    
    let query = {};
    
    if (skillId) query.skill = skillId;
    if (teacherId) query.host = teacherId;
    if (date) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);
      query.startTime = { $gte: startOfDay, $lt: endOfDay };
    }
    if (minPrice !== undefined) query.price = { $gte: parseFloat(minPrice) };
    if (maxPrice !== undefined) {
      if (query.price) {
        query.price.$lte = parseFloat(maxPrice);
      } else {
        query.price = { $lte: parseFloat(maxPrice) };
      }
    }
    if (duration) query.duration = parseFloat(duration);
    
    // Only show available sessions
    query.status = 'scheduled';
    
    const sessions = await Session.find(query)
      .populate('host', 'name email photo')
      .populate('participants.user', 'name email photo')
      .sort({ startTime: 1 });
    
    res.json(sessions);
  } catch (err) {
    console.error('Search sessions error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Get upcoming sessions
exports.getUpcomingSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    // Get current user to check their email
    const currentUser = await User.findById(userId).select('email');
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const sessions = await Session.find({
      $or: [
        { host: userId },
        { 'participants.user': userId },
        { 'participants.email': currentUser.email }
      ],
      startTime: { $gte: new Date() },
      status: { $in: ['scheduled', 'in-progress'] }
    })
      .populate('host', 'name email photo')
      .populate('participants.user', 'name email photo')
      .sort({ startTime: 1 })
      .limit(parseInt(limit));
    
    res.json(sessions);
  } catch (err) {
    console.error('Get upcoming sessions error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Add meeting URL (for Zoom integration)
exports.addMeetingUrl = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { meetingUrl, meetingId } = req.body;
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only host can add meeting URL
    const userId = req.userId || req.user._id;
    if (session.host.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Only the host can add meeting URL' });
    }
    
    session.zoomMeeting = {
      meetingId,
      joinUrl: meetingUrl,
      startUrl: meetingUrl
    };
    
    await session.save();
    
    res.json(session);
  } catch (err) {
    console.error('Add meeting URL error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Delete a session
exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId || req.user._id;
    
    console.log('🗑️ DELETE SESSION - Starting deleteSession');
    console.log('🆔 Session ID:', sessionId);
    console.log('👤 User ID:', userId);
    
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ Session not found:', sessionId);
      return res.status(404).json({ error: 'Session not found' });
    }
    
    console.log('📋 Found session:', session.title);
    console.log('👤 Session host:', session.host);
    
    // Only host can delete session
    if (session.host.toString() !== userId.toString()) {
      console.log('❌ User is not the host of this session');
      return res.status(403).json({ error: 'Only the host can delete this session' });
    }
    
    console.log('✅ User is authorized to delete session');
    
    // Check if session is in progress or completed
    if (session.status === 'in-progress' || session.status === 'completed') {
      console.log('❌ Cannot delete session that is in progress or completed');
      return res.status(400).json({ error: 'Cannot delete a session that is in progress or completed' });
    }
    
    // Populate session with user details before deletion for notifications
    await session.populate([
      { path: 'host', select: 'name email photo' },
      { path: 'participants.user', select: 'name email photo' }
    ]);
    
    // Send real-time notification to all participants about the deletion
    const socketService = req.app.get('socketService');
    if (socketService) {
      console.log('📡 Sending real-time deletion notifications...');
      
      const notificationData = {
        type: 'session_deleted',
        sessionId: session._id,
        sessionTitle: session.title,
        hostName: session.host.name,
        message: `Meeting "${session.title}" has been cancelled by the host`,
        deletedSession: {
          id: session._id,
          title: session.title,
          startTime: session.startTime
        },
        timestamp: new Date().toISOString()
      };
      
      // Notify host
      socketService.sendToUser(session.host._id.toString(), 'session_deleted', notificationData);
      
      // Notify all participants
      session.participants.forEach(participant => {
        if (participant.user) {
          socketService.sendToUser(participant.user._id.toString(), 'session_deleted', notificationData);
        }
      });
      
      console.log(`📡 Sent deletion notifications to ${session.participants.length + 1} users`);
    }
    
    // Delete the session
    await Session.findByIdAndDelete(sessionId);
    
    console.log('✅ Session deleted successfully');
    
    res.json({ 
      success: true, 
      message: 'Session deleted successfully',
      deletedSession: {
        id: sessionId,
        title: session.title
      }
    });
    
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ error: err.message });
  }
}; 

// Start meeting - Host can mark meeting as live
exports.startMeeting = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const userId = req.userId || req.user._id;
    
    console.log('🚀 Starting meeting for session:', sessionId, 'by user:', userId);
    
    const session = await Session.findById(sessionId).populate([
      { path: 'host', select: 'name email photo' },
      { path: 'participants.user', select: 'name email photo' }
    ]);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if user is the host
    if (session.host._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Only the host can start the meeting' });
    }
    
    // Update meeting status
    session.meetingStatus = 'live';
    session.actualStartTime = new Date();
    session.hostJoinedAt = new Date();
    session.status = 'in-progress';
    
    await session.save();
    
    // Send real-time notification to all participants
    const socketService = req.app.get('socketService');
    if (socketService) {
      console.log('📡 Sending meeting started notifications...');
      
      const notificationData = {
        type: 'meeting_started',
        sessionId: session._id,
        sessionTitle: session.title,
        hostName: session.host.name,
        message: `Meeting "${session.title}" has been started by the host. You can now join!`,
        meetingStatus: 'live',
        joinUrl: session.zoomMeeting?.joinUrl,
        timestamp: new Date().toISOString()
      };
      
      // Notify all participants (not the host)
      session.participants.forEach(participant => {
        if (participant.user && participant.user._id.toString() !== userId.toString()) {
          socketService.sendToUser(participant.user._id.toString(), 'meeting_status_updated', notificationData);
        }
      });
      
      console.log(`📡 Sent meeting started notifications to ${session.participants.length} participants`);
    }
    
    res.json({
      success: true,
      message: 'Meeting started successfully',
      session: {
        id: session._id,
        meetingStatus: session.meetingStatus,
        actualStartTime: session.actualStartTime
      }
    });
    
  } catch (err) {
    console.error('Start meeting error:', err);
    res.status(500).json({ error: err.message });
  }
};

// End meeting - Host can mark meeting as ended
exports.endMeeting = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const userId = req.userId || req.user._id;
    
    console.log('🛑 Ending meeting for session:', sessionId, 'by user:', userId);
    
    const session = await Session.findById(sessionId).populate([
      { path: 'host', select: 'name email photo' },
      { path: 'participants.user', select: 'name email photo' }
    ]);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if user is the host
    if (session.host._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Only the host can end the meeting' });
    }
    
    // Update meeting status
    session.meetingStatus = 'ended';
    session.actualEndTime = new Date();
    session.status = 'completed';
    
    await session.save();
    
    // Send real-time notification to all participants
    const socketService = req.app.get('socketService');
    if (socketService) {
      console.log('📡 Sending meeting ended notifications...');
      
      const notificationData = {
        type: 'meeting_ended',
        sessionId: session._id,
        sessionTitle: session.title,
        hostName: session.host.name,
        message: `Meeting "${session.title}" has been ended by the host.`,
        meetingStatus: 'ended',
        timestamp: new Date().toISOString()
      };
      
      // Notify all participants (not the host)
      session.participants.forEach(participant => {
        if (participant.user && participant.user._id.toString() !== userId.toString()) {
          socketService.sendToUser(participant.user._id.toString(), 'meeting_status_updated', notificationData);
        }
      });
      
      console.log(`📡 Sent meeting ended notifications to ${session.participants.length} participants`);
    }
    
    res.json({
      success: true,
      message: 'Meeting ended successfully',
      session: {
        id: session._id,
        meetingStatus: session.meetingStatus,
        actualEndTime: session.actualEndTime
      }
    });
    
  } catch (err) {
    console.error('End meeting error:', err);
    res.status(500).json({ error: err.message });
  }
}; 