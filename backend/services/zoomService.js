const axios = require('axios');
const cron = require('node-cron');
const User = require('../models/User');
const Session = require('../models/Session');

class ZoomService {
  constructor() {
    this.baseURL = 'https://api.zoom.us/v2';
    this.accountId = process.env.ZOOM_ACCOUNT_ID;
    this.clientId = process.env.ZOOM_CLIENT_ID;
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
    
    // Check if this is a free account (no valid credentials)
    this.isFreeAccount = this.checkIfFreeAccount();
    
    if (this.isFreeAccount) {
      console.log('🔍 Detected free Zoom account - using mock service');
      // Import and use mock service for free accounts
      const MockZoomService = require('./mockZoomService');
      this.mockService = new MockZoomService();
    } else {
      // Validate Zoom credentials on startup for paid accounts
      this.validateCredentials();
      
      cron.schedule('0 */6 * * *', () => {
        this.refreshAllTokens();
      });
    }
  }

  // Check if this is a free account
  checkIfFreeAccount() {
    // For free Zoom accounts (default setting)
    return true;
    
    // For paid Zoom accounts with proper API credentials, change to:
    // return false;
    
    // Original logic for detecting free accounts:
    // return !this.clientId || 
    //        !this.clientSecret || 
    //        this.clientId === 'your_zoom_client_id_here' ||
    //        this.clientSecret === 'your_zoom_client_secret_here';
  }

  // Validate Zoom credentials
  validateCredentials() {
    const missingCredentials = [];
    
    if (!this.clientId || this.clientId === 'your_zoom_client_id_here') {
      missingCredentials.push('ZOOM_CLIENT_ID');
    }
    
    if (!this.clientSecret || this.clientSecret === 'your_zoom_client_secret_here') {
      missingCredentials.push('ZOOM_CLIENT_SECRET');
    }
    
    if (!this.accountId || this.accountId === 'your_zoom_account_id_here') {
      missingCredentials.push('ZOOM_ACCOUNT_ID');
    }
    
    if (missingCredentials.length > 0) {
      console.error('❌ Zoom credentials not configured:', missingCredentials.join(', '));
      console.error('❌ Please set the following environment variables in your .env file:');
      missingCredentials.forEach(cred => {
        console.error(`   - ${cred}`);
      });
      console.error('❌ Zoom functionality will not work until credentials are properly configured.');
    } else {
      console.log('✅ Zoom credentials validated successfully');
    }
  }

  // For Server-to-Server OAuth, we don't need a redirect URL
  // Instead, we generate a JWT token directly
  async generateServerToServerToken() {
    console.log('🔍 Debug Zoom credentials:');
    console.log('  - ZOOM_CLIENT_ID:', process.env.ZOOM_CLIENT_ID);
    console.log('  - ZOOM_CLIENT_SECRET:', process.env.ZOOM_CLIENT_SECRET ? '***SET***' : 'NOT SET');
    console.log('  - ZOOM_ACCOUNT_ID:', process.env.ZOOM_ACCOUNT_ID);
    console.log('  - this.clientId:', this.clientId);
    console.log('  - this.clientSecret:', this.clientSecret ? '***SET***' : 'NOT SET');
    console.log('  - this.accountId:', this.accountId);
    
    // For free accounts, we just mark as connected without real API validation
    if (this.isFreeAccount) {
      console.log('🔍 Free Zoom account detected - enabling free account mode');
      return {
        success: true,
        message: 'Free Zoom account connected successfully. You can create meetings within the app.',
        connectionType: 'free-account'
      };
    }
    
    if (!this.clientId || this.clientId === 'your_zoom_client_id_here') {
      throw new Error('Zoom credentials not configured. Please set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID in your .env file.');
    }

    // For Server-to-Server OAuth, we use the credentials directly
    // No need for OAuth flow with redirect URLs
    return {
      success: true,
      message: 'Server-to-Server OAuth configured successfully'
    };
  }

  // Legacy method for compatibility (will be removed)
  getOAuthURL(redirectUri, state) {
    throw new Error('This app uses Server-to-Server OAuth. No redirect URL needed.');
  }

  async exchangeCodeForTokens(code, redirectUri) {
    try {
      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      };
    } catch (error) {
      console.error('Exchange code for tokens error:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        },
        auth: {
          username: this.clientId,
          password: this.clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Refresh access token error:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async getUserAccessToken(userId) {
    // Cache token in memory for reuse
    if (!this._zoomTokenCache) {
      this._zoomTokenCache = { token: null, expiresAt: 0 };
    }
    const now = Date.now();
    if (this._zoomTokenCache.token && this._zoomTokenCache.expiresAt > now + 60000) {
      // Return cached token if not expiring in next 60s
      console.log('🔍 Using cached Zoom access token');
      return this._zoomTokenCache.token;
    }
    try {
      console.log('🔍 Requesting Zoom Server-to-Server OAuth access token...');
      console.log('🔍 Using credentials - Account ID:', this.accountId);
      console.log('🔍 Using credentials - Client ID:', this.clientId);
      
      const params = new URLSearchParams();
      params.append('grant_type', 'account_credentials');
      params.append('account_id', this.accountId);
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      console.log('🔍 Making OAuth token request to Zoom...');
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        params,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      console.log('✅ Zoom OAuth token response received');
      const { access_token, expires_in } = response.data;
      this._zoomTokenCache.token = access_token;
      this._zoomTokenCache.expiresAt = now + expires_in * 1000;
      console.log('✅ Zoom access token obtained and cached. Expires in', expires_in, 'seconds.');
      return access_token;
    } catch (error) {
      console.error('❌ Failed to obtain Zoom access token:', error.response?.data || error.message);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error headers:', error.response?.headers);
      console.error('❌ Full error:', error);
      throw new Error(`Failed to obtain Zoom access token: ${error.response?.data?.error_description || error.response?.data?.error || error.message}`);
    }
  }

  async createMeeting(userId, sessionData) {
    try {
      console.log('🔍 Creating Zoom meeting with session data:', sessionData);
      
      // Use mock service for free accounts
      if (this.isFreeAccount) {
        console.log('🔍 Using mock service for free Zoom account');
        return await this.mockService.createMeeting(userId, sessionData);
      }
      
      // Validate Zoom credentials for paid accounts
      if (!this.clientId || this.clientId === 'your_zoom_client_id_here' || 
          !this.clientSecret || this.clientSecret === 'your_zoom_client_secret_here' ||
          !this.accountId || this.accountId === 'your_zoom_account_id_here') {
        throw new Error('Zoom credentials not properly configured. Please set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID in your .env file.');
      }
      
      const accessToken = await this.getUserAccessToken(userId);
      console.log('🔍 Generated access token:', accessToken ? 'TOKEN_GENERATED' : 'NO_TOKEN');
      
      if (!accessToken) {
        throw new Error('Failed to generate Zoom access token. Please check your Zoom credentials.');
      }
      
      const meetingData = {
        topic: sessionData.title || `${sessionData.skill} Skill Session`,
        type: sessionData.sessionType === 'group' ? 2 : 1,
        start_time: sessionData.startTime,
        duration: sessionData.duration,
        timezone: sessionData.timezone || 'UTC',
        password: this.generateMeetingPassword(),
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 0,
          audio: 'both',
          auto_recording: 'none',
          waiting_room: true,
          meeting_authentication: true
        }
      };
      
      console.log('🔍 Meeting data prepared:', meetingData);
      
      // For Server-to-Server OAuth, we need to use the account owner's email
      const accountOwnerEmail = process.env.ZOOM_ACCOUNT_EMAIL;
      if (!accountOwnerEmail) {
        throw new Error('ZOOM_ACCOUNT_EMAIL environment variable is not set. Please set it to a valid Zoom user email.');
      }
      console.log('🔍 Using account owner email:', accountOwnerEmail);
      const url = `${this.baseURL}/users/${accountOwnerEmail}/meetings`;
      console.log('🔍 Making request to:', url);
      
      const response = await axios.post(
        url,
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ REAL Zoom meeting created successfully:', response.data);
      
      // Validate that we got a real meeting ID
      if (!response.data.id || response.data.id.toString().startsWith('mock_')) {
        throw new Error('Invalid meeting ID received from Zoom API. Please check your Zoom credentials and account settings.');
      }
      
      return {
        meetingId: response.data.id,
        joinUrl: response.data.join_url,
        startUrl: response.data.start_url,
        password: response.data.password,
        hostEmail: response.data.host_email
      };
    } catch (error) {
      console.error('❌ Create REAL Zoom meeting error:', error);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error message:', error.message);
      
      // Provide more specific error messages
      if (error.response?.status === 401) {
        throw new Error('Zoom authentication failed. Please check your Zoom credentials and try connecting again.');
      } else if (error.response?.status === 403) {
        throw new Error('Zoom access denied. Please check your Zoom account permissions.');
      } else if (error.response?.status === 404) {
        throw new Error('Zoom user not found. Please check your ZOOM_ACCOUNT_EMAIL setting.');
      } else if (error.message.includes('credentials not properly configured')) {
        throw error; // Re-throw the credential error
      } else {
        throw new Error(`Failed to create Zoom meeting: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  async updateMeeting(userId, meetingId, sessionData) {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      const updateData = {
        topic: sessionData.title || `${sessionData.skill} Skill Session`,
        start_time: sessionData.startTime,
        duration: sessionData.duration,
        timezone: sessionData.timezone || 'UTC'
      };
      await axios.patch(
        `${this.baseURL}/meetings/${meetingId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, message: 'Meeting updated successfully' };
    } catch (error) {
      console.error('Update Zoom meeting error:', error);
      throw new Error('Failed to update Zoom meeting');
    }
  }

  async deleteMeeting(userId, meetingId) {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      await axios.delete(
        `${this.baseURL}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      return { success: true, message: 'Meeting deleted successfully' };
    } catch (error) {
      console.error('Delete Zoom meeting error:', error);
      throw new Error('Failed to delete Zoom meeting');
    }
  }

  async getMeetingDetails(userId, meetingId) {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      const response = await axios.get(
        `${this.baseURL}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get meeting details error:', error);
      throw new Error('Failed to get meeting details');
    }
  }

  async getUserMeetings(userId, pageSize = 30, nextPageToken = null) {
    try {
      console.log('📡 Getting user meetings from Zoom API...');
      
      // Use mock service for free accounts
      if (this.isFreeAccount) {
        console.log('🔍 Using mock service for free Zoom account');
        return await this.mockService.getUserMeetings(userId, pageSize, nextPageToken);
      }
      
      const accessToken = await this.getUserAccessToken(userId);
      
      // For Server-to-Server OAuth, we need to use the account owner's email
      const accountOwnerEmail = process.env.ZOOM_ACCOUNT_EMAIL;
      if (!accountOwnerEmail) {
        throw new Error('ZOOM_ACCOUNT_EMAIL environment variable is not set. Please set it to a valid Zoom user email.');
      }
      
      let url = `${this.baseURL}/users/${accountOwnerEmail}/meetings?page_size=${pageSize}`;
      if (nextPageToken) {
        url += `&next_page_token=${nextPageToken}`;
      }
      
      console.log('📡 Request URL:', url);
      console.log('📡 Account owner email:', accountOwnerEmail);
      console.log('📡 Making request to Zoom API...');
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log('✅ Successfully fetched meetings from Zoom API');
      console.log('📊 Response status:', response.status);
      console.log('📊 Found', response.data.meetings?.length || 0, 'meetings');
      
      return {
        meetings: response.data.meetings || [],
        nextPageToken: response.data.next_page_token,
        pageCount: response.data.page_count,
        pageSize: response.data.page_size,
        totalRecords: response.data.total_records
      };
    } catch (error) {
      console.error('❌ Get user meetings error:', error);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error code:', error.code);
      console.error('❌ Is timeout?', error.code === 'ECONNABORTED');
      throw new Error(`Failed to get user meetings: ${error.response?.data?.message || error.message}`);
    }
  }

  async getMeetingParticipants(userId, meetingId) {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      const response = await axios.get(
        `${this.baseURL}/meetings/${meetingId}/participants`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      return response.data.participants;
    } catch (error) {
      console.error('Get meeting participants error:', error);
      throw new Error('Failed to get meeting participants');
    }
  }

  async getMeetingRecording(userId, meetingId) {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      const response = await axios.get(
        `${this.baseURL}/meetings/${meetingId}/recordings`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      return response.data.recording_files;
    } catch (error) {
      console.error('Get meeting recording error:', error);
      throw new Error('Failed to get meeting recording');
    }
  }

  async disconnectUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      user.zoomAccessToken = undefined;
      user.zoomRefreshToken = undefined;
      user.zoomTokenExpiry = undefined;
      await user.save();
      return { success: true, message: 'User disconnected from Zoom' };
    } catch (error) {
      console.error('Disconnect user error:', error);
      throw new Error('Failed to disconnect user from Zoom');
    }
  }

  async refreshAllTokens() {
    try {
      const users = await User.find({
        zoomRefreshToken: { $exists: true, $ne: null }
      });
      for (const user of users) {
        try {
          const newTokens = await this.refreshAccessToken(user.zoomRefreshToken);
          user.zoomAccessToken = newTokens.accessToken;
          user.zoomRefreshToken = newTokens.refreshToken;
          user.zoomTokenExpiry = new Date(Date.now() + newTokens.expiresIn * 1000);
          await user.save();
          console.log(`Refreshed token for user: ${user.email}`);
        } catch (error) {
          console.error(`Failed to refresh token for user ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Refresh all tokens error:', error);
    }
  }

  // Manual sync method for free accounts
  async manualSyncMeeting(userId, meetingDetails) {
    console.log('📋 ZoomService: Manual sync for free account');
    
    if (this.isFreeAccount) {
      // Delegate to mock service for free accounts
      return await this.mockService.manualSyncMeeting(userId, meetingDetails);
    } else {
      // For paid accounts, this could validate against real Zoom API
      // For now, we'll still use the mock service functionality
      const MockZoomService = require('./mockZoomService');
      const tempMockService = new MockZoomService();
      return await tempMockService.manualSyncMeeting(userId, meetingDetails);
    }
  }

  // Auto-sync from invitation for free accounts
  async autoSyncFromInvitation(userId, invitationText) {
    console.log('🤖 ZoomService: Auto-sync from invitation for free account');
    
    if (this.isFreeAccount) {
      // Delegate to mock service for free accounts
      return await this.mockService.autoSyncFromInvitation(userId, invitationText);
    } else {
      // For paid accounts, this could potentially use API to validate
      // For now, we'll still use the mock service functionality
      const MockZoomService = require('./mockZoomService');
      const tempMockService = new MockZoomService();
      return await tempMockService.autoSyncFromInvitation(userId, invitationText);
    }
  }

  generateMeetingPassword() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = new ZoomService(); 