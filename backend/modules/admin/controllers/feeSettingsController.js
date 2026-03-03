import FeeSettings from '../models/FeeSettings.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
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

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const sanitizeDistanceConfig = (distanceConfig = {}) => {
  const maxDeliveryDistance = toNumber(distanceConfig?.maxDeliveryDistance);
  const rawSlabs = Array.isArray(distanceConfig?.slabs) ? distanceConfig.slabs : [];

  const slabs = rawSlabs
    .map((slab) => ({
      minKm: toNumber(slab?.minKm),
      maxKm: toNumber(slab?.maxKm),
      fee: toNumber(slab?.fee),
    }))
    .filter((slab) => slab.minKm !== null || slab.maxKm !== null || slab.fee !== null);

  return {
    maxDeliveryDistance: maxDeliveryDistance ?? 20,
    slabs,
  };
};

const sanitizeAmountConfig = (amountConfig = {}) => {
  const rawRules = Array.isArray(amountConfig?.rules) ? amountConfig.rules : [];
  const rules = rawRules
    .map((rule) => ({
      minAmount: toNumber(rule?.minAmount),
      maxAmount: toNumber(rule?.maxAmount),
      deliveryFee: toNumber(rule?.deliveryFee),
    }))
    .filter(
      (rule) =>
        rule.minAmount !== null ||
        rule.maxAmount !== null ||
        rule.deliveryFee !== null,
    );

  return { rules };
};

const validateDistanceConfig = (distanceConfig) => {
  if (!distanceConfig) return null;
  if (!Number.isFinite(distanceConfig.maxDeliveryDistance) || distanceConfig.maxDeliveryDistance < 0) {
    return 'Max delivery distance must be a positive number';
  }

  for (const slab of distanceConfig.slabs || []) {
    if (
      !Number.isFinite(slab.minKm) ||
      !Number.isFinite(slab.maxKm) ||
      !Number.isFinite(slab.fee)
    ) {
      return 'Each distance slab must have valid Min Km, Max Km and Fee';
    }
    if (slab.minKm < 0 || slab.maxKm < 0 || slab.fee < 0) {
      return 'Distance slab values must be >= 0';
    }
    if (slab.minKm >= slab.maxKm) {
      return 'Distance slab Min Km must be less than Max Km';
    }
  }

  return null;
};

const validateAmountConfig = (amountConfig) => {
  if (!amountConfig) return null;
  for (const rule of amountConfig.rules || []) {
    if (
      !Number.isFinite(rule.minAmount) ||
      !Number.isFinite(rule.maxAmount) ||
      !Number.isFinite(rule.deliveryFee)
    ) {
      return 'Each amount rule must have valid Min Order, Max Order and Delivery Fee';
    }
    if (rule.minAmount < 0 || rule.maxAmount < 0 || rule.deliveryFee < 0) {
      return 'Amount rule values must be >= 0';
    }
    if (rule.minAmount >= rule.maxAmount) {
      return 'Amount rule Min Order must be less than Max Order';
    }
  }
  return null;
};

/**
 * Get current fee settings
 * GET /api/admin/fee-settings
 */
export const getFeeSettings = asyncHandler(async (req, res) => {
  try {
    // Get the most recent active fee settings
    let feeSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    // If no active settings exist, create default ones
    if (!feeSettings) {
      const defaultSettings = new FeeSettings({
        deliveryFee: 25,
        freeDeliveryThreshold: 149,
        platformFee: 5,
        gstRate: 5,
        isActive: true,
        createdBy: req.admin?._id || null,
      });

      await defaultSettings.save();
      feeSettings = defaultSettings.toObject();
    }

    return successResponse(res, 200, 'Fee settings retrieved successfully', {
      feeSettings,
    });
  } catch (error) {
    logger.error(`Error fetching fee settings: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch fee settings');
  }
});

/**
 * Create or update fee settings
 * POST /api/admin/fee-settings
 */
export const createOrUpdateFeeSettings = asyncHandler(async (req, res) => {
  try {
    const { deliveryFee, deliveryFeeRanges, freeDeliveryThreshold, platformFee, gstRate, isActive, distanceConfig, amountConfig } = req.body;
    const parsedDeliveryFee = toNumber(deliveryFee);
    const parsedPlatformFee = toNumber(platformFee);
    const parsedGstRate = toNumber(gstRate);
    const parsedFreeDeliveryThreshold = toNumber(freeDeliveryThreshold);
    const normalizedDistanceConfig = sanitizeDistanceConfig(distanceConfig);
    const normalizedAmountConfig = sanitizeAmountConfig(amountConfig);

    // Validate platform fee
    if (parsedPlatformFee === null || parsedPlatformFee < 0) {
      return errorResponse(res, 400, 'Platform fee must be a positive number');
    }

    if (parsedGstRate === null || parsedGstRate < 0 || parsedGstRate > 100) {
      return errorResponse(res, 400, 'GST rate must be between 0 and 100');
    }

    if (parsedDeliveryFee === null || parsedDeliveryFee < 0) {
      return errorResponse(res, 400, 'Delivery fee must be a positive number');
    }

    const distanceConfigError = validateDistanceConfig(normalizedDistanceConfig);
    if (distanceConfigError) {
      return errorResponse(res, 400, distanceConfigError);
    }

    const amountConfigError = validateAmountConfig(normalizedAmountConfig);
    if (amountConfigError) {
      return errorResponse(res, 400, amountConfigError);
    }

    // Validate delivery fee ranges if provided
    if (deliveryFeeRanges && Array.isArray(deliveryFeeRanges)) {
      for (const range of deliveryFeeRanges) {
        if (range.min === undefined || range.min < 0) {
          return errorResponse(res, 400, 'Each range must have a valid min value (≥ 0)');
        }
        if (range.max === undefined || range.max < 0) {
          return errorResponse(res, 400, 'Each range must have a valid max value (≥ 0)');
        }
        if (range.min >= range.max) {
          return errorResponse(res, 400, 'Range min value must be less than max value');
        }
        if (range.fee === undefined || range.fee < 0) {
          return errorResponse(res, 400, 'Each range must have a valid fee value (≥ 0)');
        }
      }
    }

    // Get current active config first so we can update it instead of creating duplicates
    const currentActiveSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 });

    // Deactivate all other active settings if this is being set as active
    if (isActive !== false) {
      const excludeId = currentActiveSettings?._id || null;
      await FeeSettings.updateMany(
        excludeId
          ? { isActive: true, _id: { $ne: excludeId } }
          : { isActive: true },
        { isActive: false, updatedBy: req.admin?._id || null }
      );
    }

    // Build payload
    const feeSettingsData = {
      deliveryFee: parsedDeliveryFee,
      freeDeliveryThreshold: parsedFreeDeliveryThreshold ?? 149,
      platformFee: parsedPlatformFee,
      gstRate: parsedGstRate,
      isActive: isActive !== false,
      createdBy: req.admin?._id || null,
      updatedBy: req.admin?._id || null,
      distanceConfig: normalizedDistanceConfig,
      amountConfig: normalizedAmountConfig
    };

    // Add delivery fee ranges if provided
    if (deliveryFeeRanges && Array.isArray(deliveryFeeRanges)) {
      feeSettingsData.deliveryFeeRanges = deliveryFeeRanges.map(range => ({
        min: Number(range.min),
        max: Number(range.max),
        fee: Number(range.fee),
      }));
    }

    // Update current active settings to keep persistence stable on refresh
    if (currentActiveSettings) {
      Object.assign(currentActiveSettings, feeSettingsData);
      currentActiveSettings.updatedBy = req.admin?._id || null;
      await currentActiveSettings.save();

      return successResponse(res, 200, 'Fee settings updated successfully', {
        feeSettings: currentActiveSettings,
      });
    }

    // Create first settings record if none exists
    const feeSettings = new FeeSettings(feeSettingsData);
    await feeSettings.save();

    return successResponse(res, 201, 'Fee settings created successfully', {
      feeSettings,
    });
  } catch (error) {
    logger.error(`Error creating fee settings: ${error.message}`);
    const message = error?.message || 'Failed to create fee settings';
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      return errorResponse(res, 400, message);
    }
    return errorResponse(res, 500, message);
  }
});

/**
 * Update fee settings
 * PUT /api/admin/fee-settings/:id
 */
export const updateFeeSettings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      deliveryFee,
      deliveryFeeRanges,
      freeDeliveryThreshold,
      platformFee,
      gstRate,
      isActive,
      distanceConfig,
      amountConfig,
    } = req.body;

    const parsedDeliveryFee = toNumber(deliveryFee);
    const parsedPlatformFee = toNumber(platformFee);
    const parsedGstRate = toNumber(gstRate);
    const parsedFreeDeliveryThreshold = toNumber(freeDeliveryThreshold);
    const normalizedDistanceConfig = sanitizeDistanceConfig(distanceConfig);
    const normalizedAmountConfig = sanitizeAmountConfig(amountConfig);

    const feeSettings = await FeeSettings.findById(id);

    if (!feeSettings) {
      return errorResponse(res, 404, 'Fee settings not found');
    }

    // Keep only one active config in DB to avoid stale reads on refresh
    const shouldBeActive = isActive === true || (isActive === undefined && feeSettings.isActive);
    if (shouldBeActive) {
      await FeeSettings.updateMany(
        { _id: { $ne: id }, isActive: true },
        { isActive: false, updatedBy: req.admin?._id || null }
      );
    }

    // Update fields
    if (deliveryFee !== undefined) {
      if (parsedDeliveryFee === null || parsedDeliveryFee < 0) {
        return errorResponse(res, 400, 'Delivery fee must be a positive number');
      }
      feeSettings.deliveryFee = parsedDeliveryFee;
    }

    if (deliveryFeeRanges !== undefined && Array.isArray(deliveryFeeRanges)) {
      // Validate delivery fee ranges
      for (const range of deliveryFeeRanges) {
        if (range.min === undefined || range.min < 0) {
          return errorResponse(res, 400, 'Each range must have a valid min value (≥ 0)');
        }
        if (range.max === undefined || range.max < 0) {
          return errorResponse(res, 400, 'Each range must have a valid max value (≥ 0)');
        }
        if (range.min >= range.max) {
          return errorResponse(res, 400, 'Range min value must be less than max value');
        }
        if (range.fee === undefined || range.fee < 0) {
          return errorResponse(res, 400, 'Each range must have a valid fee value (≥ 0)');
        }
      }
      feeSettings.deliveryFeeRanges = deliveryFeeRanges.map(range => ({
        min: Number(range.min),
        max: Number(range.max),
        fee: Number(range.fee),
      }));
    }

    if (freeDeliveryThreshold !== undefined) {
      feeSettings.freeDeliveryThreshold = parsedFreeDeliveryThreshold ?? feeSettings.freeDeliveryThreshold;
    }

    if (platformFee !== undefined) {
      if (parsedPlatformFee === null || parsedPlatformFee < 0) {
        return errorResponse(res, 400, 'Platform fee must be a positive number');
      }
      feeSettings.platformFee = parsedPlatformFee;
    }

    if (gstRate !== undefined) {
      if (parsedGstRate === null || parsedGstRate < 0 || parsedGstRate > 100) {
        return errorResponse(res, 400, 'GST rate must be between 0 and 100');
      }
      feeSettings.gstRate = parsedGstRate;
    }

    if (distanceConfig !== undefined) {
      const distanceConfigError = validateDistanceConfig(normalizedDistanceConfig);
      if (distanceConfigError) {
        return errorResponse(res, 400, distanceConfigError);
      }
      feeSettings.distanceConfig = normalizedDistanceConfig;
    }

    if (amountConfig !== undefined) {
      const amountConfigError = validateAmountConfig(normalizedAmountConfig);
      if (amountConfigError) {
        return errorResponse(res, 400, amountConfigError);
      }
      feeSettings.amountConfig = normalizedAmountConfig;
    }

    if (isActive !== undefined) {
      feeSettings.isActive = isActive;
    }

    feeSettings.updatedBy = req.admin?._id || null;

    await feeSettings.save();

    return successResponse(res, 200, 'Fee settings updated successfully', {
      feeSettings,
    });
  } catch (error) {
    logger.error(`Error updating fee settings: ${error.message}`);
    return errorResponse(res, 500, 'Failed to update fee settings');
  }
});

/**
 * Get all fee settings history
 * GET /api/admin/fee-settings/history
 */
export const getFeeSettingsHistory = asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const feeSettings = await FeeSettings.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await FeeSettings.countDocuments();

    return successResponse(res, 200, 'Fee settings history retrieved successfully', {
      feeSettings,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error(`Error fetching fee settings history: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch fee settings history');
  }
});

/**
 * Get public fee settings (for user frontend)
 * GET /api/admin/fee-settings/public
 */
export const getPublicFeeSettings = asyncHandler(async (req, res) => {
  try {
    const feeSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .select('deliveryFee freeDeliveryThreshold platformFee gstRate')
      .lean();

    // If no active settings, return default values
    if (!feeSettings) {
      return successResponse(res, 200, 'Fee settings retrieved successfully', {
        feeSettings: {
          deliveryFee: 25,
          freeDeliveryThreshold: 149,
          platformFee: 5,
          gstRate: 5,
        },
      });
    }

    return successResponse(res, 200, 'Fee settings retrieved successfully', {
      feeSettings,
    });
  } catch (error) {
    logger.error(`Error fetching public fee settings: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch fee settings');
  }
});

