const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Payment = require('../models/Payment');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe requires the raw body to validate the signature
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log all incoming events for debugging
  console.log('--- STRIPE WEBHOOK EVENT RECEIVED ---');
  console.log('Event type:', event.type);
  if (event.data && event.data.object) {
    console.log('Session/Object:', JSON.stringify(event.data.object, null, 2));
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      // Update payment status to completed
      let payment = await Payment.findOneAndUpdate(
        { stripeSessionId: session.id },
        { status: 'completed', completedAt: new Date() },
        { new: true }
      );
      console.log('Payment marked as completed for session:', session.id);
      console.log('[DEBUG] Payment object after update:', payment);
      if (!payment) {
        console.error('[DEBUG] No payment found for session:', session.id);
      }

      // Ensure userName and userEmail are present
      if (payment && (!payment.userName || !payment.userEmail)) {
        const User = require('../models/User');
        const student = await User.findById(payment.userId).select('name email');
        if (student) {
          payment.userName = student.name;
          payment.userEmail = student.email;
          await payment.save();
        }
      }

      // Notify mentor/expert after payment
      if (payment && payment.mentorId) {
        const User = require('../models/User');
        const mentor = await User.findById(payment.mentorId);
        if (mentor) {
          const notification = {
            type: 'payment_received',
            title: 'Payment Received',
            message: `You received a payment of $${payment.amount} from ${payment.userName || 'a student'} for a ${payment.duration}-minute session. Please schedule the session, add it to your calendar, and confirm completion before marking this notification as read.`,
            data: {
              amount: payment.amount,
              duration: payment.duration,
              sessionId: payment._id,
              studentId: payment.userId,
              studentName: payment.userName || '',
              studentEmail: payment.userEmail || '',
              actionRequired: true
            },
            timestamp: new Date(),
            isRead: false,
            createdAt: new Date()
          };
          mentor.notifications = mentor.notifications || [];
          mentor.notifications.push(notification);
          await mentor.save();
          console.log('[WEBHOOK-NOTIFY] Notification pushed and mentor saved.');
        } else {
          console.error('[WEBHOOK-NOTIFY] Mentor not found for notification:', payment.mentorId);
        }
      } else {
        console.error('[DEBUG] Payment missing mentorId or payment is null:', payment);
      }
    } catch (err) {
      console.error('Error updating payment status or sending notification:', err);
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;
