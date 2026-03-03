import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import EarningAddon from '../models/EarningAddon.js';
import EarningAddonHistory from '../models/EarningAddonHistory.js';
import Delivery from '../../delivery/models/Delivery.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import Order from '../../order/models/Order.js';
import mongoose from 'mongoose';
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

/**
 * Create Earning Addon Offer
 * POST /api/admin/earning-addon
 */
export const createEarningAddon = asyncHandler(async (req, res) => {
  return errorResponse(res, 400, 'Earning addon system is disabled. The system has transitioned to a fixed salary model.');
});

/**
 * Get All Earning Addons
 * GET /api/admin/earning-addon
 */
export const getEarningAddons = asyncHandler(async (req, res) => {
  return successResponse(res, 200, 'Earning addons retrieved successfully', {
    earningAddons: [],
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      pages: 0
    }
  });
});

/**
 * Get Earning Addon by ID
 * GET /api/admin/earning-addon/:id
 */
export const getEarningAddonById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid earning addon ID');
    }

    const earningAddon = await EarningAddon.findById(id)
      .populate('createdBy', 'name email')
      .populate('applicableZones', 'name')
      .lean();

    if (!earningAddon) {
      return errorResponse(res, 404, 'Earning addon not found');
    }

    // Check validity
    const now = new Date();
    const isValid = earningAddon.status === 'active' &&
      now >= new Date(earningAddon.startDate) &&
      now <= new Date(earningAddon.endDate) &&
      (earningAddon.maxRedemptions === null || earningAddon.currentRedemptions < earningAddon.maxRedemptions);

    // Get completion statistics
    const [totalCompletions, pendingCompletions, creditedCompletions] = await Promise.all([
      EarningAddonHistory.countDocuments({ earningAddonId: id }),
      EarningAddonHistory.countDocuments({ earningAddonId: id, status: 'pending' }),
      EarningAddonHistory.countDocuments({ earningAddonId: id, status: 'credited' })
    ]);

    return successResponse(res, 200, 'Earning addon retrieved successfully', {
      earningAddon: {
        ...earningAddon,
        isValid
      },
      statistics: {
        totalCompletions,
        pendingCompletions,
        creditedCompletions
      }
    });
  } catch (error) {
    logger.error(`Error fetching earning addon: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to fetch earning addon');
  }
});

/**
 * Update Earning Addon
 * PUT /api/admin/earning-addon/:id
 */
export const updateEarningAddon = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid earning addon ID');
    }

    const earningAddon = await EarningAddon.findById(id);
    if (!earningAddon) {
      return errorResponse(res, 404, 'Earning addon not found');
    }

    // Validate dates if provided
    if (updateData.startDate || updateData.endDate) {
      const start = updateData.startDate ? new Date(updateData.startDate) : earningAddon.startDate;
      const end = updateData.endDate ? new Date(updateData.endDate) : earningAddon.endDate;

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return errorResponse(res, 400, 'Invalid date format');
      }

      if (end <= start) {
        return errorResponse(res, 400, 'End date must be after start date');
      }

      updateData.startDate = start;
      updateData.endDate = end;
    }

    // Validate numbers
    if (updateData.requiredOrders !== undefined && updateData.requiredOrders < 1) {
      return errorResponse(res, 400, 'Required orders must be at least 1');
    }

    if (updateData.earningAmount !== undefined && updateData.earningAmount <= 0) {
      return errorResponse(res, 400, 'Earning amount must be greater than 0');
    }

    // Update
    Object.assign(earningAddon, updateData);
    await earningAddon.save();

    logger.info(`Earning addon updated: ${id}`);

    return successResponse(res, 200, 'Earning addon updated successfully', {
      earningAddon
    });
  } catch (error) {
    logger.error(`Error updating earning addon: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, `Failed to update earning addon: ${error.message}`);
  }
});

/**
 * Delete Earning Addon
 * DELETE /api/admin/earning-addon/:id
 */
export const deleteEarningAddon = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid earning addon ID');
    }

    const earningAddon = await EarningAddon.findById(id);
    if (!earningAddon) {
      return errorResponse(res, 404, 'Earning addon not found');
    }

    // Check if there are any completions
    const completionsCount = await EarningAddonHistory.countDocuments({ earningAddonId: id });
    if (completionsCount > 0) {
      // Soft delete - just mark as inactive
      earningAddon.status = 'inactive';
      await earningAddon.save();
      logger.info(`Earning addon soft deleted (marked inactive): ${id}`);
      return successResponse(res, 200, 'Earning addon deactivated successfully (has completion history)');
    }

    // Hard delete if no completions
    await EarningAddon.findByIdAndDelete(id);
    logger.info(`Earning addon deleted: ${id}`);

    return successResponse(res, 200, 'Earning addon deleted successfully');
  } catch (error) {
    logger.error(`Error deleting earning addon: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to delete earning addon');
  }
});

/**
 * Toggle Earning Addon Status
 * PATCH /api/admin/earning-addon/:id/status
 */
export const toggleEarningAddonStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid earning addon ID');
    }

    if (!['active', 'inactive'].includes(status)) {
      return errorResponse(res, 400, 'Status must be either active or inactive');
    }

    const earningAddon = await EarningAddon.findById(id);
    if (!earningAddon) {
      return errorResponse(res, 404, 'Earning addon not found');
    }

    earningAddon.status = status;
    await earningAddon.save();

    logger.info(`Earning addon status updated: ${id} to ${status}`);

    return successResponse(res, 200, 'Earning addon status updated successfully', {
      earningAddon
    });
  } catch (error) {
    logger.error(`Error updating earning addon status: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to update earning addon status');
  }
});

/**
 * Check and Process Earning Addon Completions
 * This should be called periodically or when an order is completed
 * POST /api/admin/earning-addon/check-completions
 */
export const checkEarningAddonCompletions = asyncHandler(async (req, res) => {
  return successResponse(res, 200, 'Completions checked successfully', {
    completionsFound: 0,
    completions: []
  });
});

