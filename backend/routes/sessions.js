const express = require('express');
const router = express.Router();
const { 
  createSession,
  getSessions, 
  getTeacherSessions,
  getStudentSessions,
  getSession,
  bookSession,
  updateSession, 
  cancelSession,
  updateSessionStatus,
  searchSessions,
  getUpcomingSessions,
  addMeetingUrl,
  deleteSession,
  startMeeting,
  endMeeting
} = require('../controllers/sessionController');
const { requireAuth } = require('../middleware/auth');

// Apply authentication to all routes
router.use(requireAuth);

// Session CRUD operations
router.post('/', createSession);
router.get('/', getSessions);
router.get('/search', searchSessions);
router.get('/upcoming/:userId', getUpcomingSessions);

// Teacher and student specific routes
router.get('/teacher/:teacherId', getTeacherSessions);
router.get('/student/:studentId', getStudentSessions);

// Individual session operations
router.get('/:sessionId', getSession);
router.put('/:sessionId', updateSession);
router.delete('/:sessionId', deleteSession);
router.put('/:sessionId/status', updateSessionStatus);
router.post('/:sessionId/book', bookSession);
router.post('/:sessionId/cancel', cancelSession);
router.post('/:sessionId/meeting-url', addMeetingUrl);
router.post('/:sessionId/start-meeting', startMeeting);
router.post('/:sessionId/end-meeting', endMeeting);

module.exports = router; 