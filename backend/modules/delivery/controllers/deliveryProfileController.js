import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../models/Delivery.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

import DeliveryWallet from '../models/DeliveryWallet.js';

/**
 * Get Delivery Partner Profile
 * GET /api/delivery/profile
 */
export const getProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery; // From authenticate middleware

    // Get basic profile data
    const profile = await Delivery.findById(delivery._id)
      .select('-password -refreshToken')
      .lean();

    if (!profile) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    // Fetch latest wallet balance from DeliveryWallet model
    const wallet = await DeliveryWallet.findOne({ deliveryId: delivery._id });

    // Attach wallet balance to profile object for frontend compatibility
    if (wallet) {
      profile.wallet = {
        balance: wallet.totalBalance || 0,
        cashInHand: wallet.cashInHand || 0,
        totalEarned: wallet.totalEarned || 0,
        totalWithdrawn: wallet.totalWithdrawn || 0
      };
    } else {
      // Fallback if no wallet exists yet
      profile.wallet = {
        balance: 0,
        cashInHand: 0
      };
    }

    return successResponse(res, 200, 'Profile retrieved successfully', {
      profile
    });
  } catch (error) {
    logger.error(`Error fetching delivery profile: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch profile');
  }
});

/**
 * Update Delivery Partner Profile
 * PUT /api/delivery/profile
 */
const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  phone: Joi.string()
    .trim()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .optional(),
  email: Joi.string().email().lowercase().trim().optional().allow(null, ''),
  dateOfBirth: Joi.date().optional().allow(null),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').optional(),
  vehicle: Joi.object({
    type: Joi.string().valid('bike', 'scooter', 'bicycle', 'car').optional(),
    number: Joi.string().trim().optional().allow(null, ''),
    model: Joi.string().trim().optional().allow(null, ''),
    brand: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  location: Joi.object({
    addressLine1: Joi.string().trim().optional().allow(null, ''),
    addressLine2: Joi.string().trim().optional().allow(null, ''),
    area: Joi.string().trim().optional().allow(null, ''),
    city: Joi.string().trim().optional().allow(null, ''),
    state: Joi.string().trim().optional().allow(null, ''),
    zipCode: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  profileImage: Joi.object({
    url: Joi.string().uri().optional().allow(null, ''),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  documents: Joi.object({
    photo: Joi.string().uri().optional().allow(null, ''),
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().min(2).max(100).optional().allow(null, ''),
      accountNumber: Joi.string().trim().min(9).max(18).optional().allow(null, ''),
      ifscCode: Joi.string().trim().length(11).uppercase().optional().allow(null, ''),
      bankName: Joi.string().trim().min(2).max(100).optional().allow(null, '')
    }).optional()
  }).optional()
});

export const updateProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const updateData = { ...req.body };

    // Validate input
    const { error } = updateProfileSchema.validate(updateData);
    if (error) {
      return errorResponse(res, 400, error.details[0].message);
    }

    if (typeof updateData.phone === 'string') {
      updateData.phone = updateData.phone.trim().replace(/\s+/g, ' ');
    }

    // Email-login users should not be allowed to change email from profile.
    if (
      typeof updateData.email !== 'undefined' &&
      String(delivery?.signupMethod || '').toLowerCase() === 'email'
    ) {
      const incomingEmail = String(updateData.email || '').trim().toLowerCase();
      const currentEmail = String(delivery?.email || '').trim().toLowerCase();
      if (incomingEmail !== currentEmail) {
        return errorResponse(res, 400, 'Email cannot be changed for email login users');
      }
    }

    const setData = { ...updateData };
    const unsetData = {};

    // Handle nested documents.bankDetails update properly
    if (updateData.documents?.bankDetails) {
      // Merge bankDetails with existing documents using dot notation to avoid wiping other doc fields
      setData['documents.bankDetails'] = {
        ...delivery.documents?.bankDetails,
        ...updateData.documents.bankDetails
      };
      // Remove the nested documents object from setData to avoid conflicts with dot notation
      // This ensures only 'documents.bankDetails' is set, not the whole 'documents' object
      if (setData.documents) {
        delete setData.documents.bankDetails;
        if (Object.keys(setData.documents).length === 0) {
          delete setData.documents;
        }
      }
    }

    // Handle documents.photo removal: if photo is empty/null, unset it using dot notation
    // This avoids wiping other document fields (aadhar, pan, drivingLicense, bankDetails)
    if (
      updateData.documents?.photo !== undefined &&
      (!updateData.documents.photo || String(updateData.documents.photo).trim() === '')
    ) {
      unsetData['documents.photo'] = '';
      // Remove the nested documents object from setData to avoid conflicts with dot notation
      if (setData.documents) {
        delete setData.documents.photo;
        if (Object.keys(setData.documents).length === 0) {
          delete setData.documents;
        }
      }
    } else if (updateData.documents?.photo) {
      // If photo is provided and not empty, set it using dot notation
      setData['documents.photo'] = updateData.documents.photo;
      if (setData.documents) {
        delete setData.documents.photo;
        if (Object.keys(setData.documents).length === 0) {
          delete setData.documents;
        }
      }
    }

    // Handle profile image removal: if url is empty/null, unset the entire profileImage field
    if (
      updateData.profileImage !== undefined &&
      (!updateData.profileImage?.url || updateData.profileImage.url.trim() === '')
    ) {
      unsetData.profileImage = '';
      delete setData.profileImage;
    }

    // Build the MongoDB update operation
    const mongoUpdate = {};
    if (Object.keys(setData).length > 0) mongoUpdate.$set = setData;
    if (Object.keys(unsetData).length > 0) mongoUpdate.$unset = unsetData;

    // Update profile
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      delivery._id,
      mongoUpdate,
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!updatedDelivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    logger.info('Profile updated successfully', {
      deliveryId: updatedDelivery.deliveryId || updatedDelivery._id,
      updatedFields: Object.keys(updateData)
    });

    return successResponse(res, 200, 'Profile updated successfully', {
      profile: updatedDelivery
    });
  } catch (error) {
    logger.error(`Error updating delivery profile: ${error.message}`);

    // Handle duplicate email/phone errors
    if (error.code === 11000) {
      if (error?.keyPattern?.phone) {
        return errorResponse(res, 400, 'Phone number already exists');
      }
      return errorResponse(res, 400, 'Email already exists');
    }

    return errorResponse(res, 500, 'Failed to update profile');
  }
});

/**
 * Reverify Delivery Partner (Resubmit for approval)
 * POST /api/delivery/reverify
 */
export const reverify = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;

    if (delivery.status !== 'blocked') {
      return errorResponse(res, 400, 'Only rejected delivery partners can resubmit for verification');
    }

    // Reset to pending status and clear rejection details
    delivery.status = 'pending';
    delivery.isActive = true; // Allow login to see verification message
    delivery.rejectionReason = undefined;
    delivery.rejectedAt = undefined;
    delivery.rejectedBy = undefined;

    await delivery.save();

    logger.info(`Delivery partner resubmitted for verification: ${delivery._id}`, {
      deliveryId: delivery.deliveryId
    });

    return successResponse(res, 200, 'Request resubmitted for verification successfully', {
      profile: {
        _id: delivery._id.toString(),
        name: delivery.name,
        status: delivery.status
      }
    });
  } catch (error) {
    logger.error(`Error reverifying delivery partner: ${error.message}`);
    return errorResponse(res, 500, 'Failed to resubmit for verification');
  }
});

