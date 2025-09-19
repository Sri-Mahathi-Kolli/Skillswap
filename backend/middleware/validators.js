const { body } = require('express-validator');

exports.validateRegister = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('location').notEmpty().withMessage('Location is required'),
  body('skills').isArray({ min: 1 }).withMessage('At least one skill is required'),
  body('skills.*.name').notEmpty().withMessage('Skill name is required')
];

exports.validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
]; 