const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const connectionController = require('../controllers/connectionController');

const router = express.Router();

// Test endpoint to verify the route is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Connection routes are working!',
  });
});

// Apply authentication middleware to all routes (skip in)
router.use(verifyToken);

// Send connection request
router.post('/send', [
  body('recipientId').isMongoId().withMessage('Valid recipient ID required'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message too long'),
  body('skillContext').optional().isLength({ max: 200 }).withMessage('Skill context too long')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  await connectionController.sendConnectionRequest(req, res);
});

// Accept connection request
router.put('/:connectionId/accept', [
  body('connectionId').optional().isMongoId().withMessage('Valid connection ID required'),
], async (req, res) => {
  await connectionController.acceptConnectionRequest(req, res);
});

// Reject connection request
router.put('/:connectionId/reject', [
  body('connectionId').optional().isMongoId().withMessage('Valid connection ID required'),
], async (req, res) => {
  await connectionController.rejectConnectionRequest(req, res);
});

// Withdraw connection request
router.put('/:connectionId/withdraw', [
  body('connectionId').optional().isMongoId().withMessage('Valid connection ID required'),
], async (req, res) => {
  await connectionController.withdrawConnectionRequest(req, res);
});

// Get connection requests (pending, sent, received)
router.get('/requests', async (req, res) => {
  await connectionController.getConnectionRequests(req, res);
});

// Get connection status between two users
router.get('/status/:userId', [
  body('userId').optional().isMongoId().withMessage('Valid user ID required'),
], async (req, res) => {
  await connectionController.getConnectionStatus(req, res);
});

// Get user's connections (accepted connections)
router.get('/user/:userId', [
  body('userId').optional().isMongoId().withMessage('Valid user ID required'),
], async (req, res) => {
  await connectionController.getUserConnections(req, res);
});

// Reset all connections (ADMIN ONLY - for testing purposes)
router.delete('/reset', async (req, res) => {
  await connectionController.resetAllConnections(req, res);
});

module.exports = router; 