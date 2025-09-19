let stripe = null;
const Payment = require('../models/Payment');
const User = require('../models/User');
const Session = require('../models/Session');

// Initialize Stripe with provided API keys
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  } catch (error) {
    console.warn('❌ Failed to initialize Stripe:', error.message);
    stripe = null;
  }
} else {
  console.warn('⚠️ Stripe secret key not found in environment variables');
}

class StripeService {
  // Create payment intent for session
  async createPaymentIntent(sessionId, userId) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    
    try {
      const session = await Session.findById(sessionId)
        .populate('host', 'name email stripeCustomerId');
      
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.paymentStatus === 'paid') {
        throw new Error('Session already paid');
      }

      // Get or create Stripe customer
      let customerId = session.host.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: session.host.email,
          name: session.host.name,
          metadata: {
            userId: session.host._id.toString()
          }
        });
        
        customerId = customer.id;
        await User.findByIdAndUpdate(session.host._id, {
          stripeCustomerId: customerId
        });
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(session.price * 100), // Convert to cents
        currency: session.currency.toLowerCase(),
        customer: customerId,
        metadata: {
          sessionId: session._id.toString(),
          skillName: session.skill,
          hostId: session.host._id.toString(),
          participantCount: session.participants.length.toString(),
          sessionDuration: session.duration.toString()
        },
        description: `Payment for ${session.skill} session: ${session.title}`,
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: session.host.email
      });

      // Create payment record
      const payment = new Payment({
        user: userId,
        session: sessionId,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customerId,
        amount: session.price,
        currency: session.currency,
        paymentType: 'session',
        description: `Payment for ${session.skill} session: ${session.title}`,
        metadata: {
          sessionId: session._id.toString(),
          skillName: session.skill,
          hostId: session.host._id.toString(),
          participantCount: session.participants.length,
          sessionDuration: session.duration
        }
      });

      await payment.save();

      // Update session with payment intent ID
      session.stripePaymentIntentId = paymentIntent.id;
      await session.save();

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      };

    } catch (error) {
      console.error('Create payment intent error:', error);
      throw error;
    }
  }

  // Create subscription
  async createSubscription(userId, priceId, paymentMethodId) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user._id.toString()
          }
        });
        
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user._id.toString()
        }
      });

      // Create payment record
      const payment = new Payment({
        user: userId,
        stripePaymentIntentId: subscription.latest_invoice.payment_intent.id,
        stripeCustomerId: customerId,
        amount: subscription.latest_invoice.amount_paid / 100,
        currency: subscription.currency.toUpperCase(),
        paymentType: 'subscription',
        description: `Premium subscription`,
        subscription: {
          stripeSubscriptionId: subscription.id,
          planId: priceId,
          interval: subscription.items.data[0].price.recurring.interval,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        }
      });

      await payment.save();

      return {
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        status: subscription.status
      };

    } catch (error) {
      console.error('Create subscription error:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(userId, subscriptionId) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      // Update payment record
      await Payment.findOneAndUpdate(
        { 'subscription.stripeSubscriptionId': subscriptionId },
        {
          'subscription.cancelAtPeriodEnd': true
        }
      );

      return {
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      };

    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  }

  // Process refund
  async processRefund(paymentId, amount, reason) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(amount * 100), // Convert to cents
        reason: reason,
        metadata: {
          paymentId: payment._id.toString(),
          reason: reason
        }
      });

      // Add refund to payment record
      await payment.addRefund({
        stripeRefundId: refund.id,
        amount: amount,
        reason: reason,
        status: refund.status
      });

      return {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      };

    } catch (error) {
      console.error('Process refund error:', error);
      throw error;
    }
  }

  // Helper function to create payment records for both parties
  async createPaymentRecords(paymentData, sessionData = null) {
    try {
      const { originalPayment, payerUser, recipientUser } = paymentData;
      const records = [];

      // Create payment record for the payer (person sending money)
      const payerPayment = new Payment({
        user: payerUser._id,
        session: sessionData?._id,
        stripePaymentIntentId: originalPayment.stripePaymentIntentId,
        amount: originalPayment.amount,
        currency: originalPayment.currency,
        status: 'succeeded', // Always succeeded
        paymentType: 'session', // Always 'session' for the payer
        description: `${originalPayment.description} - Payment to ${recipientUser?.name || 'SkillSwap Platform'}`,
        paymentMethod: originalPayment.paymentMethod,
        metadata: {
          ...originalPayment.metadata,
          isPayerRecord: true,
          recipientId: recipientUser?._id,
          recipientName: recipientUser?.name,
          recipientEmail: recipientUser?.email,
          fromUserId: payerUser._id,
          fromUserName: payerUser.name,
          toUserId: recipientUser?._id,
          toUserName: recipientUser?.name
        }
      });

      const savedPayerPayment = await payerPayment.save();
      await savedPayerPayment.populate('user', 'name email');
      records.push(savedPayerPayment);

      // Create payment record for the recipient (person receiving money) - only for session payments
      if (sessionData && recipientUser && recipientUser._id.toString() !== payerUser._id.toString()) {
        const recipientPayment = new Payment({
          user: recipientUser._id,
          session: sessionData._id,
          stripePaymentIntentId: originalPayment.stripePaymentIntentId + '_recipient',
          amount: originalPayment.amount,
          currency: originalPayment.currency,
          status: 'succeeded', // Always succeeded
          paymentType: 'session',
          description: `${originalPayment.description} - Payment from ${payerUser.name}`,
          paymentMethod: originalPayment.paymentMethod,
          metadata: {
            ...originalPayment.metadata,
            isRecipientRecord: true,
            payerId: payerUser._id,
            payerName: payerUser.name,
            payerEmail: payerUser.email,
            fromUserId: payerUser._id,
            fromUserName: payerUser.name,
            toUserId: recipientUser._id,
            toUserName: recipientUser.name
          }
        });

        const savedRecipientPayment = await recipientPayment.save();
        await savedRecipientPayment.populate('user', 'name email');
        records.push(savedRecipientPayment);
      }

      return records;
    } catch (error) {
      console.error('Error creating payment records:', error);
      throw error;
    }
  }

  // Handle webhook events
  async handleWebhook(event) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      const payment = await Payment.findOne({
        stripePaymentIntentId: event.data.object.id
      });

      if (!payment) {
        console.log('Payment not found for webhook:', event.id);
        return;
      }

      // Add webhook event to payment record
      await payment.addWebhookEvent(event.id, event.type);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(payment, event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(payment, event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handleSubscriptionPayment(payment, event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancelled(payment, event.data.object);
          break;
        
        case 'charge.dispute.created':
          await this.handleDisputeCreated(payment, event.data.object);
          break;
        
        default:
          console.log('Unhandled webhook event:', event.type);
      }

    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  // Handle successful payment
  async handlePaymentSuccess(payment, paymentIntent) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      // Update payment status
      await payment.updateStatus('succeeded');

      // Load payment with user data
      await payment.populate('user', 'name email');

      // Handle session payments - create dual records
      if (payment.session) {
        await Session.findByIdAndUpdate(payment.session, {
          paymentStatus: 'paid'
        });

        // Check if dual records already exist for this payment
        const existingDualRecords = await Payment.countDocuments({
          stripePaymentIntentId: { $regex: `^${payment.stripePaymentIntentId}` },
          session: payment.session
        });

        // Only create dual records if they don't already exist
        if (existingDualRecords <= 1) {
          // Get session data and recipient user
          const sessionData = await Session.findById(payment.session).populate('host', 'name email');
          const recipientUser = sessionData?.host;

          // Create dual records for session payments
          if (sessionData && recipientUser && recipientUser._id.toString() !== payment.user._id.toString()) {
            const originalPayment = {
              stripePaymentIntentId: payment.stripePaymentIntentId,
              amount: payment.amount,
              currency: payment.currency,
              paymentType: 'session',
              description: `Session: ${sessionData.title}`,
              paymentMethod: payment.paymentMethod,
              metadata: {
                ...payment.metadata,
                sessionId: sessionData._id,
                sessionTitle: sessionData.title
              }
            };

            // Create records for both payer and recipient
            await this.createPaymentRecords({
              originalPayment: originalPayment,
              payerUser: payment.user,
              recipientUser: recipientUser
            }, sessionData);

            console.log('💳 Session payment dual records created:', {
              sessionId: sessionData._id,
              amount: payment.amount,
              status: 'succeeded'
            });
          }
        } else {
          console.log('📋 Dual records already exist for this payment, skipping creation');
        }
      }

      // Update user if it's a subscription payment
      if (payment.paymentType === 'subscription') {
        await User.findByIdAndUpdate(payment.user, {
          isPremium: true
        });
      }

      // 🔔 NEW: Send notification to mentor/expert about new booking
      await this.notifyMentorAboutBooking(payment);

      console.log('Payment succeeded:', payment._id);

    } catch (error) {
      console.error('Handle payment success error:', error);
      throw error;
    }
  }

  // 🔔 NEW: Notify mentor/expert about new booking
  async notifyMentorAboutBooking(payment) {
    try {
      // Get payment details with user info
      await payment.populate('user', 'name email photo');
      
      // Extract mentor ID from payment metadata
      const mentorId = payment.metadata?.mentorId;
      if (!mentorId) {
        console.log('No mentor ID found in payment metadata');
        return;
      }

      // Get mentor details
      const User = require('../models/User');
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        console.log('Mentor not found:', mentorId);
        return;
      }

      console.log(`📧 Sending booking notification to mentor: ${mentor.name}`);
      
      // Create notification data
      const notificationData = {
        type: 'new_session_booking',
        data: {
          studentId: payment.user._id,
          studentName: payment.user.name,
          studentEmail: payment.user.email,
          studentPhoto: payment.user.photo,
          amount: payment.amount,
          currency: payment.currency,
          paymentId: payment._id,
          sessionId: payment.session,
          bookingTime: new Date(),
          message: `${payment.user.name} has booked a session with you for $${payment.amount}`
        }
      };
      
      // Store notification for later retrieval (when mentor logs in)
      await this.storeNotificationForMentor(mentorId, notificationData);
      
      console.log(`✅ Booking notification stored for mentor ${mentor.name}`);
      
      // TODO: Add email notification here if email service is configured
      // await this.sendBookingEmailToMentor(mentor, payment);

    } catch (error) {
      console.error('Error notifying mentor about booking:', error);
    }
  }

  // Store notification in database for later retrieval
  async storeNotificationForMentor(mentorId, notificationData) {
    try {
      const User = require('../models/User');
      
      // Add notification to mentor's notifications array
      await User.findByIdAndUpdate(mentorId, {
        $push: {
          notifications: {
            type: notificationData.type,
            message: notificationData.data.message,
            data: notificationData.data,
            createdAt: new Date(),
            isRead: false
          }
        }
      });
      
      console.log(`📝 Notification stored in database for mentor ${mentorId}`);
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  // Handle failed payment
  async handlePaymentFailure(payment, paymentIntent) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      await payment.updateStatus('failed', {
        code: paymentIntent.last_payment_error?.code,
        message: paymentIntent.last_payment_error?.message,
        declineCode: paymentIntent.last_payment_error?.decline_code
      });

      console.log('Payment failed:', payment._id);

    } catch (error) {
      console.error('Handle payment failure error:', error);
      throw error;
    }
  }

  // Handle subscription payment
  async handleSubscriptionPayment(payment, invoice) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      await payment.updateStatus('succeeded');

      // Update subscription period
      const subscription = invoice.subscription;
      await Payment.findOneAndUpdate(
        { 'subscription.stripeSubscriptionId': subscription },
        {
          'subscription.currentPeriodStart': new Date(invoice.period_start * 1000),
          'subscription.currentPeriodEnd': new Date(invoice.period_end * 1000)
        }
      );

      // Ensure user is premium
      await User.findByIdAndUpdate(payment.user, {
        isPremium: true
      });

      console.log('Subscription payment succeeded:', payment._id);

    } catch (error) {
      console.error('Handle subscription payment error:', error);
      throw error;
    }
  }

  // Handle subscription cancellation
  async handleSubscriptionCancelled(payment, subscription) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      // Update user premium status
      await User.findByIdAndUpdate(payment.user, {
        isPremium: false
      });

      console.log('Subscription cancelled:', payment._id);

    } catch (error) {
      console.error('Handle subscription cancellation error:', error);
      throw error;
    }
  }

  // Handle dispute
  async handleDisputeCreated(payment, charge) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      await Payment.findByIdAndUpdate(payment._id, {
        'dispute.isDisputed': true,
        'dispute.disputeId': charge.dispute,
        'dispute.amount': charge.amount / 100
      });

      console.log('Dispute created:', payment._id);

    } catch (error) {
      console.error('Handle dispute error:', error);
      throw error;
    }
  }

  // Get payment methods for customer
  async getPaymentMethods(customerId) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        isDefault: false // You can track this in your database
      }));

    } catch (error) {
      console.error('Get payment methods error:', error);
      throw error;
    }
  }

  // Create setup intent for saving payment methods
  async createSetupIntent(customerId) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      return {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id
      };

    } catch (error) {
      console.error('Create setup intent error:', error);
      throw error;
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe API keys for payment functionality.');
    }
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer']
      });

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: subscription.items.data[0].price
      };

    } catch (error) {
      console.error('Get subscription error:', error);
      throw error;
    }
  }

  // Create payment intent for direct payments (used by /create-payment-intent route)
  async createPaymentIntent(amount, currency = 'USD', metadata = {}) {
    if (!stripe) {
      return {
        success: false,
        error: 'Stripe is not configured. Please set up Stripe API keys for payment functionality.'
      };
    }
    
    try {
      // Convert amount to cents for Stripe
      const amountInCents = Math.round(amount * 100);
      
      // Convert all metadata values to strings (Stripe requirement)
      const stringMetadata = {};
      for (const [key, value] of Object.entries(metadata)) {
        stringMetadata[key] = String(value);
      }
      
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: stringMetadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Save payment record
      if (paymentIntent.id) {
        const payment = new Payment({
          user: metadata.userId, // Required user field
          stripePaymentIntentId: paymentIntent.id,
          amount: amount,
          currency: currency,
          paymentType: 'session', // Valid enum value
          description: metadata.description || `Session payment - ${amount} ${currency.toUpperCase()}`,
          metadata: {
            sessionId: metadata.sessionId,
            mentorId: metadata.mentorId,
            type: metadata.type,
            originalMetadata: metadata
          }
        });

        await payment.save();
        
        console.log('💳 Payment created in Stripe service:', {
          id: payment._id,
          amount: amount,
          mentorId: metadata.mentorId,
          hasMentorId: !!metadata.mentorId,
          willCreateDualRecords: metadata.mentorId && metadata.mentorId !== 'none'
        });
      } else {
        console.error('❌ Stripe payment intent ID is null or undefined. Payment record not saved.');
      }

      // If this is a session payment with a valid mentorId, prepare for dual record creation
      if (metadata.mentorId && metadata.mentorId !== 'none' && metadata.type === 'session_payment') {
        console.log('🎯 Session payment detected - will create dual records after confirmation');
      }

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      };

    } catch (error) {
      console.error('Create payment intent error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new StripeService(); 