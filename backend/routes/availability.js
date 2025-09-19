const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { requireAuth } = require('../middleware/auth');

// Get availability for multiple users
router.get('/user-availability', requireAuth, availabilityController.getUserAvailability);

// Update user's custom availability
router.post('/update-availability', requireAuth, availabilityController.updateUserAvailability);

// Get user's scheduling preferences
router.get('/scheduling-preferences', requireAuth, availabilityController.getUserSchedulingPreferences);

// Update user's scheduling preferences
router.post('/update-scheduling-preferences', requireAuth, availabilityController.updateUserSchedulingPreferences);

module.exports = router; 