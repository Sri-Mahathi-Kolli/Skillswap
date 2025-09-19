const ZoomToken = require('../models/ZoomToken');
const axios = require('axios');
const crypto = require('crypto');

// Token cache
let cachedAccessToken = null;
let tokenExpiresAt = 0;

const getServerAccessToken = async () => {
  // Return cached token if valid for at least 60 seconds
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  try {
    const response = await axios.post('https://zoom.us/oauth/token', null, {
      params: {
        grant_type: 'account_credentials',
        account_id: process.env.ZOOM_ACCOUNT_ID,
      },
      auth: {
        username: process.env.ZOOM_CLIENT_ID,
        password: process.env.ZOOM_CLIENT_SECRET,
      },
    });

    cachedAccessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
    return cachedAccessToken;
  } catch (err) {
    console.error('❌ Failed to get server access token:', err.response?.data || err.message);
    throw new Error('Zoom access token error');
  }
};

// Refresh Zoom user token
const refreshZoomToken = async (zoomToken, userId) => {
  try {
    const response = await axios.post('https://zoom.us/oauth/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: zoomToken.refreshToken,
      },
      auth: {
        username: process.env.ZOOM_CLIENT_ID,
        password: process.env.ZOOM_CLIENT_SECRET,
      },
    });

    zoomToken.accessToken = response.data.access_token;
    zoomToken.refreshToken = response.data.refresh_token;
    zoomToken.expiresAt = new Date(Date.now() + response.data.expires_in * 1000);
    await zoomToken.save();

    return zoomToken;
  } catch (err) {
    console.error('❌ Failed to refresh Zoom token:', err.response?.data || err.message);
    throw new Error('Failed to refresh Zoom token');
  }
};

// Generate a strong random meeting password (8 chars, alphanumeric)
const generateStrongPassword = () => {
  return crypto.randomBytes(6).toString('base64').replace(/[+/=]/g, '').slice(0, 8);
};

exports.createMeeting = async (req, res) => {
  try {
    const accessToken = await getServerAccessToken();

    if (!req.body.startTime || !req.body.duration) {
      return res.status(400).json({ success: false, message: 'startTime and duration are required' });
    }

    const meetingPassword = req.body.password && req.body.password.length >= 6
      ? req.body.password
      : generateStrongPassword();

    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: req.body.topic || 'SkillSwap Session',
        type: 2,
        start_time: req.body.startTime,
        duration: req.body.duration,
        timezone: req.body.timezone || 'UTC',
        password: meetingPassword,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          approval_type: 0,
          audio: 'both',
          auto_recording: 'none',
          meeting_authentication: false,
        },
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json({ join_url: response.data.join_url, meetingId: response.data.id, password: meetingPassword });
  } catch (err) {
    console.error('❌ Zoom API error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Zoom meeting creation failed' });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const accessToken = await getServerAccessToken();

    if (!req.params.id) {
      return res.status(400).json({ success: false, message: 'Meeting ID is required' });
    }

    await axios.delete(`https://api.zoom.us/v2/meetings/${req.params.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    console.error('❌ Zoom meeting deletion error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Failed to delete Zoom meeting' });
  }
};

exports.refreshZoomToken = refreshZoomToken;
