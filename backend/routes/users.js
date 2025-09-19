const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Session = require('../models/Session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // adjust path as needed
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Cloudinary config (use your credentials)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Get payment settings for any user by ID
router.get('/:userId/payment-settings', requireAuth, async (req, res) => {
  try {
    let userId = req.params.userId;
    if (userId === 'me') {
      userId = req.user._id;
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Always include customPricing
    res.json({
      stripeEnabled: user.stripeEnabled ?? false,
      pricing: user.pricing ?? { thirtyMin: 0, sixtyMin: 0, ninetyMin: 0 },
      currency: user.currency ?? 'USD',
      customPricing: user.customPricing ?? []
    });
  } catch (error) {
    console.error('Error fetching user payment settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protect all session routes
// router.use(requireAuth); // Only if you want all routes protected

// Create a session
router.post('/', async (req, res) => {
  try {
    // You can access the user from req.user (set by requireAuth)
    const { title, description, skillId, startTime, endTime, ...rest } = req.body;
    const session = new Session({
      title,
      description,
      skillId,
      startTime,
      endTime,
      teacherId: req.userId || req.user._id, // or req.user._id
      ...rest
    });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove default session routes and only use the correct users route
// router.get('/', async (req, res) => {
//   const sessions = await Session.find();
//   res.json(sessions);
// });

// Get all users and their skills for the skills page (no auth required for discovery)
router.get('/', userController.getAllUsers);

// Get user notifications
router.get('/notifications', requireAuth, async (req, res) => {
  try {
  console.log('🔔 GET /notifications called for userId:', req.userId);
  console.log('🔔 Requesting notifications for userId:', req.userId);
    const user = await User.findById(req.userId).select('notifications');
    if (!user) {
      console.log('❌ User not found for ID:', req.userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log('📊 Raw user notifications:', user.notifications);
    user.notifications.forEach((n, idx) => {
      console.log(`   [${idx}] type: ${n.type}, isRead: ${n.isRead}, createdAt: ${n.createdAt}, message: ${n.message}`);
    });
    console.log(`📊 Total notifications count: ${user.notifications ? user.notifications.length : 0}`);
    
    // Return notifications sorted by newest first
    const notifications = user.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log('📤 Sending notifications response:', {
      success: true,
      data: notifications,
      count: notifications.length
    });
    
    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/notifications/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const notification = user.notifications.id(req.params.notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    notification.isRead = true;
    await user.save();
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

// 🧪 TEST ENDPOINT: Simulate payment notification for testing
router.post('/test-payment-notification', requireAuth, async (req, res) => {
  try {
    console.log('🧪 TEST notification endpoint called with data:', req.body);
    const { mentorId, studentName, amount, currency = 'USD' } = req.body;
    
    if (!mentorId || !studentName || !amount) {
      console.log('❌ Missing required fields:', { mentorId, studentName, amount });
      return res.status(400).json({ 
        success: false, 
        message: 'mentorId, studentName, and amount are required' 
      });
    }

    console.log('🔍 Looking for mentor with ID:', mentorId);
    // Find the mentor
    const mentor = await User.findById(mentorId);
    if (!mentor) {
      console.log('❌ Mentor not found for ID:', mentorId);
      return res.status(404).json({ success: false, message: 'Mentor not found' });
    }

    console.log('✅ Mentor found:', { id: mentor._id, name: mentor.name });

    // Create notification data
    const notificationData = {
      type: 'new_session_booking',
      message: `${studentName} has booked a session with you for $${amount}`,
      data: {
        studentId: req.user.id, // Use the current user's ID as the student ID
        studentName,
        amount,
        currency,
        paymentId: 'test-payment-' + Date.now(),
        bookingTime: new Date()
      },
      isRead: false,
      createdAt: new Date()
    };

    console.log('📝 Creating notification:', notificationData);

    // Add notification to mentor
    const updateResult = await User.findByIdAndUpdate(mentorId, {
      $push: { notifications: notificationData }
    });

    console.log('📤 Database update result:', updateResult ? 'SUCCESS' : 'FAILED');
    console.log(`✅ Test notification sent to mentor ${mentor.name}`);

    res.json({
      success: true,
      message: 'Test notification sent successfully',
      data: {
        mentorName: mentor.name,
        notification: notificationData
      }
    });

  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({ success: false, message: 'Failed to send test notification' });
  }
});

// Test endpoint to create notification with studentId for testing clickable profiles
router.post('/test-notification', requireAuth, async (req, res) => {
  try {
    console.log('🧪 Creating test notification with studentId...');
    
    // Add notification to current user with proper studentId field
    const newNotification = {
      type: 'new_session_booking',
      message: 'Sundari has booked a session with you for $20',
      data: {
        studentName: 'Sundari',
        studentId: req.user.id, // Include the studentId field for clickable profiles
        amount: 20,
        currency: 'USD',
        paymentId: 'test-payment-clickable-' + Date.now(),
        bookingTime: new Date()
      },
      isRead: false,
      createdAt: new Date()
    };
    
    const updateResult = await User.findByIdAndUpdate(req.userId, {
      $push: { notifications: newNotification }
    });
    
    console.log('✅ Test notification with studentId created');
    console.log('📋 Notification data:', newNotification);
    
    res.json({
      success: true,
      message: 'Test notification with studentId created',
      data: newNotification
    });
    
  } catch (error) {
    console.error('❌ Error creating test notification:', error);
    res.status(500).json({ success: false, message: 'Failed to create test notification' });
  }
});

// Get online status for multiple users
router.post('/online-status', requireAuth, userController.getUsersOnlineStatus);

// IMPORTANT: /me routes must come BEFORE /:userId routes to prevent "me" from being treated as a user ID
router.get('/me', requireAuth, userController.getProfile);
router.put('/me', requireAuth, upload.single('photo'), userController.updateProfile);
router.post('/me/skills', requireAuth, userController.addUserSkill);
router.put('/me/skills/:skillId', requireAuth, userController.updateUserSkill);
router.delete('/me/skills/:skillId', requireAuth, userController.deleteUserSkill);

// Payment settings routes
router.get('/me/payment-settings', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('paymentSettings customPricing');
    console.log('Loaded user for payment settings:', user);
    const paymentSettings = user.paymentSettings?.paymentSettings || {};
    const settings = {
      stripeEnabled: paymentSettings.stripeEnabled ?? false,
      pricing: paymentSettings.pricing ?? { thirtyMin: 0, sixtyMin: 0, ninetyMin: 0 },
      currency: paymentSettings.currency ?? 'USD',
      customPricing: user.customPricing ?? []
    };
    console.log('Returned payment settings:', settings);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/me/payment-settings', requireAuth, async (req, res) => {
  try {
    const { stripeEnabled, pricing, customPricing } = req.body;
    const updateData = {
      'paymentSettings.paymentSettings.stripeEnabled': stripeEnabled,
      'customPricing': Array.isArray(customPricing) ? customPricing : []
    };
    if (pricing) {
      updateData['paymentSettings.paymentSettings.pricing'] = pricing;
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('paymentSettings customPricing');
    const paymentSettings = user.paymentSettings?.paymentSettings || {};
    const settings = {
      stripeEnabled: paymentSettings.stripeEnabled ?? false,
      pricing: paymentSettings.pricing ?? { thirtyMin: 0, sixtyMin: 0, ninetyMin: 0 },
      currency: paymentSettings.currency ?? 'USD',
      customPricing: user.customPricing ?? []
    };
    res.json(settings);
  } catch (error) {
    console.error('Error updating payment settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Connection routes - /me routes must come BEFORE /:userId routes
router.put('/me/connection-requests/:requestId', requireAuth, userController.respondToConnectionRequest);
router.post('/:userId/connection-requests', requireAuth, userController.sendConnectionRequest);
router.get('/:userId/connection-status', requireAuth, userController.getConnectionStatus);



// Get user by ID (must come after /me routes)
router.get('/:userId', userController.getUserById);

// ...other session routes (get by id, update, delete, etc.)

// CORRECT: This is the real registration route!
router.post('/register', async (req, res) => {
  console.log('REAL REGISTER ROUTE HIT');
  try {
    const { name, email, password, ...rest } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, ...rest });
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      'your_super_secret_jwt_key_here_make_it_long_and_random', // Use a strong secret in production!
      { expiresIn: '1h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fix notifications by adding studentId to existing notifications
router.post('/fix-notifications', requireAuth, async (req, res) => {
  try {
    console.log('🔧 Fix notifications called for userId:', req.userId);
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`👤 Fixing notifications for: ${user.name}`);
    console.log(`📋 Current notifications: ${user.notifications.length}`);
    
    // Update each notification to add studentId
    let updatedCount = 0;
    user.notifications.forEach((notification, index) => {
      if (!notification.data.studentId) {
        console.log(`📝 Adding studentId to notification ${index + 1}`);
        notification.data.studentId = '68b5cb3eb66a586e49feffc4'; // Sri's ID
        updatedCount++;
      }
    });
    
    await user.save();
    
    console.log(`✅ Updated ${updatedCount} notifications with studentId`);
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} notifications`,
      total: user.notifications.length
    });
    
  } catch (error) {
    console.error('❌ Error fixing notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add email to existing notifications
router.post('/add-email-to-notifications', requireAuth, async (req, res) => {
  try {
    console.log('📧 Add email to notifications called for userId:', req.userId);
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find Sri's user to get his email
    const sri = await User.findById('68b5cb3eb66a586e49feffc4');
    if (!sri) {
      return res.status(404).json({ error: 'Sri user not found' });
    }
    
    console.log(`📧 Adding email ${sri.email} to notifications for: ${user.name}`);
    console.log(`📋 Current notifications: ${user.notifications.length}`);
    
    // Update each notification to add studentEmail
    let updatedCount = 0;
    user.notifications.forEach((notification, index) => {
      if (notification.type === 'new_session_booking' && notification.data.studentName === 'Sri') {
        console.log(`📝 Adding email to notification ${index + 1}`);
        notification.data.studentEmail = sri.email;
        updatedCount++;
      }
    });
    
    await user.save();
    
    console.log(`✅ Updated ${updatedCount} notifications with email: ${sri.email}`);
    
    res.json({
      success: true,
      message: `Added email to ${updatedCount} notifications`,
      email: sri.email,
      total: user.notifications.length
    });
    
  } catch (error) {
    console.error('❌ Error adding email to notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Profile image upload endpoint
router.post('/profile/upload-photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload_stream({
      resource_type: 'image',
      folder: 'profile_photos'
    }, async (error, result) => {
      if (error) {
        return res.status(500).json({ error: 'Cloudinary upload failed.' });
      }
      // Save URL to user profile
      const user = await User.findByIdAndUpdate(req.userId, {
        photo: result.secure_url,
        photoMimeType: req.file.mimetype
      }, { new: true });
      res.json({ success: true, url: result.secure_url, user });
    });
    result.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ error: 'Image upload failed.' });
  }
});

module.exports = router;
