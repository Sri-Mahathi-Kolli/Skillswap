const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer(); // or configure storage if you want to save files

exports.register = async (req, res) => {
  try {
    let { name, email, password, title, location, timezone, about, skills, phone, website } = req.body;
    let photoFilename = '';
    if (req.file) {
      photoFilename = req.file.filename;
    }
    // Parse skills if it's a string (from FormData)
    if (typeof skills === 'string') {
      skills = JSON.parse(skills);
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      title: title || '',
      location: location || '',
      timezone: timezone || 'UTC',
      about: about || '',
      skills: skills || [],
      photo: photoFilename,
      phone: phone || '',
      website: website || ''
    });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_make_it_long_and_random', { expiresIn: '24h' });
    
    // Convert MongoDB _id to id for frontend compatibility
    const userResponse = user.toObject();
    userResponse.id = userResponse._id;
    
    // Convert skill _id fields to id for frontend compatibility
    if (userResponse.skills && Array.isArray(userResponse.skills)) {
      userResponse.skills = userResponse.skills.map(skill => ({
        ...skill,
        id: skill._id
      }));
    }
    
    res.json({
      success: true,
      message: 'Login successful',
      accessToken: token,
      user: userResponse
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    // Convert MongoDB _id to id for frontend compatibility
    const userResponse = user.toObject();
    userResponse.id = userResponse._id;
    
    // Convert skill _id fields to id for frontend compatibility
    if (userResponse.skills && Array.isArray(userResponse.skills)) {
      userResponse.skills = userResponse.skills.map(skill => ({
        ...skill,
        id: skill._id
      }));
    }
    
    res.json({ success: true, user: userResponse });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Update user online status to false
    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    // Get the socket service instance to emit offline status
    const socketService = require('../services/socketService');
    if (socketService.io) {
      socketService.io.emit('userOffline', { userId });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reset password endpoint
exports.resetPassword = async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    // Validate input
    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, current password, and new password are required' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found with this email address' 
      });
    }

    // Verify current password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Check if new password is different from old password
    const isNewPasswordSame = await bcrypt.compare(newPassword, user.password);
    if (isNewPasswordSame) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be different from current password' 
      });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update user's password
    user.password = hashedNewPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error occurred while updating password' 
    });
  }
};

// Refresh token endpoint
exports.refreshToken = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    // Generate a new token
    const newToken = jwt.sign(
      { userId }, 
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_make_it_long_and_random', 
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      accessToken: newToken
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}; 