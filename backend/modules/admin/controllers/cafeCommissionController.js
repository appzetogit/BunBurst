import CafeCommission from '../models/CafeCommission.js';
import Cafe from '../../cafe/models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

/**
 * Get all cafe commissions
 * GET /api/admin/cafe-commission
 * Query params: status, search, page, limit
 */
export const getCafeCommissions = asyncHandler(async (req, res) => {
  try {
    const { 
      status,
      search,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    const query = {};

    // Status filter
    if (status !== undefined) {
      query.status = status === 'true' || status === true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { cafeName: { $regex: search, $options: 'i' } },
        { cafeId: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get total count
    const total = await CafeCommission.countDocuments(query);

    // Get commissions
    const commissions = await CafeCommission.find(query)
      .populate('cafe', 'name cafeId isActive email phone')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Add serial numbers
    const commissionsWithSl = commissions.map((commission, index) => ({
      ...commission,
      sl: skip + index + 1
    }));

    return successResponse(res, 200, 'Cafe commissions retrieved successfully', {
      commissions: commissionsWithSl,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching cafe commissions:', error);
    return errorResponse(res, 500, 'Failed to fetch cafe commissions');
  }
});

/**
 * Get approved cafes (for commission setup)
 * GET /api/admin/cafe-commission/approved-cafes
 */
export const getApprovedCafes = asyncHandler(async (req, res) => {
  try {
    const { 
      search,
      page = 1,
      limit = 100
    } = req.query;

    // Build query - only approved cafes
    const query = {
      isActive: true
    };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { cafeId: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get total count
    const total = await Cafe.countDocuments(query);

    // Get cafes
    const cafes = await Cafe.find(query)
      .select('_id name cafeId ownerName email phone isActive approvedAt businessModel')
      .sort({ approvedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Check which cafes already have commission setup
    const cafeIds = cafes.map(r => r._id);
    const existingCommissions = await CafeCommission.find({
      cafe: { $in: cafeIds }
    }).select('cafe').lean();
    
    const commissionCafeIds = new Set(
      existingCommissions.map(c => c.cafe.toString())
    );

    // Add commission setup status
    const cafesWithStatus = cafes.map(cafe => ({
      ...cafe,
      hasCommissionSetup: commissionCafeIds.has(cafe._id.toString())
    }));

    return successResponse(res, 200, 'Approved cafes retrieved successfully', {
      cafes: cafesWithStatus,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching approved cafes:', error);
    return errorResponse(res, 500, 'Failed to fetch approved cafes');
  }
});

/**
 * Get commission by ID
 * GET /api/admin/cafe-commission/:id
 */
export const getCafeCommissionById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid commission ID');
    }

    const commission = await CafeCommission.findById(id)
      .populate('cafe', 'name cafeId isActive email phone ownerName businessModel')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!commission) {
      return errorResponse(res, 404, 'Cafe commission not found');
    }

    return successResponse(res, 200, 'Cafe commission retrieved successfully', {
      commission
    });
  } catch (error) {
    console.error('Error fetching cafe commission:', error);
    return errorResponse(res, 500, 'Failed to fetch cafe commission');
  }
});

/**
 * Get commission by cafe ID
 * GET /api/admin/cafe-commission/cafe/:cafeId
 */
export const getCommissionByCafeId = asyncHandler(async (req, res) => {
  try {
    const { cafeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(cafeId)) {
      return errorResponse(res, 400, 'Invalid cafe ID');
    }

    const commission = await CafeCommission.findOne({ cafe: cafeId })
      .populate('cafe', 'name cafeId isActive email phone ownerName businessModel')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!commission) {
      return errorResponse(res, 404, 'Commission not found for this cafe');
    }

    return successResponse(res, 200, 'Cafe commission retrieved successfully', {
      commission
    });
  } catch (error) {
    console.error('Error fetching cafe commission:', error);
    return errorResponse(res, 500, 'Failed to fetch cafe commission');
  }
});

/**
 * Create cafe commission
 * POST /api/admin/cafe-commission
 */
export const createCafeCommission = asyncHandler(async (req, res) => {
  try {
    const {
      cafeId,
      commissionRules,
      defaultCommission,
      status,
      notes
    } = req.body;

    const adminId = req.user._id;

    // Validate cafe ID
    if (!mongoose.Types.ObjectId.isValid(cafeId)) {
      return errorResponse(res, 400, 'Invalid cafe ID');
    }

    // Check if cafe exists and is approved
    const cafe = await Cafe.findById(cafeId);
    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    if (!cafe.isActive) {
      return errorResponse(res, 400, 'Cafe is not approved. Please approve the cafe first.');
    }

    // Check if commission already exists
    const existingCommission = await CafeCommission.findOne({ cafe: cafeId });
    if (existingCommission) {
      return errorResponse(res, 400, 'Commission already exists for this cafe. Use update instead.');
    }

    // Validate default commission
    if (!defaultCommission || !defaultCommission.type || defaultCommission.value === undefined) {
      return errorResponse(res, 400, 'Default commission is required');
    }

    if (defaultCommission.type === 'percentage' && (defaultCommission.value < 0 || defaultCommission.value > 100)) {
      return errorResponse(res, 400, 'Percentage must be between 0-100');
    }

    if (defaultCommission.type === 'amount' && defaultCommission.value < 0) {
      return errorResponse(res, 400, 'Amount must be >= 0');
    }

    // Validate commission rules
    if (commissionRules && Array.isArray(commissionRules)) {
      for (const rule of commissionRules) {
        if (!rule.type || rule.value === undefined) {
          return errorResponse(res, 400, 'Each commission rule must have type and value');
        }

        if (rule.type === 'percentage' && (rule.value < 0 || rule.value > 100)) {
          return errorResponse(res, 400, 'Percentage in commission rules must be between 0-100');
        }

        if (rule.type === 'amount' && rule.value < 0) {
          return errorResponse(res, 400, 'Amount in commission rules must be >= 0');
        }

        if (rule.minOrderAmount === undefined || rule.minOrderAmount < 0) {
          return errorResponse(res, 400, 'minOrderAmount is required and must be >= 0');
        }

        if (rule.maxOrderAmount !== null && rule.maxOrderAmount !== undefined) {
          if (rule.maxOrderAmount <= rule.minOrderAmount) {
            return errorResponse(res, 400, 'maxOrderAmount must be greater than minOrderAmount');
          }
        }
      }
    }

    // Create commission
    const commission = new CafeCommission({
      cafe: cafeId,
      cafeName: cafe.name,
      cafeId: cafe.cafeId,
      commissionRules: commissionRules || [],
      defaultCommission: {
        type: defaultCommission.type,
        value: defaultCommission.value
      },
      status: status !== undefined ? status : true,
      notes: notes || '',
      createdBy: adminId
    });

    await commission.save();

    // Create audit log
    try {
      await AuditLog.createLog({
        entityType: 'commission',
        entityId: commission._id,
        action: 'create_cafe_commission',
        actionType: 'create',
        performedBy: {
          type: 'admin',
          userId: adminId,
          name: req.user?.name || 'Admin'
        },
        commissionChange: {
          cafeId: cafeId,
          newValue: defaultCommission.value,
          newType: defaultCommission.type,
          reason: 'Commission created'
        },
        description: `Cafe commission created for ${cafe.name}`
      });
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail commission creation if audit log fails
    }

    // Populate and return
    const populatedCommission = await CafeCommission.findById(commission._id)
      .populate('cafe', 'name cafeId isActive email phone')
      .populate('createdBy', 'name email')
      .lean();

    return successResponse(res, 201, 'Cafe commission created successfully', {
      commission: populatedCommission
    });
  } catch (error) {
    console.error('Error creating cafe commission:', error);
    
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Commission already exists for this cafe');
    }
    
    return errorResponse(res, 500, 'Failed to create cafe commission');
  }
});

/**
 * Update cafe commission
 * PUT /api/admin/cafe-commission/:id
 */
export const updateCafeCommission = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      commissionRules,
      defaultCommission,
      status,
      notes
    } = req.body;

    const adminId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid commission ID');
    }

    const commission = await CafeCommission.findById(id);
    if (!commission) {
      return errorResponse(res, 404, 'Cafe commission not found');
    }

    // Validate default commission if provided
    if (defaultCommission) {
      if (!defaultCommission.type || defaultCommission.value === undefined) {
        return errorResponse(res, 400, 'Default commission must have type and value');
      }

      if (defaultCommission.type === 'percentage' && (defaultCommission.value < 0 || defaultCommission.value > 100)) {
        return errorResponse(res, 400, 'Percentage must be between 0-100');
      }

      if (defaultCommission.type === 'amount' && defaultCommission.value < 0) {
        return errorResponse(res, 400, 'Amount must be >= 0');
      }

      commission.defaultCommission = {
        type: defaultCommission.type,
        value: defaultCommission.value
      };
    }

    // Validate and update commission rules if provided
    if (commissionRules !== undefined) {
      if (!Array.isArray(commissionRules)) {
        return errorResponse(res, 400, 'Commission rules must be an array');
      }

      for (const rule of commissionRules) {
        if (!rule.type || rule.value === undefined) {
          return errorResponse(res, 400, 'Each commission rule must have type and value');
        }

        if (rule.type === 'percentage' && (rule.value < 0 || rule.value > 100)) {
          return errorResponse(res, 400, 'Percentage in commission rules must be between 0-100');
        }

        if (rule.type === 'amount' && rule.value < 0) {
          return errorResponse(res, 400, 'Amount in commission rules must be >= 0');
        }

        if (rule.minOrderAmount === undefined || rule.minOrderAmount < 0) {
          return errorResponse(res, 400, 'minOrderAmount is required and must be >= 0');
        }

        if (rule.maxOrderAmount !== null && rule.maxOrderAmount !== undefined) {
          if (rule.maxOrderAmount <= rule.minOrderAmount) {
            return errorResponse(res, 400, 'maxOrderAmount must be greater than minOrderAmount');
          }
        }
      }

      commission.commissionRules = commissionRules;
    }

    // Update other fields
    if (status !== undefined) {
      commission.status = status;
    }

    if (notes !== undefined) {
      commission.notes = notes;
    }

    // Store old values for audit log
    const oldDefaultCommission = {
      type: commission.defaultCommission.type,
      value: commission.defaultCommission.value
    };

    commission.updatedBy = adminId;

    await commission.save();

    // Create audit log for commission change
    if (defaultCommission && (
      oldDefaultCommission.value !== defaultCommission.value ||
      oldDefaultCommission.type !== defaultCommission.type
    )) {
      try {
        await AuditLog.createLog({
          entityType: 'commission',
          entityId: commission._id,
          action: 'update_cafe_commission',
          actionType: 'commission_change',
          performedBy: {
            type: 'admin',
            userId: adminId,
            name: req.user?.name || 'Admin'
          },
          changes: {
            before: oldDefaultCommission,
            after: defaultCommission
          },
          commissionChange: {
            cafeId: commission.cafe,
            oldValue: oldDefaultCommission.value,
            newValue: defaultCommission.value,
            oldType: oldDefaultCommission.type,
            newType: defaultCommission.type,
            reason: notes || 'Commission updated'
          },
          description: `Cafe commission updated for ${commission.cafeName}`
        });
      } catch (auditError) {
        console.error('Error creating audit log:', auditError);
        // Don't fail commission update if audit log fails
      }
    }

    // Populate and return
    const populatedCommission = await CafeCommission.findById(commission._id)
      .populate('cafe', 'name cafeId isActive email phone')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    return successResponse(res, 200, 'Cafe commission updated successfully', {
      commission: populatedCommission
    });
  } catch (error) {
    console.error('Error updating cafe commission:', error);
    return errorResponse(res, 500, 'Failed to update cafe commission');
  }
});

/**
 * Delete cafe commission
 * DELETE /api/admin/cafe-commission/:id
 */
export const deleteCafeCommission = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid commission ID');
    }

    const commission = await CafeCommission.findById(id);
    if (!commission) {
      return errorResponse(res, 404, 'Cafe commission not found');
    }

    await CafeCommission.findByIdAndDelete(id);

    return successResponse(res, 200, 'Cafe commission deleted successfully');
  } catch (error) {
    console.error('Error deleting cafe commission:', error);
    return errorResponse(res, 500, 'Failed to delete cafe commission');
  }
});

/**
 * Toggle commission status
 * PATCH /api/admin/cafe-commission/:id/status
 */
export const toggleCafeCommissionStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid commission ID');
    }

    const commission = await CafeCommission.findById(id);
    if (!commission) {
      return errorResponse(res, 404, 'Cafe commission not found');
    }

    commission.status = !commission.status;
    commission.updatedBy = adminId;

    await commission.save();

    return successResponse(res, 200, `Commission ${commission.status ? 'enabled' : 'disabled'} successfully`, {
      commission: {
        _id: commission._id,
        status: commission.status
      }
    });
  } catch (error) {
    console.error('Error toggling commission status:', error);
    return errorResponse(res, 500, 'Failed to toggle commission status');
  }
});

/**
 * Calculate commission for an order
 * POST /api/admin/cafe-commission/calculate
 */
export const calculateCommission = asyncHandler(async (req, res) => {
  try {
    const { cafeId, orderAmount } = req.body;

    if (!cafeId || !orderAmount) {
      return errorResponse(res, 400, 'Cafe ID and order amount are required');
    }

    if (!mongoose.Types.ObjectId.isValid(cafeId)) {
      return errorResponse(res, 400, 'Invalid cafe ID');
    }

    const orderAmountNum = parseFloat(orderAmount);
    if (isNaN(orderAmountNum) || orderAmountNum < 0) {
      return errorResponse(res, 400, 'Order amount must be a valid positive number');
    }

    const result = await CafeCommission.calculateCommissionForOrder(cafeId, orderAmountNum);

    return successResponse(res, 200, 'Commission calculated successfully', {
      calculation: result
    });
  } catch (error) {
    console.error('Error calculating commission:', error);
    return errorResponse(res, 500, 'Failed to calculate commission');
  }
});

