/**
 * Mock Zoom Service for Free Accounts
 * 
 * This service provides meeting functionality for free Zoom accounts
 * by generating valid meeting URLs without requiring API access.
 */

class MockZoomService {
  constructor() {
    this.baseURL = 'https://zoom.us';
  }

  /**
   * Create a mock m    // Extract attendee emails from the invitation text with enhanced patterns
    console.log('🔍 Searching for emails in invitation text...');
    
    // More comprehensive email pattern
    const emailPattern = /\b[a-zA-Z0-9]([a-zA-Z0-9._%-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}\b/g;
    const foundEmails = invitationText.match(emailPattern) || [];
    
    console.log('📧 All emails found:', foundEmails);
    
    // Filter out obvious system emails and duplicates
    const systemEmailPatterns = [
      /noreply/i,
      /no-reply/i,
      /support/i,
      /admin/i,
      /system/i,
      /zoom\.us$/i,
      /zoomcrc\.com$/i,
      /donotreply/i,
      /^\d+@/i // Filter out emails that start with numbers (like meeting IDs)
    ];
    
    // Clean and deduplicate emails
    const cleanEmails = foundEmails
      .map(email => email.toLowerCase().trim())
      .filter(email => {
        // Filter out system emails
        const isSystemEmail = systemEmailPatterns.some(pattern => pattern.test(email));
        if (isSystemEmail) {
          console.log(`🚫 Filtered out system email: ${email}`);
          return false;
        }
        return true;
      });
    
    // Remove duplicates
    extracted.attendeeEmails = [...new Set(cleanEmails)];
    
    console.log('✅ Final extracted attendee emails:', extracted.attendeeEmails);
    console.log(`📊 Found ${extracted.attendeeEmails.length} attendee email(s)`);ith free Zoom accounts
   */
  async createMeeting(userId, sessionData) {
    try {
      console.log('🔍 Creating mock Zoom meeting for free account');
      
      // Generate a unique meeting ID
      const meetingId = this.generateMeetingId();
      const password = this.generatePassword();
      
      // Create meeting data
      const meeting = {
        id: meetingId,
        topic: sessionData.topic || 'SkillSwap Session',
        type: 1, // Instant meeting
        start_time: sessionData.startTime || new Date().toISOString(),
        duration: sessionData.duration || 60,
        password: password,
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
          waiting_room: true
        },
        join_url: `https://zoom.us/j/${meetingId}?pwd=${password}`,
        start_url: `https://zoom.us/s/${meetingId}?pwd=${password}`,
        created_at: new Date().toISOString()
      };

      console.log('✅ Mock meeting created successfully');
      console.log(`   Meeting ID: ${meeting.id}`);
      console.log(`   Join URL: ${meeting.join_url}`);
      console.log(`   Start URL: ${meeting.start_url}`);

      return {
        success: true,
        meeting: meeting,
        message: 'Meeting created successfully (Free account mode)'
      };

    } catch (error) {
      console.error('❌ Error creating mock meeting:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create meeting'
      };
    }
  }

  /**
   * Generate a valid Zoom meeting ID
   */
  generateMeetingId() {
    // Zoom meeting IDs are typically 9-11 digits
    const min = 100000000; // 9 digits
    const max = 99999999999; // 11 digits
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate a meeting password
   */
  generatePassword() {
    // Generate a 6-character alphanumeric password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 6; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Get meeting info
   */
  async getMeeting(meetingId) {
    return {
      id: meetingId,
      topic: 'SkillSwap Session',
      join_url: `https://zoom.us/j/${meetingId}`,
      start_url: `https://zoom.us/s/${meetingId}`
    };
  }

  /**
   * Delete meeting (mock - no actual deletion needed)
   */
  async deleteMeeting(meetingId) {
    console.log(`🗑️ Mock meeting ${meetingId} deleted`);
    return { success: true, message: 'Meeting deleted successfully' };
  }

  /**
   * Get user meetings (enhanced for free accounts)
   * Allows users to manually input their Zoom meeting details to sync with calendar
   */
  async getUserMeetings(userId, pageSize = 30, nextPageToken = null) {
    console.log('📡 Mock: Getting user meetings for free account...');
    console.log('ℹ️ Free Zoom accounts: Providing manual sync capability');
    
    // For free accounts, we provide a way to manually sync meetings
    // This will be enhanced with a form where users can input their meeting details
    return {
      meetings: [],
      nextPageToken: null,
      pageCount: 0,
      pageSize: pageSize,
      totalRecords: 0,
      message: 'Free Zoom accounts: Ready to manually sync meetings. Please provide your meeting details.',
      freeAccountFeatures: {
        manualSync: true,
        supportedFields: [
          'meetingId',
          'topic',
          'startTime',
          'duration',
          'joinUrl',
          'password'
        ]
      }
    };
  }

  /**
   * Enhanced manual sync method for free accounts
   * Automatically extracts meeting details from Zoom join URLs
   */
  async manualSyncMeeting(userId, meetingDetails) {
    console.log('📋 MockZoomService: Enhanced manual sync for user:', userId);
    console.log('📋 Meeting details:', meetingDetails);
    
    try {
      // Validate required fields
      const requiredFields = ['topic', 'startTime'];
      const missingFields = requiredFields.filter(field => !meetingDetails[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Auto-extract meeting details from join URL if provided
      let extractedDetails = this.extractMeetingDetailsFromUrl(meetingDetails.joinUrl);
      
      // Create a standardized meeting object
      const meeting = {
        id: meetingDetails.meetingId || extractedDetails.meetingId || this.generateMeetingId(),
        topic: meetingDetails.topic,
        start_time: meetingDetails.startTime,
        duration: meetingDetails.duration || 60,
        join_url: meetingDetails.joinUrl || `https://zoom.us/j/${meetingDetails.meetingId || extractedDetails.meetingId || this.generateMeetingId()}`,
        password: meetingDetails.password || extractedDetails.password || null,
        host_id: userId,
        created_at: new Date().toISOString(),
        timezone: meetingDetails.timezone || 'UTC',
        type: 2, // Scheduled meeting
        status: 'waiting',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true
        },
        // Store original user input for reference
        userInput: {
          originalUrl: meetingDetails.joinUrl,
          extractedData: extractedDetails,
          syncMethod: 'manual_free_account'
        }
      };

    console.log('✅ Enhanced manual meeting sync completed');
    console.log(`   Meeting ID: ${meeting.id}`);
    console.log(`   Topic: ${meeting.topic}`);
    console.log(`   Join URL: ${meeting.join_url}`);
    console.log(`   Auto-extracted: ${JSON.stringify(extractedDetails)}`);

    return {
      success: true,
      meeting: meeting,
      extractedDetails: extractedDetails,
      message: 'Meeting synced successfully from your Zoom account with auto-extracted details'
    };

  } catch (error) {
    console.error('❌ Error in enhanced manual sync:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to sync meeting details'
    };
  }
}

/**
 * Auto-sync method for free accounts using meeting invitation data
 * This method can process Zoom meeting invitations and extract details
 */
async autoSyncFromInvitation(userId, invitationData) {
  console.log('🤖 MockZoomService: Auto-sync from invitation for user:', userId);
  
  try {
    const extracted = this.parseZoomInvitation(invitationData);
    
    if (!extracted.topic || !extracted.startTime) {
      throw new Error('Could not extract meeting details from invitation');
    }

    // Create meeting object from extracted data
    const meeting = {
      id: extracted.meetingId || this.generateMeetingId(),
      topic: extracted.topic,
      start_time: extracted.startTime,
      duration: extracted.duration || 60,
      join_url: extracted.joinUrl,
      password: extracted.password,
      host_id: extracted.isUserHost ? userId : null,
      created_at: new Date().toISOString(),
      timezone: extracted.timezone || 'UTC',
      type: 2,
      status: 'waiting',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true
      },
      autoExtracted: true,
      isUserHost: extracted.isUserHost,
      hostName: extracted.hostName,
      sourceData: {
        method: 'invitation_parsing',
        originalInvitation: invitationData
      }
    };

    console.log('✅ Auto-sync from invitation completed');
    return {
      success: true,
      meeting: meeting,
      extractedData: extracted,
      message: 'Meeting automatically synced from Zoom invitation'
    };

  } catch (error) {
    console.error('❌ Error in auto-sync from invitation:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to auto-sync from invitation'
    };
  }
}

/**
 * Parse Zoom meeting invitation text/email
 * Extracts meeting details from common Zoom invitation formats
 */
parseZoomInvitation(invitationText) {
  console.log('🔍 Parsing invitation text:', invitationText.substring(0, 200) + '...');
  
  const extracted = {
    topic: null,
    startTime: null,
    duration: null,
    joinUrl: null,
    meetingId: null,
    password: null,
    timezone: null,
    hostName: null,
    isUserHost: false, // Will be determined based on invitation content
    attendeeEmails: []
  };

  if (!invitationText || typeof invitationText !== 'string') {
    console.log('❌ Invalid invitation text provided');
    return extracted;
  }

  try {
    // Detect if user is the actual host or an attendee
    const invitingMatch = invitationText.match(/(.+?)\s+is inviting you to/i);
    if (invitingMatch) {
      // Someone else is inviting the user - user is an attendee
      extracted.hostName = invitingMatch[1].trim();
      extracted.isUserHost = false;
      console.log('📩 User is being invited by:', extracted.hostName);
      console.log('👤 User role: Attendee');
    } else {
      // No "is inviting you" pattern - user is likely the host
      extracted.isUserHost = true;
      console.log('👑 User appears to be the host');
    }

    // Extract attendee emails from the invitation text
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = invitationText.match(emailPattern) || [];
    
    // Filter out obvious system emails and duplicates
    const systemEmailPatterns = [
      /noreply/i,
      /no-reply/i,
      /support/i,
      /admin/i,
      /system/i,
      /zoom\.us$/i
    ];
    
    extracted.attendeeEmails = [...new Set(foundEmails)].filter(email => {
      return !systemEmailPatterns.some(pattern => pattern.test(email));
    });
    
    console.log('� Extracted attendee emails:', extracted.attendeeEmails);

    // Extract topic (multiple patterns) - enhanced for various invitation formats
    let topicMatch = invitationText.match(/(?:Topic|Subject):\s*(.+)/i);
    
    // If no explicit topic found, look for patterns like "is inviting you to"
    if (!topicMatch) {
      const inviteMatch = invitationText.match(/inviting you to (?:a scheduled )?(.+)/i);
      if (inviteMatch) {
        topicMatch = [null, inviteMatch[1]];
      }
    }
    
    if (topicMatch) {
      extracted.topic = topicMatch[1].trim().replace(/\.$/, ''); // Remove trailing period
      console.log('✅ Extracted topic:', extracted.topic);
    }
    
    // If still no topic and we have a meeting ID, generate a meaningful topic
    if (!extracted.topic && extracted.meetingId) {
      extracted.topic = `Zoom Meeting ${extracted.meetingId}`;
      console.log('✅ Generated topic from meeting ID:', extracted.topic);
    }

    // Extract join URL (multiple patterns)
    const urlMatch = invitationText.match(/(https:\/\/[\w\-\.]*zoom\.us\/j\/\d+[^\s]*)/i);
    if (urlMatch) {
      extracted.joinUrl = urlMatch[1];
      console.log('✅ Extracted join URL:', extracted.joinUrl);
      
      // Extract meeting ID from URL
      const meetingIdMatch = extracted.joinUrl.match(/\/j\/(\d+)/);
      if (meetingIdMatch) {
        extracted.meetingId = meetingIdMatch[1];
        console.log('✅ Extracted meeting ID:', extracted.meetingId);
      }
    }

    // Extract meeting ID directly from text if no URL found
    if (!extracted.meetingId) {
      // Handle meeting IDs with or without spaces
      const meetingIdMatch = invitationText.match(/Meeting ID:\s*(\d[\d\s]*\d|\d+)/i);
      if (meetingIdMatch) {
        // Remove all spaces from meeting ID
        extracted.meetingId = meetingIdMatch[1].replace(/\s/g, '');
        console.log('✅ Extracted meeting ID from text:', extracted.meetingId);
        
        // Generate join URL if we have meeting ID but no URL
        if (!extracted.joinUrl) {
          extracted.joinUrl = `https://zoom.us/j/${extracted.meetingId}`;
          if (extracted.password) {
            extracted.joinUrl += `?pwd=${extracted.password}`;
          }
          console.log('🔗 Generated join URL:', extracted.joinUrl);
        }
      }
    }

    // Extract password (multiple patterns) - enhanced for various formats
    const passwordMatch = invitationText.match(/(?:Password|Passcode):\s*([a-zA-Z0-9]+)/i);
    if (passwordMatch) {
      extracted.password = passwordMatch[1];
      console.log('✅ Extracted password:', extracted.password);
    }

    // Extract date and time (multiple patterns)
    let dateTimeMatch = invitationText.match(/Time:\s*([^(\n\r]+)/i);
    if (dateTimeMatch) {
      const timeStr = dateTimeMatch[1].trim();
      console.log('🕐 Found time string:', timeStr);
      
      // Try to parse the date string with timezone handling
      try {
        // Handle common timezone formats
        let cleanTimeStr = timeStr
          .replace(/\s*\(.*?\)/g, '') // Remove parentheses content
          .replace(/Eastern Time/g, 'EST')
          .replace(/Pacific Time/g, 'PST')
          .replace(/Central Time/g, 'CST')
          .replace(/Mountain Time/g, 'MST')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log('🕐 Cleaned time string:', cleanTimeStr);
        
        const parsedDate = new Date(cleanTimeStr);
        if (!isNaN(parsedDate.getTime())) {
          extracted.startTime = parsedDate.toISOString();
          console.log('✅ Extracted start time:', extracted.startTime);
        } else {
          console.log('⚠️ Could not parse cleaned date:', cleanTimeStr);
          
          // Try alternative parsing for "Jan 15, 2024 02:00 PM" format
          const altMatch = timeStr.match(/(\w{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (altMatch) {
            const altDate = new Date(altMatch[1]);
            if (!isNaN(altDate.getTime())) {
              extracted.startTime = altDate.toISOString();
              console.log('✅ Extracted start time (alt format):', extracted.startTime);
            }
          }
        }
      } catch (dateError) {
        console.log('⚠️ Date parsing error:', dateError.message);
      }
    }

    // Fallback: try other date patterns
    if (!extracted.startTime) {
      const altDateMatch = invitationText.match(/(\w{3}\s+\w{3}\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      if (altDateMatch) {
        const dateStr = altDateMatch[1];
        console.log('🕐 Found alternative date string:', dateStr);
        try {
          extracted.startTime = new Date(dateStr).toISOString();
          console.log('✅ Extracted start time (alt):', extracted.startTime);
        } catch (error) {
          console.log('⚠️ Alternative date parsing failed:', error.message);
        }
      }
    }

    // Extract duration
    const durationMatch = invitationText.match(/Duration:\s*(\d+)\s*(?:minutes?|mins?|hours?)/i);
    if (durationMatch) {
      extracted.duration = parseInt(durationMatch[1]);
      console.log('✅ Extracted duration:', extracted.duration);
    } else {
      // Default duration if not found
      extracted.duration = 60;
      console.log('⚠️ Duration not found, using default: 60 minutes');
    }

    // Extract timezone
    const timezoneMatch = invitationText.match(/\(([A-Z]{3,4}[^)]*)\)/);
    if (timezoneMatch) {
      extracted.timezone = timezoneMatch[1];
      console.log('✅ Extracted timezone:', extracted.timezone);
    }

    console.log('📋 Final parsed invitation data:', extracted);
    
    // Validate minimum required fields
    if (!extracted.topic) {
      console.log('⚠️ No topic found in invitation');
    }
    if (!extracted.startTime) {
      console.log('⚠️ No start time found in invitation');
    }
    if (!extracted.joinUrl && !extracted.meetingId) {
      console.log('⚠️ No meeting URL or ID found in invitation');
    }
    
    return extracted;

  } catch (error) {
    console.log('❌ Error parsing invitation:', error.message);
    return extracted;
  }
}  /**
   * Extract meeting details from Zoom join URL
   * Works with various Zoom URL formats
   */
  extractMeetingDetailsFromUrl(joinUrl) {
    const extracted = {
      meetingId: null,
      password: null,
      personalMeetingId: null,
      hostKey: null
    };

    if (!joinUrl || typeof joinUrl !== 'string') {
      return extracted;
    }

    try {
      const url = new URL(joinUrl);
      
      // Extract meeting ID from various URL patterns
      // Pattern 1: https://zoom.us/j/123456789
      // Pattern 2: https://zoom.us/j/123456789?pwd=password
      // Pattern 3: https://us02web.zoom.us/j/123456789
      
      const pathParts = url.pathname.split('/');
      const meetingIdFromPath = pathParts.find(part => /^\d{9,11}$/.test(part));
      
      if (meetingIdFromPath) {
        extracted.meetingId = meetingIdFromPath;
      }

      // Extract password from URL parameters
      const urlParams = new URLSearchParams(url.search);
      if (urlParams.has('pwd')) {
        extracted.password = urlParams.get('pwd');
      }

      // Extract host key if present
      if (urlParams.has('tk')) {
        extracted.hostKey = urlParams.get('tk');
      }

      // Check if it's a personal meeting ID
      if (urlParams.has('pmi') || url.pathname.includes('/my/')) {
        extracted.personalMeetingId = extracted.meetingId;
      }

      console.log('🔍 Extracted details from URL:', extracted);
      return extracted;

    } catch (error) {
      console.log('⚠️ Could not parse URL, using defaults:', error.message);
      return extracted;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return true; // Always available for free accounts
  }
}

module.exports = MockZoomService; 