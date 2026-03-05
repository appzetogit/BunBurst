import express from 'express';
import {
  sendOTP,
  verifyOTP,
  register,
  login,
  resetPassword,
  refreshToken,
  logout,
  getCurrentUser,
  googleAuth,
  googleCallback,
  firebaseGoogleLogin
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
// Note: we keep validation simple here and enforce "at least phone or email" with .or()
// to avoid Joi dependency group conflicts.
// Phone validation helper: accepts full phone string like "+91 9876543210"
// The digits portion (after country code) must be exactly 10 digits
const phoneNumberValidator = Joi.string()
  .custom((value, helpers) => {
    if (!value) return value;
    // Strip country code prefix (e.g. "+91 ") to get the local number
    const stripped = value.trim();
    // Extract only digits from the part after the country code space
    // Full string: "+91 9876543210" → local part "9876543210"
    const parts = stripped.split(' ');
    let localPart;
    if (parts.length >= 2) {
      // Has country code prefix
      localPart = parts.slice(1).join('');
    } else {
      // No space — treat entire string as local
      localPart = stripped.replace(/^\+\d{1,3}/, '');
    }
    const digitsOnly = localPart.replace(/\D/g, '');
    if (/[a-zA-Z]/.test(localPart)) {
      return helpers.message('Invalid phone number. Please enter a valid 10-digit mobile number.');
    }
    if (digitsOnly.length === 0) {
      return helpers.message('Invalid phone number. Please enter a valid 10-digit mobile number.');
    }
    if (digitsOnly.length > 10) {
      return helpers.message('Invalid phone number. Please enter a valid 10-digit mobile number.');
    }
    if (digitsOnly.length < 10) {
      return helpers.message('Invalid phone number. Please enter a valid 10-digit mobile number.');
    }
    return value;
  })
  .optional();

const sendOTPSchema = Joi.object({
  phone: phoneNumberValidator,
  email: Joi.string().email().optional(),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone', 'verify-email')
    .default('login')
}).or('phone', 'email'); // At least one of phone or email must be provided

const verifyOTPSchema = Joi.object({
  phone: phoneNumberValidator,
  email: Joi.string().email().optional(),
  otp: Joi.string().required().length(6),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone', 'verify-email')
    .default('login'),
  name: Joi.string().when('purpose', {
    is: 'register',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').default('user'),
  // Password is only used for email-based registrations (e.g. admin signup)
  password: Joi.string().min(6).max(100).optional()
}).or('phone', 'email'); // At least one of phone or email must be provided

const registerSchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required().min(6).max(100),
  phone: phoneNumberValidator,
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').default('user')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required(),
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').optional()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  otp: Joi.string().required().length(6),
  newPassword: Joi.string().required().min(6).max(100),
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').optional()
});

// Public routes
// OTP-based authentication
router.post('/send-otp', validate(sendOTPSchema), sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);

// Email/Password authentication
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// Token management
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

// Firebase Google login (using Firebase Auth ID token)
router.post('/firebase/google-login', firebaseGoogleLogin);

// Google OAuth routes
router.get('/google/:role', googleAuth);
router.get('/google/:role/callback', googleCallback);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

export default router;

