
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const { verifyToken: auth } = require('../middleware/auth');

const handleDuplicateKeyError = (err, res) => {
  if (err.code === 11000) {
    console.error('Duplicate key error:', err.message);
    return res.status(409).json({ message: 'Duplicate payment', error: err.message });
  }
  throw err;
};

// GET endpoint for verifying payment status by Stripe session ID
router.get('/verify-payment', auth, async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    console.log('[GET /verify-payment] sessionId:', sessionId);
    if (!sessionId) {
      console.log('[GET /verify-payment] Missing sessionId');
      return res.status(400).json({ success: false, message: 'Missing sessionId' });
    }
    const payment = await Payment.findOne({ stripeSessionId: sessionId });
    console.log('[GET /verify-payment] payment found:', payment);
    if (!payment) {
      console.log('[GET /verify-payment] Payment not found');
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    if (payment.status === 'completed') {
      console.log('[GET /verify-payment] Payment completed');
      return res.json({ success: true, transaction: payment });
    } else {
      console.log('[GET /verify-payment] Payment not completed, status:', payment.status);
      return res.json({ success: false, message: 'Payment not completed' });
    }
  } catch (error) {
    console.error('[GET /verify-payment] Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment', error: error.message });
  }
});

// Get payment overview/stats
router.get('/overview', auth, async (req, res) => {
  console.log('--- /payments/overview called ---');
  try {
    const userId = req.user.id;
    
    // Only include completed payments in all stats and activities
    // Get total income (as mentor, completed only)
    const totalIncome = await Payment.aggregate([
      { $match: { mentorId: userId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total spent (as user, completed only)
    const totalSpent = await Payment.aggregate([
      { $match: { userId: userId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total sessions booked (as user, completed only)
    const sessionsBooked = await Payment.countDocuments({
      userId: userId,
      status: 'completed'
    });

    // Get total sessions taught (as mentor, completed only)
    const sessionsTaught = await Payment.countDocuments({
      mentorId: userId,
      status: 'completed'
    });

    // Get recent activities (last 5, completed only)
    const recentActivitiesRaw = await Payment.find({
      $or: [{ userId: userId }, { mentorId: userId }],
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: 'userId', select: 'name username email' })
      .populate('mentorId', 'username');

    // Add explicit type for frontend (+/-) and debug log
    const recentActivities = recentActivitiesRaw.map(activity => {
      let type;
      let clientName = '';
      if (activity.userId) {
        if (activity.userId.name && activity.userId.name.trim()) {
          clientName = activity.userId.name;
        } else if (activity.userId.username && activity.userId.username.trim()) {
          clientName = activity.userId.username;
        } else if (activity.userId.email && activity.userId.email.trim()) {
          clientName = activity.userId.email;
        }
      }
      // If current user is mentor, it's income
      if (activity.mentorId && activity.mentorId._id && activity.mentorId._id.toString() === userId.toString()) {
        type = 'income';
      } else if (activity.userId && activity.userId._id && activity.userId._id.toString() === userId.toString()) {
        type = 'expense';
      } else {
        type = 'other'; // fallback for unexpected cases
      }
      return {
        ...activity.toObject(),
        type,
        clientName
      };
    });

    res.json({
      totalIncome: totalIncome[0]?.total || 0,
      totalSpent: totalSpent[0]?.total || 0,
      sessionsBooked,
      sessionsTaught,
      recentActivities
    });
  } catch (error) {
    console.error('Error fetching payment overview:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get payment transactions with filtering
router.get('/transactions', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, page = 1, limit = 10 } = req.query;
    let query = {
      $or: [{ userId: userId }, { mentorId: userId }]
    };
    // Filter by type
    if (type === 'income') {
      query = { mentorId: userId, status: 'completed' };
    } else if (type === 'expense') {
      query = { userId: userId, status: 'completed' };
    }
    const skip = (page - 1) * limit;
    const transactions = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email username')
      .populate('mentorDetails', 'name email');
    const total = await Payment.countDocuments(query);
    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get income analysis
router.get('/income-analysis', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'weekly' } = req.query;
    
    let groupBy, dateRange;
    const now = new Date();
    
    switch (period) {
      case 'daily':
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        dateRange = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case 'weekly':
        groupBy = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
        dateRange = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
      case 'monthly':
        groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        dateRange = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
        break;
      default:
        groupBy = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
        dateRange = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const analysis = await Payment.aggregate([
      {
        $match: {
          mentorId: userId,
          status: 'completed',
          createdAt: { $gte: dateRange }
        }
      },
      {
        $group: {
          _id: groupBy,
          income: { $sum: '$amount' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({ analysis, period });
  } catch (error) {
    console.error('Error fetching income analysis:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create checkout session (placeholder)
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const { amount, duration, mentorId, connectionId, currency = 'usd' } = req.body;
    const userId = req.user.id;


    // Fetch mentor details
    const User = require('../models/User');
    const mentor = await User.findById(mentorId).select('name email');
    if (!mentor) {
      return res.status(404).json({ message: 'Mentor not found' });
    }

    // Fetch student (user) details
    const student = await User.findById(userId).select('name email');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: 'SkillSwap Session',
            description: `Session with mentor ${mentorId}`
          },
          unit_amount: Math.round(amount * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
  success_url: 'http://localhost:4200/payments/checkout/{CHECKOUT_SESSION_ID}',
  cancel_url: 'http://localhost:4200/skills',
      metadata: {
  userId,
  mentorId,
  mentorName: mentor.name,
  mentorEmail: mentor.email,
  connectionId,
  duration
      }
    });

    const stripeSessionId = session.id;
    console.log('Stripe session ID to be saved:', stripeSessionId);

    // Validate session ID
    if (!stripeSessionId) {
      console.error('Stripe session ID is missing.');
      return res.status(500).json({ message: 'Missing Stripe session ID' });
    }

    // Check if payment with the same session ID already exists
    const existingPayment = await Payment.findOne({ stripeSessionId });
      if (existingPayment) {
        console.error('Duplicate key error: Payment already exists for session/intent ID:', payment.stripePaymentIntentId || payment.stripeSessionId);
        return res.status(409).json({
          error: 'This payment has already been processed. Please check your payment history or contact support if you believe this is an error.'
        });
      }

    // Save payment record only if session ID is unique and valid
    if (!stripeSessionId) {
      console.error('Attempted to save payment with null stripeSessionId!');
      return res.status(500).json({ message: 'Cannot save payment with null stripeSessionId' });
    }


    const payment = new Payment({
      userId,
      mentorId,
      mentorName: mentor.name,
      mentorEmail: mentor.email,
      userName: student.name,
      userEmail: student.email,
      connectionId,
      amount,
      duration,
      stripeSessionId,
      status: 'completed'
      // Only set stripePaymentIntentId if it is available and not null
      // stripePaymentIntentId: validIntentId
    });

    console.log('[PAYMENT CREATE] New payment created:', {
      userId,
      mentorId,
      amount,
      duration,
      stripeSessionId,
      status: payment.status
    });

    try {
      await payment.save();
    } catch (err) {
      handleDuplicateKeyError(err, res);
      return;
    }

    // --- Mentor Notification Logic (inline, after payment creation) ---
    try {
      // Re-fetch mentor with notifications array
      const mentorBefore = await User.findById(mentorId);
      if (mentorBefore) {
        const notification = {
          type: 'payment_received',
          title: 'Payment Received',
          message: `You received a payment of $${amount} from ${student.name} for a ${duration}-minute session. Please schedule the session, add it to your calendar, and confirm completion before marking this notification as read.`,
          data: {
            amount,
            duration,
            sessionId: stripeSessionId,
            studentName: student.name,
            studentEmail: student.email,
            mentorEmail: mentor.email,
            actionRequired: true
          },
          timestamp: new Date(),
          isRead: false,
          createdAt: new Date()
        };
        mentorBefore.notifications = mentorBefore.notifications || [];
        mentorBefore.notifications.push(notification);
        await mentorBefore.save();
        console.log('[NOTIFY] Mentor notified of payment:', mentorId, 'email:', mentor.email);
      } else {
        console.error('[NOTIFY] Mentor not found for notification:', mentorId);
      }
    } catch (notifyErr) {
      console.error('[NOTIFY] Error sending mentor notification:', notifyErr);
    }
    // --- End Mentor Notification Logic ---

    // Only return a valid sessionId
    if (!stripeSessionId || stripeSessionId === 'placeholder_session_id') {
      console.error('Invalid Stripe sessionId generated:', stripeSessionId);
      return res.status(500).json({ message: 'Failed to create a valid Stripe payment session.' });
    }
    res.json({
      sessionId: stripeSessionId,
      stripeUrl: session.url,
      mentor: {
        id: mentorId,
        name: mentor.name,
        email: mentor.email
      }
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: 'Error creating checkout session', error: error.message });
  }
});


router.post('/send-notification', auth, async (req, res) => {
  try {
    const { mentorId, studentName, amount, duration, sessionId } = req.body;
    const User = require('../models/User');
    // Debug: log incoming request
    console.log('[DEBUG-NOTIFY] Incoming notification request:', { mentorId, studentName, amount, duration, sessionId });

    // Check mentor existence before update
    const mentorBefore = await User.findById(mentorId);
    if (!mentorBefore) {
      console.error('[DEBUG-NOTIFY] Mentor not found before update:', mentorId);
      return res.status(404).json({ success: false, message: 'Mentor not found.' });
    }
    console.log('[DEBUG-NOTIFY] Mentor notifications before update:', mentorBefore.notifications);

    // Create unified notification for mentor (real use)
    const notification = {
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received a payment of $${amount} from ${studentName} for a ${duration}-minute session. Please schedule the session, add it to your calendar, and confirm completion before marking this notification as read.`,
      data: {
        amount,
        duration,
        sessionId,
        studentName,
        actionRequired: true
      },
      timestamp: new Date(),
      isRead: false,
      createdAt: new Date()
    };
    console.log('[DEBUG-NOTIFY] Notification object to push:', notification);
    // Push notification to mentor's notifications array and save
    mentorBefore.notifications = mentorBefore.notifications || [];
    mentorBefore.notifications.push(notification);
    await mentorBefore.save();
    console.log('[DEBUG-NOTIFY] Notification pushed and mentor saved.');
    res.json({ success: true, message: 'Notification sent to mentor.', notification });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Error verifying payment', error: error.message });
  }
});


// Verify payment status by Stripe session ID
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log('[POST /verify-payment] sessionId:', sessionId);
    if (!sessionId) {
      console.log('[POST /verify-payment] Missing sessionId');
      return res.status(400).json({ success: false, message: 'Missing sessionId' });
    }
    const payment = await Payment.findOne({ stripeSessionId: sessionId });
    console.log('[POST /verify-payment] payment found:', payment);
    if (!payment) {
      console.log('[POST /verify-payment] Payment not found');
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    if (payment.status === 'completed') {
      console.log('[POST /verify-payment] Payment completed');
      return res.json({ success: true, transaction: payment });
    } else {
      console.log('[POST /verify-payment] Payment not completed, status:', payment.status);
      return res.json({ success: false, message: 'Payment not completed' });
    }
  } catch (error) {
    console.error('[POST /verify-payment] Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment', error: error.message });
  }
});

module.exports = router;