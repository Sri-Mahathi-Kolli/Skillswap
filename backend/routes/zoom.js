const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const zoomService = require('../services/zoomService');
const User = require('../models/User');
const Session = require('../models/Session');

const router = express.Router();

// Connect to Zoom using Server-to-Server OAuth
router.get('/oauth-url', verifyToken, async (req, res) => {
  try {
    const result = await zoomService.generateServerToServerToken();
    
    // Mark user as connected to Zoom
    const user = await User.findById(req.userId);
    if (user) {
      user.zoomConnected = true;
      user.zoomConnectionType = 'server-to-server';
      await user.save();
    }

    res.json({
      success: true,
      data: {
        message: 'Connected to Zoom using Server-to-Server OAuth',
        connectionType: 'server-to-server'
      }
    });

  } catch (error) {
    console.error('Connect to Zoom error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to connect to Zoom'
    });
  }
});

// OAuth callback handler
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code and state are required'
      });
    }

    // Verify state matches user ID
    const userId = state;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter'
      });
    }

    const redirectUri = `${process.env.BACKEND_URL}/api/zoom/oauth/callback`;
    
    // Exchange code for tokens
    const tokens = await zoomService.exchangeCodeForTokens(code, redirectUri);
    
    // Save tokens to user
    user.zoomAccessToken = tokens.accessToken;
    user.zoomRefreshToken = tokens.refreshToken;
    user.zoomTokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);
    await user.save();

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    res.redirect(`${frontendUrl}/profile?zoom=success`);

  } catch (error) {
    console.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    res.redirect(`${frontendUrl}/profile?zoom=error`);
  }
});

// Create Zoom meeting for session
router.post('/create-meeting', [
  verifyToken,
  body('sessionId').isMongoId().withMessage('Valid session ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { sessionId } = req.body;

    // Check if user is the host of the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.host.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the session host can create Zoom meetings'
      });
    }

    // Create Zoom meeting
    const meetingData = {
      title: session.title,
      skill: session.skill,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      timezone: session.timezone,
      sessionType: session.sessionType
    };

    const meeting = await zoomService.createMeeting(req.userId, meetingData);

    // Update session with Zoom meeting details
    session.zoomMeeting = {
      meetingId: meeting.meetingId,
      joinUrl: meeting.joinUrl,
      startUrl: meeting.startUrl,
      password: meeting.password
    };
    await session.save();

    res.json({
      success: true,
      data: meeting
    });

  } catch (error) {
    console.error('Create Zoom meeting error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create Zoom meeting'
    });
  }
});

// Update Zoom meeting
router.put('/meetings/:meetingId', [
  verifyToken,
  body('sessionId').isMongoId().withMessage('Valid session ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { meetingId } = req.params;
    const { sessionId } = req.body;

    // Check if user is the host of the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.host.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the session host can update Zoom meetings'
      });
    }

    // Update Zoom meeting
    const meetingData = {
      title: session.title,
      skill: session.skill,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      timezone: session.timezone
    };

    await zoomService.updateMeeting(req.userId, meetingId, meetingData);

    res.json({
      success: true,
      message: 'Meeting updated successfully'
    });

  } catch (error) {
    console.error('Update Zoom meeting error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update Zoom meeting'
    });
  }
});

// Delete Zoom meeting
router.delete('/meetings/:meetingId', [
  verifyToken,
  body('sessionId').isMongoId().withMessage('Valid session ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { meetingId } = req.params;
    const { sessionId } = req.body;

    // Check if user is the host of the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.host.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the session host can delete Zoom meetings'
      });
    }

    // Delete Zoom meeting
    await zoomService.deleteMeeting(req.userId, meetingId);

    // Remove Zoom meeting details from session
    session.zoomMeeting = undefined;
    await session.save();

    res.json({
      success: true,
      message: 'Meeting deleted successfully'
    });

  } catch (error) {
    console.error('Delete Zoom meeting error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete Zoom meeting'
    });
  }
});

// Get meeting details
router.get('/meetings/:meetingId', verifyToken, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meetingDetails = await zoomService.getMeetingDetails(req.userId, meetingId);

    res.json({
      success: true,
      data: meetingDetails
    });

  } catch (error) {
    console.error('Get meeting details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get meeting details'
    });
  }
});

// Get user's meetings
router.get('/meetings', verifyToken, async (req, res) => {
  try {
    const { pageSize = 30, nextPageToken } = req.query;

    const meetings = await zoomService.getUserMeetings(
      req.userId,
      parseInt(pageSize),
      nextPageToken
    );

    res.json({
      success: true,
      data: meetings
    });

  } catch (error) {
    console.error('Get user meetings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user meetings'
    });
  }
});

// Get meeting participants
router.get('/meetings/:meetingId/participants', verifyToken, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const participants = await zoomService.getMeetingParticipants(req.userId, meetingId);

    res.json({
      success: true,
      data: participants
    });

  } catch (error) {
    console.error('Get meeting participants error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get meeting participants'
    });
  }
});

// Get meeting recording
router.get('/meetings/:meetingId/recording', verifyToken, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const recordings = await zoomService.getMeetingRecording(req.userId, meetingId);

    res.json({
      success: true,
      data: recordings
    });

  } catch (error) {
    console.error('Get meeting recording error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get meeting recording'
    });
  }
});

// Disconnect Zoom account
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    await zoomService.disconnectUser(req.userId);

    res.json({
      success: true,
      message: 'Zoom account disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect Zoom error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to disconnect Zoom account'
    });
  }
});

// Get Zoom connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    const isConnected = !!(user.zoomAccessToken && user.zoomRefreshToken);
    const isExpired = isConnected && user.zoomTokenExpiry < new Date();

    res.json({
      success: true,
      data: {
        isConnected,
        isExpired,
        lastConnected: user.zoomTokenExpiry
      }
    });

  } catch (error) {
    console.error('Get Zoom status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Zoom connection status'
    });
  }
});

// Refresh Zoom token manually
router.post('/refresh-token', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.zoomRefreshToken) {
      return res.status(400).json({
        success: false,
        message: 'No Zoom refresh token found'
      });
    }

    const newTokens = await zoomService.refreshAccessToken(user.zoomRefreshToken);
    
    user.zoomAccessToken = newTokens.accessToken;
    user.zoomRefreshToken = newTokens.refreshToken;
    user.zoomTokenExpiry = new Date(Date.now() + newTokens.expiresIn * 1000);
    await user.save();

    res.json({
      success: true,
      message: 'Zoom token refreshed successfully'
    });

  } catch (error) {
    console.error('Refresh Zoom token error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to refresh Zoom token'
    });
  }
});

// Zoom webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-zoom-signature'];
    const timestamp = req.headers['x-zoom-timestamp'];
    const payload = req.body;

    // Validate webhook signature
    const isValid = zoomService.validateWebhookSignature(payload, signature, timestamp);
    
    if (!isValid) {
      console.error('Invalid Zoom webhook signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    // Parse the payload
    const event = JSON.parse(payload);

    // Handle the webhook event
    await zoomService.handleWebhook(event);

    res.json({ received: true });

  } catch (error) {
    console.error('Zoom webhook handling error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook handling failed'
    });
  }
});

// Get Zoom settings
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const settings = {
      maxParticipants: 100,
      recordingEnabled: true,
      waitingRoomEnabled: true,
      joinBeforeHost: false,
      muteUponEntry: true,
      autoRecording: 'none',
      watermark: false,
      meetingAuthentication: true,
      audioOptions: ['both', 'telephony', 'computer_audio'],
      videoOptions: ['both', 'host_only', 'participants_only']
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get Zoom settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Zoom settings'
    });
  }
});

// Test Zoom connection
router.post('/test-connection', verifyToken, async (req, res) => {
  try {
    // Try to get user's meetings to test connection
    const meetings = await zoomService.getUserMeetings(req.userId, 1);
    
    res.json({
      success: true,
      message: 'Zoom connection is working',
      data: {
        canCreateMeetings: true,
        canJoinMeetings: true,
        canRecord: true
      }
    });

  } catch (error) {
    console.error('Test Zoom connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Zoom connection test failed',
      error: error.message
    });
  }
});

// Smart join meeting endpoint
router.post('/join-meeting', verifyToken, async (req, res) => {
  try {
    const { meetingId, sessionId } = req.body;
    const userId = req.userId;

    // Get meeting details
    const meetingDetails = await zoomService.getMeetingDetails(userId, meetingId);
    if (!meetingDetails) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user is host
    const isHost = meetingDetails.hostEmail === user.email;

    // Prepare join data
    const joinData = {
      meetingId,
      sessionId,
      userId,
      userEmail: user.email,
      userName: user.name,
      isHost,
      joinUrl: meetingDetails.joinUrl,
      startUrl: isHost ? meetingDetails.startUrl : null,
      password: meetingDetails.password,
      joinTime: new Date()
    };

    // Log join attempt
    console.log('Join attempt:', joinData);

    // Return appropriate URL based on user role
    const response = {
      success: true,
      data: {
        joinUrl: isHost && meetingDetails.startUrl ? meetingDetails.startUrl : meetingDetails.joinUrl,
        isHost,
        meetingId,
        sessionId
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Join meeting error:', error);
    res.status(500).json({ success: false, message: 'Failed to join meeting' });
  }
});

// Get meeting join status
router.get('/meeting-status/:meetingId', verifyToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.userId;

    const meetingDetails = await zoomService.getMeetingDetails(userId, meetingId);
    if (!meetingDetails) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const now = new Date();
    const meetingStart = new Date(meetingDetails.startTime);
    const meetingEnd = new Date(meetingStart.getTime() + meetingDetails.duration * 60000);
    const earlyJoinTime = new Date(meetingStart.getTime() - 5 * 60000);

    let status = 'unknown';
    let message = '';
    let canJoin = false;

    if (now < earlyJoinTime) {
      status = 'waiting';
      const timeUntilStart = Math.ceil((meetingStart.getTime() - now.getTime()) / 60000);
      message = `Meeting starts in ${timeUntilStart} minutes`;
    } else if (now >= earlyJoinTime && now <= meetingEnd) {
      status = 'ready';
      message = 'Meeting is ready to join';
      canJoin = true;
    } else {
      status = 'ended';
      message = 'Meeting has ended';
    }

    res.json({
      success: true,
      data: {
        status,
        message,
        canJoin,
        meetingStart: meetingDetails.startTime,
        meetingEnd: meetingEnd.toISOString(),
        duration: meetingDetails.duration
      }
    });

  } catch (error) {
    console.error('Get meeting status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get meeting status' });
  }
});

// Sync Zoom meetings from external Zoom account to database
router.post('/sync-meetings', verifyToken, async (req, res) => {
  try {
    console.log('🔄 Starting Zoom meetings sync for user:', req.userId);

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('🔍 Current user zoomConnected status:', user.zoomConnected);

    // For Server-to-Server OAuth, we can automatically connect the user
    // since no user interaction is required
    if (!user.zoomConnected) {
      console.log('🔗 User not connected to Zoom, attempting to connect with Server-to-Server OAuth...');
      try {
        // Test the connection by trying to generate a token
        await zoomService.generateServerToServerToken();
        
        // Mark user as connected to Zoom
        user.zoomConnected = true;
        user.zoomConnectionType = 'server-to-server';
        await user.save();
        
        console.log('✅ Successfully connected user to Zoom via Server-to-Server OAuth');
      } catch (connectError) {
        console.error('❌ Failed to connect to Zoom:', connectError);
        return res.status(400).json({
          success: false,
          message: 'Failed to connect to Zoom. Please check Zoom credentials configuration.'
        });
      }
    }

    // Get meetings from Zoom
    console.log('📡 Fetching meetings from Zoom API...');
    const zoomMeetings = await zoomService.getUserMeetings(req.userId, 100); // Get up to 100 meetings

    if (!zoomMeetings.meetings || zoomMeetings.meetings.length === 0) {
      return res.json({
        success: true,
        data: {
          syncedMeetings: [],
          message: 'No meetings found in your Zoom account to sync'
        }
      });
    }

    console.log(`📊 Found ${zoomMeetings.meetings.length} meetings in Zoom account`);

    const syncedMeetings = [];
    
    // Process each Zoom meeting
    for (const zoomMeeting of zoomMeetings.meetings) {
      try {
        // Check if this meeting is already in our database by join URL (more unique than meeting ID)
        const existingSession = await Session.findOne({
          $or: [
            { 'zoomMeeting.meetingId': zoomMeeting.id.toString() },
            { 'zoomMeeting.joinUrl': zoomMeeting.join_url }
          ]
        });

        if (existingSession) {
          console.log(`⏭️ Meeting ${zoomMeeting.id} already exists in database, skipping`);
          continue;
        }

        // Create a new session from the Zoom meeting
        const sessionData = {
          title: zoomMeeting.topic || 'Zoom Meeting',
          description: `Synced from Zoom: ${zoomMeeting.topic}\n\nMeeting ID: ${zoomMeeting.id}`,
          skill: 'general', // Default skill for synced meetings
          startTime: new Date(zoomMeeting.start_time),
          endTime: new Date(new Date(zoomMeeting.start_time).getTime() + (zoomMeeting.duration * 60 * 1000)),
          duration: zoomMeeting.duration,
          timezone: zoomMeeting.timezone || 'UTC',
          host: req.userId,
          price: 0,
          currency: 'usd',
          sessionType: 'one-on-one',
          maxParticipants: 10,
          difficulty: 'beginner',
          status: 'scheduled',
          participants: [],
          zoomMeeting: {
            meetingId: zoomMeeting.id.toString(),
            joinUrl: zoomMeeting.join_url,
            startUrl: zoomMeeting.start_url,
            password: zoomMeeting.password
          },
          tags: ['synced-from-zoom'],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Create the session
        const newSession = new Session(sessionData);
        await newSession.save();

        console.log(`✅ Synced meeting: ${zoomMeeting.topic} (ID: ${zoomMeeting.id})`);
        syncedMeetings.push({
          meetingId: zoomMeeting.id,
          title: zoomMeeting.topic,
          startTime: zoomMeeting.start_time,
          sessionId: newSession._id
        });

      } catch (meetingError) {
        console.error(`❌ Error syncing meeting ${zoomMeeting.id}:`, meetingError);
        // Continue with next meeting instead of failing entire sync
      }
    }

    console.log(`🎉 Sync completed. Synced ${syncedMeetings.length} meetings`);

    res.json({
      success: true,
      data: {
        syncedMeetings,
        message: `Successfully synced ${syncedMeetings.length} Zoom meeting(s) to your calendar`
      }
    });

  } catch (error) {
    console.error('❌ Sync Zoom meetings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync Zoom meetings'
    });
  }
});

// Manual sync for free accounts - allows users to input their Zoom meeting details
router.post('/sync-manual', [
  verifyToken,
  body('topic').trim().isLength({ min: 1 }).withMessage('Meeting topic is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('duration').isInt({ min: 1, max: 480 }).withMessage('Duration must be between 1 and 480 minutes'),
  body('meetingId').optional().trim(),
  body('joinUrl').optional().isURL().withMessage('Join URL must be a valid URL'),
  body('password').optional().trim()
], async (req, res) => {
  try {
    console.log('🔄 Manual sync Zoom meeting for free account...');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      topic, 
      startTime, 
      duration, 
      meetingId, 
      joinUrl, 
      password,
      timezone = 'UTC'
    } = req.body;

    // Get user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('📋 Manual sync details:', { topic, startTime, duration, meetingId });

    // Check if this meeting already exists by checking join URL (unique per meeting instance)
    if (joinUrl) {
      const existingSession = await Session.findOne({
        'zoomMeeting.joinUrl': joinUrl,
        host: req.userId
      });

      if (existingSession) {
        return res.status(409).json({
          success: false,
          message: 'This meeting is already synced to your calendar'
        });
      }
    }

    // Use mock service for free accounts to handle the meeting details
    const mockResult = await zoomService.manualSyncMeeting(req.userId, {
      topic,
      startTime,
      duration,
      meetingId,
      joinUrl,
      password,
      timezone
    });

    if (!mockResult.success) {
      return res.status(400).json({
        success: false,
        message: mockResult.message || 'Failed to process meeting details'
      });
    }

    const zoomMeeting = mockResult.meeting;

    // Create a new session from the manually entered meeting details
    const sessionData = {
      title: zoomMeeting.topic,
      description: `Manually synced from Zoom: ${zoomMeeting.topic}\n\nMeeting ID: ${zoomMeeting.id}`,
      skill: 'general',
      startTime: new Date(zoomMeeting.start_time),
      endTime: new Date(new Date(zoomMeeting.start_time).getTime() + (zoomMeeting.duration * 60 * 1000)),
      duration: zoomMeeting.duration,
      timezone: zoomMeeting.timezone,
      host: req.userId,
      price: 0,
      currency: 'usd',
      sessionType: 'one-on-one',
      maxParticipants: 10,
      difficulty: 'beginner',
      status: 'scheduled',
      participants: [],
      zoomMeeting: {
        meetingId: zoomMeeting.id.toString(),
        joinUrl: zoomMeeting.join_url,
        startUrl: zoomMeeting.start_url || zoomMeeting.join_url,
        password: zoomMeeting.password
      },
      tags: ['manual-sync', 'free-zoom-account'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create the session
    const newSession = new Session(sessionData);
    await newSession.save();

    console.log(`✅ Manually synced meeting: ${zoomMeeting.topic} (ID: ${zoomMeeting.id})`);

    res.json({
      success: true,
      data: {
        session: newSession,
        meeting: zoomMeeting,
        message: 'Meeting successfully synced to your calendar'
      }
    });

  } catch (error) {
    console.error('❌ Manual sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to manually sync meeting'
    });
  }
});

// Auto-sync from Zoom invitation for free accounts
router.post('/sync-invitation', [
  verifyToken,
  body('invitationText').trim().isLength({ min: 10 }).withMessage('Meeting invitation text is required')
], async (req, res) => {
  try {
    console.log('🤖 Auto-sync from Zoom invitation for free account...');
    console.log('📋 Received invitation text:', req.body.invitationText);
    console.log('📋 Invitation text length:', req.body.invitationText?.length);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { invitationText } = req.body;

    // Get user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('📋 Processing invitation text...');

    // Use mock service for free accounts to parse invitation
    const mockResult = await zoomService.autoSyncFromInvitation(req.userId, invitationText);

    if (!mockResult.success) {
      return res.status(400).json({
        success: false,
        message: mockResult.message || 'Failed to process invitation'
      });
    }

    const zoomMeeting = mockResult.meeting;

    // Check if this meeting already exists by checking the join URL (unique per meeting instance)
    if (zoomMeeting.join_url) {
      const existingSession = await Session.findOne({
        'zoomMeeting.joinUrl': zoomMeeting.join_url,
        host: req.userId
      });

      if (existingSession) {
        // Instead of rejecting, let's update the existing session with new attendees
        console.log('🔄 Found existing session, updating with new attendee information...');
        
        const updatedAttendeeEmails = mockResult.extractedData?.attendeeEmails || [];
        console.log('📧 New attendee emails:', updatedAttendeeEmails);
        console.log('📧 Existing attendee emails:', existingSession.attendeeEmails || []);
        
        // Merge existing and new attendee emails (avoid duplicates)
        const allEmails = [...(existingSession.attendeeEmails || []), ...updatedAttendeeEmails];
        const uniqueEmails = [...new Set(allEmails.map(email => email.toLowerCase()))];
        
        console.log('📧 Merged unique emails:', uniqueEmails);
        
        // Process any new attendees
        const existingParticipantEmails = existingSession.participants.map(p => p.email).filter(Boolean);
        const newEmails = uniqueEmails.filter(email => !existingParticipantEmails.includes(email));
        
        if (newEmails.length > 0) {
          console.log('👥 Processing new attendees:', newEmails);
          
          for (const email of newEmails) {
            try {
              // Try to find existing user by email
              let participant = await User.findOne({ email: email.toLowerCase() });
              
              if (participant) {
                console.log(`✅ Found existing user for email ${email}: ${participant.name}`);
                existingSession.participants.push({
                  user: participant._id,
                  email: email.toLowerCase(),
                  role: 'learner'
                });
              } else {
                // Create a placeholder user for the email
                console.log(`📝 Creating placeholder user for email: ${email}`);
                const emailName = email.split('@')[0];
                const nameParts = emailName.split(/[._-]/);
                
                const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Guest';
                const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
                const fullName = `${firstName} ${lastName}`;
                
                participant = new User({
                  name: fullName,
                  email: email.toLowerCase(),
                  password: 'placeholder_password_123',
                  bio: 'User invited to meeting via Zoom invitation update',
                  isPlaceholder: true,
                  placeholderReason: 'extracted_from_zoom_invitation_update',
                  createdAt: new Date()
                });
                
                await participant.save();
                console.log(`✅ Created placeholder user: ${fullName} (${email})`);
                existingSession.participants.push({
                  user: participant._id,
                  email: email.toLowerCase(),
                  role: 'learner'
                });
              }
            } catch (emailError) {
              console.error(`⚠️ Error processing new email ${email}:`, emailError.message);
            }
          }
          
          // Update the attendee emails list
          existingSession.attendeeEmails = uniqueEmails;
          existingSession.updatedAt = new Date();
          
          // Add update tag
          if (!existingSession.tags.includes('attendees-updated')) {
            existingSession.tags.push('attendees-updated');
          }
          
          await existingSession.save();
          
          // Populate the session with user details
          await existingSession.populate([
            { path: 'host', select: 'name email photo' },
            { path: 'participants.user', select: 'name email photo' }
          ]);
          
          console.log(`✅ Updated existing session with ${newEmails.length} new attendees`);
          
          return res.json({
            success: true,
            data: {
              session: existingSession,
              meeting: zoomMeeting,
              extractedData: mockResult.extractedData,
              message: `Meeting updated with ${newEmails.length} new attendee(s). Total attendees: ${existingSession.participants.length}`,
              updateType: 'attendees_added'
            }
          });
        } else {
          // No new attendees found
          console.log('ℹ️ No new attendees found in updated invitation');
          
          return res.json({
            success: true,
            data: {
              session: existingSession,
              meeting: zoomMeeting,
              extractedData: mockResult.extractedData,
              message: 'Meeting invitation processed - no new attendees found',
              updateType: 'no_changes'
            }
          });
        }
      }
    }

    // Create a new session from the auto-extracted invitation details
    // Determine the user's role and create appropriate description
    let description, hostInfo;
    
    if (zoomMeeting.hostName && zoomMeeting.hostName !== user.name) {
      // User is an attendee, original host is someone else
      description = `Auto-synced from Zoom invitation: ${zoomMeeting.topic}\n\nMeeting ID: ${zoomMeeting.id}\n\nHost: ${zoomMeeting.hostName}\n\nYour role: Attendee`;
      hostInfo = `Attending meeting hosted by ${zoomMeeting.hostName}`;
    } else {
      // User is the host - show their actual profile name
      description = `Auto-synced from Zoom invitation: ${zoomMeeting.topic}\n\nMeeting ID: ${zoomMeeting.id}\n\nHost: ${user.name || 'User'}`;
      hostInfo = `Hosting meeting`;
    }
    
    const sessionData = {
      title: zoomMeeting.topic,
      description: description,
      skill: 'general',
      startTime: new Date(zoomMeeting.start_time),
      endTime: new Date(new Date(zoomMeeting.start_time).getTime() + (zoomMeeting.duration * 60 * 1000)),
      duration: zoomMeeting.duration,
      timezone: zoomMeeting.timezone,
      host: req.userId, // Current user is always the host in our system for tracking purposes
      price: 0,
      currency: 'usd',
      sessionType: 'one-on-one',
      maxParticipants: 10,
      difficulty: 'beginner',
      status: 'scheduled',
      participants: [], // Will be populated with attendee emails
      attendeeEmails: mockResult.extractedData?.attendeeEmails || [], // Store extracted emails
      originalInvitationHost: zoomMeeting.hostName || null, // Store original host if mentioned
      userRole: zoomMeeting.hostName && zoomMeeting.hostName !== user.name ? 'attendee' : 'host', // Track user's actual role
      displayHostName: zoomMeeting.hostName && zoomMeeting.hostName !== user.name ? zoomMeeting.hostName : user.name, // Host name for display
      zoomMeeting: {
        meetingId: zoomMeeting.id.toString(),
        joinUrl: zoomMeeting.join_url,
        startUrl: zoomMeeting.start_url || zoomMeeting.join_url,
        password: zoomMeeting.password
      },
      tags: [
        'auto-sync', 
        'invitation-parsed', 
        'free-zoom-account', 
        zoomMeeting.hostName && zoomMeeting.hostName !== user.name ? 'user-as-attendee' : 'user-as-host'
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create the session
    const newSession = new Session(sessionData);
    
    // Process attendee emails if any were extracted
    if (sessionData.attendeeEmails && sessionData.attendeeEmails.length > 0) {
      console.log('📧 Processing attendee emails:', sessionData.attendeeEmails);
      
      const participantObjects = [];
      
      for (const email of sessionData.attendeeEmails) {
        try {
          // Try to find existing user by email
          let participant = await User.findOne({ email: email.toLowerCase() });
          
          if (participant) {
            console.log(`✅ Found existing user for email ${email}: ${participant.name}`);
            participantObjects.push({
              user: participant._id,
              email: email.toLowerCase(),
              role: 'learner'
            });
          } else {
            // Create a placeholder user for the email
            console.log(`📝 Creating placeholder user for email: ${email}`);
            const emailName = email.split('@')[0];
            const nameParts = emailName.split(/[._-]/);
            
            const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Guest';
            const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
            const fullName = `${firstName} ${lastName}`;
            
            participant = new User({
              name: fullName, // Use 'name' field as required by User model
              email: email.toLowerCase(),
              password: 'placeholder_password_123', // Required field - will be reset when they register
              bio: 'User invited to meeting via Zoom invitation',
              isPlaceholder: true, // Mark as placeholder until they register
              placeholderReason: 'extracted_from_zoom_invitation',
              createdAt: new Date()
            });
            
            await participant.save();
            console.log(`✅ Created placeholder user: ${fullName} (${email})`);
            participantObjects.push({
              user: participant._id,
              email: email.toLowerCase(),
              role: 'learner'
            });
          }
        } catch (emailError) {
          console.error(`⚠️ Error processing email ${email}:`, emailError.message);
          // Continue with other emails even if one fails
        }
      }
      
      // Add the participant objects to the session
      newSession.participants = participantObjects;
      console.log(`✅ Added ${participantObjects.length} participants to session`);
    }
    
    await newSession.save();

    // Populate the session with user details before sending response
    await newSession.populate([
      { path: 'host', select: 'name email photo' },
      { path: 'participants.user', select: 'name email photo' }
    ]);

    console.log(`✅ Auto-synced meeting from invitation: ${zoomMeeting.topic} (ID: ${zoomMeeting.id})`);
    console.log(`📊 Session created with ${newSession.participants.length} participants`);

    res.json({
      success: true,
      data: {
        session: newSession,
        meeting: zoomMeeting,
        extractedData: mockResult.extractedData,
        message: 'Meeting automatically synced from Zoom invitation'
      }
    });

  } catch (error) {
    console.error('❌ Auto-sync from invitation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to auto-sync from invitation'
    });
  }
});

module.exports = router; 