import Cafe from '../models/Cafe.js';
import otpService from '../../auth/services/otpService.js';
import jwtService from '../../auth/services/jwtService.js';
import firebaseAuthService from '../../auth/services/firebaseAuthService.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { normalizePhoneNumber } from '../../../shared/utils/phoneUtils.js';
import winston from 'winston';

/**
 * Build phone query that searches in multiple formats (with/without country code)
 * This handles both old data (without country code) and new data (with country code)
 */
const buildPhoneQuery = (normalizedPhone) => {
  if (!normalizedPhone) return null;

  // Check if normalized phone has country code (starts with 91 and is 12 digits)
  if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
    // Search for both: with country code (917610416911) and without (7610416911)
    const phoneWithoutCountryCode = normalizedPhone.substring(2);
    return {
      $or: [
        { phone: normalizedPhone },
        { phone: phoneWithoutCountryCode },
        { phone: `+${normalizedPhone}` },
        { phone: `+91${phoneWithoutCountryCode}` }
      ]
    };
  } else {
    // If it's already without country code, also check with country code
    return {
      $or: [
        { phone: normalizedPhone },
        { phone: `91${normalizedPhone}` },
        { phone: `+91${normalizedPhone}` },
        { phone: `+${normalizedPhone}` }
      ]
    };
  }
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Send OTP for cafe phone number or email
 * POST /api/cafe/auth/send-otp
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const { phone, email, purpose = 'login' } = req.body;

  // Validate that either phone or email is provided
  if (!phone && !email) {
    return errorResponse(res, 400, 'Either phone number or email is required');
  }

  // DISABLE PUBLIC CAFE REGISTRATION
  if (purpose === 'register' || purpose === 'login') {
    return errorResponse(res, 403, 'Public cafe registration and login are disabled. Please contact the administrator.');
  }

  // Validate phone number format if provided
  if (phone) {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phone)) {
      return errorResponse(res, 400, 'Invalid phone number format');
    }
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 400, 'Invalid email format');
    }
  }

  try {
    const result = await otpService.generateAndSendOTP(phone || null, purpose, email || null);
    return successResponse(res, 200, result.message, {
      expiresIn: result.expiresIn,
      identifierType: result.identifierType
    });
  } catch (error) {
    logger.error(`Error sending OTP: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * Verify OTP and login/register cafe
 * POST /api/cafe/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, email, otp, purpose = 'login', name, password } = req.body;

  // Validate that either phone or email is provided
  if ((!phone && !email) || !otp) {
    return errorResponse(res, 400, 'Either phone number or email, and OTP are required');
  }

  // DISABLE PUBLIC CAFE REGISTRATION AND LOGIN
  if (purpose === 'register' || purpose === 'login') {
    return errorResponse(res, 403, 'Public cafe registration and login are disabled. Please contact the administrator.');
  }

  try {
    let cafe;
    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    if (phone && !normalizedPhone) {
      return errorResponse(res, 400, 'Invalid phone number format');
    }

    const identifier = normalizedPhone || email;
    const identifierType = normalizedPhone ? 'phone' : 'email';

    if (purpose === 'register') {
      // Registration flow
      // Check if cafe already exists with normalized phone
      // For phone, search in both formats (with and without country code) to handle old data
      const findQuery = normalizedPhone
        ? buildPhoneQuery(normalizedPhone)
        : { email: email?.toLowerCase().trim() };
      cafe = await Cafe.findOne(findQuery);

      if (cafe) {
        return errorResponse(res, 400, `Cafe already exists with this ${identifierType}. Please login.`);
      }

      // Name is mandatory for explicit registration
      if (!name) {
        return errorResponse(res, 400, 'Cafe name is required for registration');
      }

      // Verify OTP (phone or email) before creating cafe
      await otpService.verifyOTP(phone || null, otp, purpose, email || null);

      const cafeData = {
        name,
        signupMethod: normalizedPhone ? 'phone' : 'email'
      };

      if (normalizedPhone) {
        cafeData.phone = normalizedPhone;
        cafeData.phoneVerified = true;
        cafeData.ownerPhone = normalizedPhone;
        // For phone signup, set ownerEmail to empty string or phone-based email
        cafeData.ownerEmail = email || `${normalizedPhone}@cafe.appzeto.com`;
        // CRITICAL: Do NOT set email field for phone signups to avoid null duplicate key error
        // Email field should be completely omitted, not set to null or undefined
      }
      if (email) {
        cafeData.email = email.toLowerCase().trim();
        cafeData.ownerEmail = email.toLowerCase().trim();
      }
      // Ensure email is not set to null or undefined
      if (!email && !phone) {
        // This shouldn't happen due to validation, but just in case
        throw new Error('Either phone or email must be provided');
      }

      // If password provided (email/password registration), set it
      if (password && !phone) {
        cafeData.password = password;
      }

      // Set owner name from cafe name if not provided separately
      cafeData.ownerName = name;

      // Set isActive to false - cafe needs admin approval before becoming active
      cafeData.isActive = false;

      try {
        // For phone signups, use $unset to ensure email field is not saved
        if (phone && !email) {
          // Use collection.insertOne directly to have full control over the document
          const docToInsert = { ...cafeData };
          // Explicitly remove email field
          delete docToInsert.email;
          cafe = await Cafe.create(docToInsert);
        } else {
          cafe = await Cafe.create(cafeData);
        }
        logger.info(`New cafe registered: ${cafe._id}`, {
          [identifierType]: identifier,
          cafeId: cafe._id
        });
      } catch (createError) {
        logger.error(`Error creating cafe: ${createError.message}`, {
          code: createError.code,
          keyPattern: createError.keyPattern,
          phone,
          email,
          cafeData: { ...cafeData, password: '***' }
        });

        // Handle duplicate key error (email, phone, or slug)
        if (createError.code === 11000) {
          // Check if it's an email null duplicate key error (common with phone signups)
          if (createError.keyPattern && createError.keyPattern.email && phone && !email) {
            logger.warn(`Email null duplicate key error for phone signup: ${phone}`, {
              error: createError.message,
              keyPattern: createError.keyPattern
            });
            // Try to find existing cafe by phone
            cafe = await Cafe.findOne({ phone });
            if (cafe) {
              return errorResponse(res, 400, `Cafe already exists with this phone number. Please login.`);
            }
            // If not found, this is likely a database index issue - ensure email is completely removed
            // Create a fresh cafeData object without email field
            const retryCafeData = {
              name: cafeData.name,
              signupMethod: cafeData.signupMethod,
              phone: cafeData.phone,
              phoneVerified: cafeData.phoneVerified,
              ownerPhone: cafeData.ownerPhone,
              ownerEmail: cafeData.ownerEmail,
              ownerName: cafeData.ownerName,
              isActive: cafeData.isActive
            };
            // Explicitly do NOT include email field
            if (cafeData.password) {
              retryCafeData.password = cafeData.password;
            }
            try {
              cafe = await Cafe.create(retryCafeData);
              logger.info(`New cafe registered (fixed email null issue): ${cafe._id}`, {
                [identifierType]: identifier,
                cafeId: cafe._id
              });
            } catch (retryError) {
              logger.error(`Failed to create cafe after email null fix: ${retryError.message}`, {
                code: retryError.code,
                keyPattern: retryError.keyPattern,
                error: retryError
              });
              // Check if it's still a duplicate key error
              if (retryError.code === 11000) {
                // Try to find cafe again (search in both formats)
                const phoneQuery = buildPhoneQuery(normalizedPhone) || { phone: normalizedPhone };
                cafe = await Cafe.findOne(phoneQuery);
                if (cafe) {
                  return errorResponse(res, 400, `Cafe already exists with this phone number. Please login.`);
                }
              }
              throw new Error(`Failed to create cafe: ${retryError.message}. Please contact support.`);
            }
          } else if (createError.keyPattern && createError.keyPattern.phone) {
            // Phone duplicate key error - search in both formats
            const phoneQuery = buildPhoneQuery(normalizedPhone) || { phone: normalizedPhone };
            cafe = await Cafe.findOne(phoneQuery);
            if (cafe) {
              return errorResponse(res, 400, `Cafe already exists with this phone number. Please login.`);
            }
            throw new Error(`Phone number already exists: ${createError.message}`);
          } else if (createError.keyPattern && createError.keyPattern.slug) {
            // Check if it's a slug conflict
            // Retry with unique slug
            const baseSlug = cafeData.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            let counter = 1;
            let uniqueSlug = `${baseSlug}-${counter}`;
            while (await Cafe.findOne({ slug: uniqueSlug })) {
              counter++;
              uniqueSlug = `${baseSlug}-${counter}`;
            }
            cafeData.slug = uniqueSlug;
            try {
              cafe = await Cafe.create(cafeData);
              logger.info(`New cafe registered with unique slug: ${cafe._id}`, {
                [identifierType]: identifier,
                cafeId: cafe._id,
                slug: uniqueSlug
              });
            } catch (retryError) {
              // If still fails, check if cafe exists
              const findQuery = normalizedPhone
                ? { phone: normalizedPhone }
                : { email: email?.toLowerCase().trim() };
              cafe = await Cafe.findOne(findQuery);
              if (!cafe) {
                throw retryError;
              }
              return errorResponse(res, 400, `Cafe already exists with this ${identifierType}. Please login.`);
            }
          } else {
            // Other duplicate key errors (email, phone)
            const findQuery = normalizedPhone
              ? { phone: normalizedPhone }
              : { email: email?.toLowerCase().trim() };
            cafe = await Cafe.findOne(findQuery);
            if (!cafe) {
              throw createError;
            }
            return errorResponse(res, 400, `Cafe already exists with this ${identifierType}. Please login.`);
          }
        } else {
          throw createError;
        }
      }
    } else {
      // Login (with optional auto-registration)
      // For phone, search in both formats (with and without country code) to handle old data
      let findQuery;
      if (normalizedPhone) {
        // Check if normalized phone has country code (starts with 91 and is 12 digits)
        if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
          // Search for both: with country code (917610416911) and without (7610416911)
          const phoneWithoutCountryCode = normalizedPhone.substring(2);
          findQuery = {
            $or: [
              { phone: normalizedPhone },
              { phone: phoneWithoutCountryCode },
              { phone: `+${normalizedPhone}` },
              { phone: `+91${phoneWithoutCountryCode}` }
            ]
          };
        } else {
          // If it's already without country code, also check with country code
          findQuery = {
            $or: [
              { phone: normalizedPhone },
              { phone: `91${normalizedPhone}` },
              { phone: `+91${normalizedPhone}` },
              { phone: `+${normalizedPhone}` }
            ]
          };
        }
      } else {
        findQuery = { email: email?.toLowerCase().trim() };
      }
      cafe = await Cafe.findOne(findQuery);

      if (!cafe && !name) {
        // Tell the client that we need cafe name to proceed with auto-registration
        return successResponse(res, 200, 'Cafe not found. Please provide cafe name for registration.', {
          needsName: true,
          identifierType,
          identifier
        });
      }

      // Handle reset-password purpose
      if (purpose === 'reset-password') {
        if (!cafe) {
          return errorResponse(res, 404, 'No cafe account found with this email.');
        }
        // Verify OTP for password reset
        await otpService.verifyOTP(phone || null, otp, purpose, email || null);
        return successResponse(res, 200, 'OTP verified. You can now reset your password.', {
          verified: true,
          email: cafe.email
        });
      }

      // Verify OTP first
      await otpService.verifyOTP(phone || null, otp, purpose, email || null);

      if (!cafe) {
        // Auto-register new cafe after OTP verification
        const cafeData = {
          name,
          signupMethod: normalizedPhone ? 'phone' : 'email'
        };

        if (normalizedPhone) {
          cafeData.phone = normalizedPhone;
          cafeData.phoneVerified = true;
          cafeData.ownerPhone = normalizedPhone;
          // For phone signup, set ownerEmail to empty string or phone-based email
          cafeData.ownerEmail = email || `${normalizedPhone}@cafe.appzeto.com`;
          // Explicitly don't set email field for phone signups to avoid null duplicate key error
        }
        if (email) {
          cafeData.email = email.toLowerCase().trim();
          cafeData.ownerEmail = email.toLowerCase().trim();
        }
        // Ensure email is not set to null or undefined
        if (!email && !phone) {
          // This shouldn't happen due to validation, but just in case
          throw new Error('Either phone or email must be provided');
        }

        if (password && !phone) {
          cafeData.password = password;
        }

        cafeData.ownerName = name;

        // Set isActive to false - cafe needs admin approval before becoming active
        cafeData.isActive = false;

        try {
          // For phone signups, ensure email field is not included
          if (phone && !email) {
            const docToInsert = { ...cafeData };
            // Explicitly remove email field
            delete docToInsert.email;
            cafe = await Cafe.create(docToInsert);
          } else {
            cafe = await Cafe.create(cafeData);
          }
          logger.info(`New cafe auto-registered: ${cafe._id}`, {
            [identifierType]: identifier,
            cafeId: cafe._id
          });
        } catch (createError) {
          logger.error(`Error creating cafe (auto-register): ${createError.message}`, {
            code: createError.code,
            keyPattern: createError.keyPattern,
            phone,
            email,
            cafeData: { ...cafeData, password: '***' }
          });

          if (createError.code === 11000) {
            // Check if it's an email null duplicate key error (common with phone signups)
            if (createError.keyPattern && createError.keyPattern.email && phone && !email) {
              logger.warn(`Email null duplicate key error for phone signup: ${phone}`, {
                error: createError.message,
                keyPattern: createError.keyPattern
              });
              // Try to find existing cafe by phone (search in both formats)
              const phoneQuery = buildPhoneQuery(normalizedPhone) || { phone };
              cafe = await Cafe.findOne(phoneQuery);
              if (cafe) {
                logger.info(`Cafe found after email null duplicate key error: ${cafe._id}`);
                // Continue with login flow
              } else {
                // If not found, this is likely a database index issue - ensure email is completely removed
                // Create a fresh cafeData object without email field
                const retryCafeData = {
                  name: cafeData.name,
                  signupMethod: cafeData.signupMethod,
                  phone: cafeData.phone,
                  phoneVerified: cafeData.phoneVerified,
                  ownerPhone: cafeData.ownerPhone,
                  ownerEmail: cafeData.ownerEmail,
                  ownerName: cafeData.ownerName,
                  isActive: cafeData.isActive
                };
                // Explicitly do NOT include email field
                if (cafeData.password) {
                  retryCafeData.password = cafeData.password;
                }
                try {
                  cafe = await Cafe.create(retryCafeData);
                  logger.info(`New cafe auto-registered (fixed email null issue): ${cafe._id}`, {
                    [identifierType]: identifier,
                    cafeId: cafe._id
                  });
                } catch (retryError) {
                  logger.error(`Failed to create cafe after email null fix: ${retryError.message}`, {
                    code: retryError.code,
                    keyPattern: retryError.keyPattern,
                    error: retryError
                  });
                  // Check if it's still a duplicate key error
                  if (retryError.code === 11000) {
                    // Try to find cafe again (search in both formats)
                    const phoneQuery = buildPhoneQuery(normalizedPhone) || { phone };
                    cafe = await Cafe.findOne(phoneQuery);
                    if (cafe) {
                      logger.info(`Cafe found after retry error: ${cafe._id}`);
                      // Continue with login flow
                    } else {
                      throw new Error(`Failed to create cafe: ${retryError.message}. Please contact support.`);
                    }
                  } else {
                    throw new Error(`Failed to create cafe: ${retryError.message}. Please contact support.`);
                  }
                }
              }
            } else if (createError.keyPattern && createError.keyPattern.phone) {
              // Phone duplicate key error
              cafe = await Cafe.findOne({ phone });
              if (cafe) {
                logger.info(`Cafe found after phone duplicate key error: ${cafe._id}`);
                // Continue with login flow
              } else {
                throw new Error(`Phone number already exists: ${createError.message}`);
              }
            } else if (createError.keyPattern && createError.keyPattern.slug) {
              // Check if it's a slug conflict
              // Retry with unique slug
              const baseSlug = cafeData.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
              let counter = 1;
              let uniqueSlug = `${baseSlug}-${counter}`;
              while (await Cafe.findOne({ slug: uniqueSlug })) {
                counter++;
                uniqueSlug = `${baseSlug}-${counter}`;
              }
              cafeData.slug = uniqueSlug;
              try {
                cafe = await Cafe.create(cafeData);
                logger.info(`New cafe auto-registered with unique slug: ${cafe._id}`, {
                  [identifierType]: identifier,
                  cafeId: cafe._id,
                  slug: uniqueSlug
                });
              } catch (retryError) {
                // If still fails, check if cafe exists
                const findQuery = phone
                  ? { phone }
                  : { email };
                cafe = await Cafe.findOne(findQuery);
                if (!cafe) {
                  throw retryError;
                }
                logger.info(`Cafe found after duplicate key error: ${cafe._id}`);
              }
            } else {
              // Other duplicate key errors (email, phone)
              const findQuery = phone
                ? { phone }
                : { email };
              cafe = await Cafe.findOne(findQuery);
              if (!cafe) {
                throw createError;
              }
              logger.info(`Cafe found after duplicate key error: ${cafe._id}`);
            }
          } else {
            throw createError;
          }
        }
      } else {
        // Existing cafe login - update verification status if needed
        if (phone && !cafe.phoneVerified) {
          cafe.phoneVerified = true;
          await cafe.save();
        }
      }
    }

    // Generate tokens (email may be null for phone signups)
    const tokens = jwtService.generateTokens({
      userId: cafe._id.toString(),
      role: 'cafe',
      email: cafe.email || cafe.phone || cafe.cafeId
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return access token and cafe info
    return successResponse(res, 200, 'Authentication successful', {
      accessToken: tokens.accessToken,
      cafe: {
        id: cafe._id,
        cafeId: cafe.cafeId,
        name: cafe.name,
        email: cafe.email,
        phone: cafe.phone,
        phoneVerified: cafe.phoneVerified,
        signupMethod: cafe.signupMethod,
        profileImage: cafe.profileImage,
        isActive: cafe.isActive,
        onboarding: cafe.onboarding
      }
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * Register cafe with email and password
 * POST /api/cafe/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, ownerName, ownerEmail, ownerPhone } = req.body;

  if (!name || !email || !password) {
    return errorResponse(res, 400, 'Cafe name, email, and password are required');
  }

  // DISABLE PUBLIC CAFE REGISTRATION
  return errorResponse(res, 403, 'Public cafe registration is disabled. Please contact the administrator.');

  // Normalize phone number if provided
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
  if (phone && !normalizedPhone) {
    return errorResponse(res, 400, 'Invalid phone number format');
  }

  // Check if cafe already exists
  const existingCafe = await Cafe.findOne({
    $or: [
      { email: email.toLowerCase().trim() },
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
    ]
  });

  if (existingCafe) {
    if (existingCafe.email === email.toLowerCase().trim()) {
      return errorResponse(res, 400, 'Cafe with this email already exists. Please login.');
    }
    if (normalizedPhone && existingCafe.phone === normalizedPhone) {
      return errorResponse(res, 400, 'Cafe with this phone number already exists. Please login.');
    }
  }

  // Create new cafe
  const cafeData = {
    name,
    email: email.toLowerCase().trim(),
    password, // Will be hashed by pre-save hook
    ownerName: ownerName || name,
    ownerEmail: (ownerEmail || email).toLowerCase().trim(),
    signupMethod: 'email',
    // Set isActive to false - cafe needs admin approval before becoming active
    isActive: false
  };

  // Only include phone if provided (don't set to null)
  if (normalizedPhone) {
    cafeData.phone = normalizedPhone;
    cafeData.ownerPhone = ownerPhone ? normalizePhoneNumber(ownerPhone) : normalizedPhone;
  }

  const cafe = await Cafe.create(cafeData);

  // Generate tokens (email may be null for phone signups)
  const tokens = jwtService.generateTokens({
    userId: cafe._id.toString(),
    role: 'cafe',
    email: cafe.email || cafe.phone || cafe.cafeId
  });

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  logger.info(`New cafe registered via email: ${cafe._id}`, { email, cafeId: cafe._id });

  return successResponse(res, 201, 'Registration successful', {
    accessToken: tokens.accessToken,
    cafe: {
      id: cafe._id,
      cafeId: cafe.cafeId,
      name: cafe.name,
      email: cafe.email,
      phone: cafe.phone,
      phoneVerified: cafe.phoneVerified,
      signupMethod: cafe.signupMethod,
      profileImage: cafe.profileImage,
      isActive: cafe.isActive
    }
  });
});

/**
 * Login cafe with email and password
 * POST /api/cafe/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, 'Email and password are required');
  }

  // DISABLE PUBLIC CAFE LOGIN
  return errorResponse(res, 403, 'Public cafe login is disabled. Please contact the administrator.');

  const cafe = await Cafe.findOne({ email }).select('+password');

  if (!cafe) {
    return errorResponse(res, 401, 'Invalid email or password');
  }

  if (!cafe.isActive) {
    return errorResponse(res, 401, 'Cafe account is inactive. Please contact support.');
  }

  // Check if cafe has a password set
  if (!cafe.password) {
    return errorResponse(res, 400, 'Account was created with phone. Please use OTP login.');
  }

  // Verify password
  const isPasswordValid = await cafe.comparePassword(password);

  if (!isPasswordValid) {
    return errorResponse(res, 401, 'Invalid email or password');
  }

  // Generate tokens (email may be null for phone signups)
  const tokens = jwtService.generateTokens({
    userId: cafe._id.toString(),
    role: 'cafe',
    email: cafe.email || cafe.phone || cafe.cafeId
  });

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  logger.info(`Cafe logged in via email: ${cafe._id}`, { email, cafeId: cafe._id });

  return successResponse(res, 200, 'Login successful', {
    accessToken: tokens.accessToken,
    cafe: {
      id: cafe._id,
      cafeId: cafe.cafeId,
      name: cafe.name,
      email: cafe.email,
      phone: cafe.phone,
      phoneVerified: cafe.phoneVerified,
      signupMethod: cafe.signupMethod,
      profileImage: cafe.profileImage,
      isActive: cafe.isActive,
      onboarding: cafe.onboarding
    }
  });
});

/**
 * Reset Password with OTP verification
 * POST /api/cafe/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return errorResponse(res, 400, 'Email, OTP, and new password are required');
  }

  if (newPassword.length < 6) {
    return errorResponse(res, 400, 'Password must be at least 6 characters long');
  }

  const cafe = await Cafe.findOne({ email }).select('+password');

  if (!cafe) {
    return errorResponse(res, 404, 'No cafe account found with this email.');
  }

  // Verify OTP for reset-password purpose
  try {
    await otpService.verifyOTP(null, otp, 'reset-password', email);
  } catch (error) {
    logger.error(`OTP verification failed for password reset: ${error.message}`);
    return errorResponse(res, 400, 'Invalid or expired OTP. Please request a new one.');
  }

  // Update password
  cafe.password = newPassword; // Will be hashed by pre-save hook
  await cafe.save();

  logger.info(`Password reset successful for cafe: ${cafe._id}`, { email, cafeId: cafe._id });

  return successResponse(res, 200, 'Password reset successfully. Please login with your new password.');
});

/**
 * Refresh Access Token
 * POST /api/cafe/auth/refresh-token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return errorResponse(res, 401, 'Refresh token not found');
  }

  try {
    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(refreshToken);

    // Ensure it's a cafe token
    if (decoded.role !== 'cafe') {
      return errorResponse(res, 401, 'Invalid token for cafe');
    }

    // Get cafe from database
    const cafe = await Cafe.findById(decoded.userId).select('-password');

    if (!cafe) {
      return errorResponse(res, 401, 'Cafe not found');
    }

    // Allow inactive cafes to refresh tokens - they need access to complete onboarding
    // The middleware will handle blocking inactive cafes from accessing restricted routes

    // Generate new access token
    const accessToken = jwtService.generateAccessToken({
      userId: cafe._id.toString(),
      role: 'cafe',
      email: cafe.email || cafe.phone || cafe.cafeId
    });

    return successResponse(res, 200, 'Token refreshed successfully', {
      accessToken
    });
  } catch (error) {
    return errorResponse(res, 401, error.message || 'Invalid refresh token');
  }
});

/**
 * Logout
 * POST /api/cafe/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  return successResponse(res, 200, 'Logged out successfully');
});

/**
 * Get current cafe
 * GET /api/cafe/auth/me
 */
export const getCurrentCafe = asyncHandler(async (req, res) => {
  // Cafe is attached by authenticate middleware
  return successResponse(res, 200, 'Cafe retrieved successfully', {
    cafe: {
      id: req.cafe._id,
      cafeId: req.cafe.cafeId,
      name: req.cafe.name,
      email: req.cafe.email,
      phone: req.cafe.phone,
      phoneVerified: req.cafe.phoneVerified,
      signupMethod: req.cafe.signupMethod,
      profileImage: req.cafe.profileImage,
      isActive: req.cafe.isActive,
      onboarding: req.cafe.onboarding,
      ownerName: req.cafe.ownerName,
      ownerEmail: req.cafe.ownerEmail,
      ownerPhone: req.cafe.ownerPhone,
      // Include additional cafe details
      cuisines: req.cafe.cuisines,
      openDays: req.cafe.openDays,
      location: req.cafe.location,
      primaryContactNumber: req.cafe.primaryContactNumber,
      deliveryTimings: req.cafe.deliveryTimings,
      menuImages: req.cafe.menuImages,
      slug: req.cafe.slug,
      isAcceptingOrders: req.cafe.isAcceptingOrders,
      // Include verification status
      rejectionReason: req.cafe.rejectionReason || null,
      approvedAt: req.cafe.approvedAt || null,
      rejectedAt: req.cafe.rejectedAt || null
    }
  });
});

/**
 * Reverify Cafe (Resubmit for approval)
 * POST /api/cafe/auth/reverify
 */
export const reverifyCafe = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe; // Already attached by authenticate middleware

    // Check if cafe was rejected
    if (!cafe.rejectionReason) {
      return errorResponse(res, 400, 'Cafe is not rejected. Only rejected cafes can be reverified.');
    }

    // Clear rejection details and mark as pending again
    cafe.rejectionReason = null;
    cafe.rejectedAt = undefined;
    cafe.rejectedBy = undefined;
    cafe.isActive = false; // Keep inactive until approved

    await cafe.save();

    logger.info(`Cafe reverified: ${cafe._id}`, {
      cafeName: cafe.name
    });

    return successResponse(res, 200, 'Cafe reverified successfully. Waiting for admin approval. Verification will be done in 24 hours.', {
      cafe: {
        id: cafe._id.toString(),
        name: cafe.name,
        isActive: cafe.isActive,
        rejectionReason: null
      }
    });
  } catch (error) {
    logger.error(`Error reverifying cafe: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to reverify cafe');
  }
});

/**
 * Login / register using Firebase Google ID token
 * POST /api/cafe/auth/firebase/google-login
 */
export const firebaseGoogleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return errorResponse(res, 400, 'Firebase ID token is required');
  }

  // Ensure Firebase Admin is configured
  if (!firebaseAuthService.isEnabled()) {
    return errorResponse(
      res,
      500,
      'Firebase Auth is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend .env'
    );
  }

  try {
    // Verify Firebase ID token
    const decoded = await firebaseAuthService.verifyIdToken(idToken);

    const firebaseUid = decoded.uid;
    const email = decoded.email || null;
    const name = decoded.name || decoded.display_name || 'Cafe';
    const picture = decoded.picture || decoded.photo_url || null;
    const emailVerified = !!decoded.email_verified;

    // Validate email is present
    if (!email) {
      logger.error('Firebase Google login failed: Email not found in token', { uid: firebaseUid });
      return errorResponse(res, 400, 'Email not found in Firebase user. Please ensure email is available in your Google account.');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.error('Firebase Google login failed: Invalid email format', { email });
      return errorResponse(res, 400, 'Invalid email format received from Google.');
    }

    // Find existing cafe by firebase UID (stored in googleId) or email
    let cafe = await Cafe.findOne({
      $or: [
        { googleId: firebaseUid },
        { email }
      ]
    });

    if (cafe) {
      // If cafe exists but googleId not linked yet, link it
      if (!cafe.googleId) {
        cafe.googleId = firebaseUid;
        cafe.googleEmail = email;
        if (!cafe.profileImage && picture) {
          cafe.profileImage = { url: picture };
        }
        if (!cafe.signupMethod) {
          cafe.signupMethod = 'google';
        }
        await cafe.save();
        logger.info('Linked Google account to existing cafe', { cafeId: cafe._id, email });
      }

      logger.info('Existing cafe logged in via Firebase Google', {
        cafeId: cafe._id,
        email
      });
    } else {
      // Auto-register new cafe based on Firebase data
      const cafeData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        googleId: firebaseUid,
        googleEmail: email.toLowerCase().trim(),
        signupMethod: 'google',
        profileImage: picture ? { url: picture } : null,
        ownerName: name.trim(),
        ownerEmail: email.toLowerCase().trim(),
        // Set isActive to false - cafe needs admin approval before becoming active
        isActive: false
      };

      try {
        cafe = await Cafe.create(cafeData);

        logger.info('New cafe registered via Firebase Google login', {
          firebaseUid,
          email,
          cafeId: cafe._id,
          name: cafe.name
        });
      } catch (createError) {
        // Handle duplicate key error
        if (createError.code === 11000) {
          logger.warn('Duplicate key error during cafe creation, retrying find', { email });
          cafe = await Cafe.findOne({ email });
          if (!cafe) {
            logger.error('Cafe not found after duplicate key error', { email });
            throw createError;
          }
          // Link Google ID if not already linked
          if (!cafe.googleId) {
            cafe.googleId = firebaseUid;
            cafe.googleEmail = email;
            if (!cafe.profileImage && picture) {
              cafe.profileImage = { url: picture };
            }
            if (!cafe.signupMethod) {
              cafe.signupMethod = 'google';
            }
            await cafe.save();
          }
        } else {
          logger.error('Error creating cafe via Firebase Google login', { error: createError.message, email });
          throw createError;
        }
      }
    }

    // Ensure cafe is active
    if (!cafe.isActive) {
      logger.warn('Inactive cafe attempted login', { cafeId: cafe._id, email });
      return errorResponse(res, 403, 'Your cafe account has been deactivated. Please contact support.');
    }

    // Generate JWT tokens for our app (email may be null for phone signups)
    const tokens = jwtService.generateTokens({
      userId: cafe._id.toString(),
      role: 'cafe',
      email: cafe.email || cafe.phone || cafe.cafeId
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return successResponse(res, 200, 'Firebase Google authentication successful', {
      accessToken: tokens.accessToken,
      cafe: {
        id: cafe._id,
        cafeId: cafe.cafeId,
        name: cafe.name,
        email: cafe.email,
        phone: cafe.phone,
        phoneVerified: cafe.phoneVerified,
        signupMethod: cafe.signupMethod,
        profileImage: cafe.profileImage,
        isActive: cafe.isActive,
        onboarding: cafe.onboarding
      }
    });
  } catch (error) {
    logger.error(`Error in Firebase Google login: ${error.message}`);
    return errorResponse(res, 400, error.message || 'Firebase Google authentication failed');
  }
});

