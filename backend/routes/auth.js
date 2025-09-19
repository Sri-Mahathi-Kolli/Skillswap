const multer = require('multer');
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming you have a Mongoose User model
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Add this at the top if not present
const { verifyToken } = require('../middleware/auth');

// Test endpoint to verify backend is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Auth backend is working' });
});

// Update multer to save files to disk
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

router.post('/register', upload.single('photo'), require('../controllers/authController').register);

router.post('/login', require('../controllers/authController').login);

router.get('/me', verifyToken, require('../controllers/authController').getCurrentUser);

router.post('/refresh', verifyToken, require('../controllers/authController').refreshToken);

router.post('/logout', verifyToken, require('../controllers/authController').logout);

router.post('/reset-password', require('../controllers/authController').resetPassword);

module.exports = router; 