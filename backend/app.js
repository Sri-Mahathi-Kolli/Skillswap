const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const mongoose = require('mongoose');
const User = require('./models/User'); // Ensure correct path


const app = express();

// Register Stripe webhook route BEFORE any body parsers or middleware
app.use('/api/webhook', require('./routes/stripe-webhook'));

// Middleware setup
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({ 
  origin: ['http://localhost:4200', 'http://localhost:4202', 'http://localhost:56239'], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillswap';
mongoose.connect(mongoUri).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

// Rate limiting for API routes - HIGH LIMIT FOR DEVELOPMENT
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Very high limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
}));

// Import and use modular routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/zoom', require('./routes/zoom'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/files', require('./routes/files'));
app.use('/api/webhook', require('./routes/stripe-webhook')); // Register the Stripe webhook route

// Basic routes
app.use('/', require('./routes/index'));

// Error handler
app.use(errorHandler);

module.exports = app;