// Simple reminder utility for sessions
// In production, integrate with email, push, or SMS services
module.exports = function sendReminder(session, reminder) {
  const time = session.startTime;
  const participants = session.participants.map(p => p.user).join(', ');
  console.log(`[Reminder] Will send a ${reminder} reminder for session '${session.title}' at ${time} to: ${participants}`);
  // TODO: Integrate with email/push/SMS APIs
}; 