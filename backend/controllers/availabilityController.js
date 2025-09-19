const User = require('../models/User');
const Session = require('../models/Session');

/**
 * Get availability for multiple users
 * GET /api/availability?userIds[]=...&startDate=...&endDate=...&timezone=...&duration=...
 */
exports.getUserAvailability = async (req, res) => {
  try {
    const { userIds, startDate, endDate, timezone = 'UTC', duration = 30 } = req.query;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs are required and must be an array'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }



    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Fetch users
    const users = await User.find({ _id: { $in: userIds } });
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found'
      });
    }

    // Fetch existing sessions for these users in the date range
    const sessions = await Session.find({
      $or: [
        { host: { $in: userIds } },
        { 'participants.user': { $in: userIds } }
      ],
      startTime: { $gte: start, $lte: end }
    }).populate('host', 'name email');

    // Generate availability data for each user
    const availabilityData = {
      users: [],
      optimalTimes: []
    };

    for (const user of users) {
      const userAvailability = await generateUserAvailability(
        user, 
        start, 
        end, 
        timezone, 
        duration, 
        sessions
      );
      
      availabilityData.users.push(userAvailability);
    }

    // Find optimal meeting times
    availabilityData.optimalTimes = findOptimalMeetingTimes(availabilityData.users, duration);



    res.json({
      success: true,
      data: availabilityData
    });

  } catch (error) {
    console.error('❌ Error in getUserAvailability:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Generate availability for a single user
 */
async function generateUserAvailability(user, startDate, endDate, timezone, duration, sessions) {
  const availability = [];
  const currentDate = new Date(startDate);

  // Generate 30-minute slots for each day
  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Generate slots for this day
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(dayStart);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30);

        // Check if this slot conflicts with existing sessions
        const conflictingSession = sessions.find(session => {
          const sessionStart = new Date(session.startTime);
          const sessionEnd = new Date(session.endTime || new Date(sessionStart.getTime() + session.duration * 60000));
          
          return (
            (session.host._id.toString() === user._id.toString() || 
             session.participants.some(p => p.user.toString() === user._id.toString())) &&
            slotStart < sessionEnd && slotEnd > sessionStart
          );
        });

        let status = 'free';
        let title = '';
        let description = '';

        if (conflictingSession) {
          status = 'busy';
          title = conflictingSession.title || 'Meeting';
          description = conflictingSession.description || 'Scheduled meeting';
        } else {
          // Check custom availability
          const customSlot = await checkCustomAvailability(user, slotStart, slotEnd);
          if (customSlot) {
            status = customSlot.status;
            title = customSlot.title || '';
            description = customSlot.description || '';
          }
        }

        availability.push({
          start: slotStart,
          end: slotEnd,
          status,
          title,
          description
        });
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    timezone: user.timezone || timezone,
    availability
  };
}

/**
 * Check custom availability for a user
 */
async function checkCustomAvailability(user, start, end) {
  if (!user.customAvailability || user.customAvailability.length === 0) {
    return null;
  }

  // Find custom availability that overlaps with the time slot
  for (const customDay of user.customAvailability) {
    const customDate = new Date(customDay.date);
    const slotDate = new Date(start);
    
    if (customDate.toDateString() === slotDate.toDateString()) {
      for (const slot of customDay.slots) {
        const slotStart = new Date(slot.start);
        const slotEnd = new Date(slot.end);
        
        if (start < slotEnd && end > slotStart) {
          return {
            status: slot.status,
            title: slot.title,
            description: slot.description
          };
        }
      }
    }
  }

  return null;
}

/**
 * Find optimal meeting times where all users are available
 */
function findOptimalMeetingTimes(users, duration) {
  if (users.length === 0) return [];

  const optimalTimes = [];
  const allSlots = users[0].availability;

  // Check each time slot
  for (let i = 0; i < allSlots.length - 1; i++) {
    const slot = allSlots[i];
    const nextSlot = allSlots[i + 1];
    
    // Check if all users are free for this time
    const allFree = users.every(user => {
      const userSlot = user.availability.find(s => 
        s.start.getTime() === slot.start.getTime()
      );
      return userSlot && userSlot.status === 'free';
    });

    if (allFree) {
      optimalTimes.push({
        start: slot.start,
        end: nextSlot.start,
        timeString: formatTimeRange(slot.start, nextSlot.start),
        duration: 30
      });
    }
  }

  // Sort by start time and limit to top 10
  return optimalTimes
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 10);
}

/**
 * Update user's custom availability
 * POST /api/availability/update-availability
 */
exports.updateUserAvailability = async (req, res) => {
  try {
    const { date, slots } = req.body;
    const userId = req.userId || req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update or add custom availability for the date
    const dateObj = new Date(date);
    const existingIndex = user.customAvailability.findIndex(av => 
      av.date.toDateString() === dateObj.toDateString()
    );

    if (existingIndex >= 0) {
      user.customAvailability[existingIndex].slots = slots;
    } else {
      user.customAvailability.push({ date: dateObj, slots });
    }

    await user.save();

    res.json({ success: true, message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Error updating user availability:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get user's scheduling preferences
 * GET /api/availability/scheduling-preferences
 */
exports.getUserSchedulingPreferences = async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const preferences = user.schedulingPreferences || {
      defaultDuration: 30,
      bufferTime: 0,
      workingHours: { start: '09:00', end: '17:00' },
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    };

    res.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('❌ Error in getUserSchedulingPreferences:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update user's scheduling preferences
 * POST /api/availability/update-scheduling-preferences
 */
exports.updateUserSchedulingPreferences = async (req, res) => {
  try {
    const { defaultDuration, bufferTime, workingHours, workingDays } = req.body;
    const userId = req.userId || req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize schedulingPreferences if it doesn't exist
    if (!user.schedulingPreferences) {
      user.schedulingPreferences = {};
    }

    // Update preferences
    if (defaultDuration !== undefined) user.schedulingPreferences.defaultDuration = defaultDuration;
    if (bufferTime !== undefined) user.schedulingPreferences.bufferTime = bufferTime;
    if (workingHours !== undefined) user.schedulingPreferences.workingHours = workingHours;
    if (workingDays !== undefined) user.schedulingPreferences.workingDays = workingDays;

    await user.save();

    res.json({
      success: true,
      message: 'Scheduling preferences updated successfully',
      data: user.schedulingPreferences
    });

  } catch (error) {
    console.error('❌ Error in updateUserSchedulingPreferences:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Helper function to format time range
 */
function formatTimeRange(start, end) {
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return `${formatTime(start)} - ${formatTime(end)}`;
} 