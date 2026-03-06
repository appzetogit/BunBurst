import WithdrawalRequest from '../models/WithdrawalRequest.js';
import CafeWallet from '../models/CafeWallet.js';
import Cafe from '../models/Cafe.js';
import CafeTransaction from '../models/CafeTransaction.js';
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

/**
 * Create Withdrawal Request
 * POST /api/cafe/withdrawal/request
 */
export const createWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { amount } = req.body;

    if (!cafe || !cafe._id) {
      return errorResponse(res, 401, 'Cafe authentication required');
    }

    if (!amount || amount <= 0) {
      return errorResponse(res, 400, 'Valid withdrawal amount is required');
    }

    // Get cafe wallet
    const wallet = await CafeWallet.findOrCreateByCafeId(cafe._id);

    // Check if sufficient balance
    const availableBalance = wallet.totalBalance || 0;
    if (amount > availableBalance) {
      return errorResponse(res, 400, 'Insufficient balance. Available balance: ₹' + availableBalance.toFixed(2));
    }

    // Check for pending requests
    const pendingRequest = await WithdrawalRequest.findOne({
      cafeId: cafe._id,
      status: 'Pending'
    });

    if (pendingRequest) {
      return errorResponse(res, 400, 'You already have a pending withdrawal request');
    }

    // Get cafe details
    const cafeDetails = await Cafe.findById(cafe._id).select('name cafeId');

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create({
      cafeId: cafe._id,
      amount: parseFloat(amount),
      status: 'Pending',
      cafeName: cafeDetails?.name || cafe.name || 'Unknown',
      cafeIdString: cafeDetails?.cafeId || cafe.cafeId || cafe._id.toString()
    });

    // Deduct balance immediately when withdrawal request is created
    // Create a pending withdrawal transaction
    const withdrawalRequestId = withdrawalRequest._id.toString();
    const transaction = await wallet.addTransaction({
      amount: parseFloat(amount),
      type: 'withdrawal',
      status: 'Pending',
      description: `Withdrawal request created - Request ID: ${withdrawalRequestId}`
    });

    // Manually deduct from balance (since addTransaction only deducts when status is 'Completed')
    wallet.totalBalance = Math.max(0, (wallet.totalBalance || 0) - parseFloat(amount));
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + parseFloat(amount);
    await wallet.save();

    // Link transaction ID to withdrawal request for easier tracking
    withdrawalRequest.transactionId = transaction._id;
    await withdrawalRequest.save();

    logger.info(`Withdrawal request created: ${withdrawalRequest._id} for cafe: ${cafe._id}, amount: ${amount}. Balance deducted immediately.`);

    return successResponse(res, 201, 'Withdrawal request created successfully', {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        requestedAt: withdrawalRequest.requestedAt,
        createdAt: withdrawalRequest.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error creating withdrawal request: ${error.message}`);
    return errorResponse(res, 500, 'Failed to create withdrawal request');
  }
});

/**
 * Get Cafe Withdrawal Requests (for cafe)
 * GET /api/cafe/withdrawal/requests
 */
export const getCafeWithdrawalRequests = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { status, page = 1, limit = 20 } = req.query;

    if (!cafe || !cafe._id) {
      return errorResponse(res, 401, 'Cafe authentication required');
    }

    const query = { cafeId: cafe._id };
    if (status && ['Pending', 'Approved', 'Rejected', 'Processed'].includes(status)) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const requests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('processedBy', 'name email')
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    return successResponse(res, 200, 'Withdrawal requests retrieved successfully', {
      requests: requests.map(req => ({
        id: req._id,
        amount: req.amount,
        status: req.status,
        requestedAt: req.requestedAt,
        processedAt: req.processedAt,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching withdrawal requests: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch withdrawal requests');
  }
});

/**
 * Get All Withdrawal Requests (for admin)
 * GET /api/admin/withdrawal/requests
 */
export const getAllWithdrawalRequests = asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = {};
    if (status && ['Pending', 'Approved', 'Rejected', 'Processed'].includes(status)) {
      query.status = status;
    }

    // Search by cafe name or ID
    if (search) {
      query.$or = [
        { cafeName: { $regex: search, $options: 'i' } },
        { cafeIdString: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const requests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('cafeId', 'name cafeId address')
      .populate('processedBy', 'name email')
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    return successResponse(res, 200, 'Withdrawal requests retrieved successfully', {
      requests: requests.map(req => ({
        id: req._id,
        cafeId: req.cafeId?._id || req.cafeId,
        cafeName: req.cafeName || req.cafeId?.name || 'Unknown',
        cafeIdString: req.cafeIdString || req.cafeId?.cafeId || 'N/A',
        cafeAddress: req.cafeId?.address || 'N/A',
        amount: req.amount,
        status: req.status,
        requestedAt: req.requestedAt,
        processedAt: req.processedAt,
        processedBy: req.processedBy ? {
          name: req.processedBy.name,
          email: req.processedBy.email
        } : null,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching all withdrawal requests: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch withdrawal requests');
  }
});

/**
 * Approve Withdrawal Request (admin only)
 * POST /api/admin/withdrawal/:id/approve
 */
export const approveWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const { id } = req.params;

    if (!admin || !admin._id) {
      return errorResponse(res, 401, 'Admin authentication required');
    }

    const withdrawalRequest = await WithdrawalRequest.findById(id).populate('cafeId');

    if (!withdrawalRequest) {
      return errorResponse(res, 404, 'Withdrawal request not found');
    }

    if (withdrawalRequest.status !== 'Pending') {
      return errorResponse(res, 400, `Withdrawal request is already ${withdrawalRequest.status}`);
    }

    // Get cafe wallet
    const wallet = await CafeWallet.findOrCreateByCafeId(withdrawalRequest.cafeId._id);

    // Update withdrawal request
    withdrawalRequest.status = 'Approved';
    withdrawalRequest.processedAt = new Date();
    withdrawalRequest.processedBy = admin._id;
    await withdrawalRequest.save();

    // Find and update the pending withdrawal transaction to Completed
    // Balance was already deducted when request was created, so we just mark transaction as completed
    let pendingTransaction = null;

    if (withdrawalRequest.transactionId) {
      // Find transaction by ID if linked
      pendingTransaction = await CafeTransaction.findById(withdrawalRequest.transactionId);
    }

    if (!pendingTransaction) {
      // Fallback: find by description
      pendingTransaction = await CafeTransaction.findOne({
        walletId: wallet._id,
        type: 'withdrawal',
        status: 'Pending',
        description: { $regex: withdrawalRequest._id.toString() }
      });
    }

    if (pendingTransaction) {
      // Update transaction status to Completed
      pendingTransaction.status = 'Completed';
      pendingTransaction.processedAt = new Date();
      await pendingTransaction.save();
      // Balance was already deducted, so no need to deduct again
    } else {
      // If transaction not found, create a new one (fallback)
      await wallet.addTransaction({
        amount: withdrawalRequest.amount,
        type: 'withdrawal',
        status: 'Completed',
        description: `Withdrawal request approved - Request ID: ${withdrawalRequest._id}`
      });
      // Balance already deducted, so we don't deduct again
    }

    await wallet.save();

    logger.info(`Withdrawal request approved: ${id} by admin: ${admin._id}`);

    return successResponse(res, 200, 'Withdrawal request approved successfully', {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        processedAt: withdrawalRequest.processedAt
      }
    });
  } catch (error) {
    logger.error(`Error approving withdrawal request: ${error.message}`);
    return errorResponse(res, 500, 'Failed to approve withdrawal request');
  }
});

/**
 * Reject Withdrawal Request (admin only)
 * POST /api/admin/withdrawal/:id/reject
 */
export const rejectWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!admin || !admin._id) {
      return errorResponse(res, 401, 'Admin authentication required');
    }

    const withdrawalRequest = await WithdrawalRequest.findById(id);

    if (!withdrawalRequest) {
      return errorResponse(res, 404, 'Withdrawal request not found');
    }

    if (withdrawalRequest.status !== 'Pending') {
      return errorResponse(res, 400, `Withdrawal request is already ${withdrawalRequest.status}`);
    }

    // Get cafe wallet to refund the balance
    const wallet = await CafeWallet.findOrCreateByCafeId(withdrawalRequest.cafeId);

    // Update withdrawal request
    withdrawalRequest.status = 'Rejected';
    withdrawalRequest.processedAt = new Date();
    withdrawalRequest.processedBy = admin._id;
    if (rejectionReason) {
      withdrawalRequest.rejectionReason = rejectionReason;
    }
    await withdrawalRequest.save();

    // Find and update the pending withdrawal transaction to Cancelled
    // Refund the balance back
    let pendingTransaction = null;

    if (withdrawalRequest.transactionId) {
      // Find transaction by ID if linked
      pendingTransaction = await CafeTransaction.findById(withdrawalRequest.transactionId);
    }

    if (!pendingTransaction) {
      // Fallback: find by description
      pendingTransaction = await CafeTransaction.findOne({
        walletId: wallet._id,
        type: 'withdrawal',
        status: 'Pending',
        description: { $regex: withdrawalRequest._id.toString() }
      });
    }

    if (pendingTransaction) {
      // Update transaction status to Cancelled
      pendingTransaction.status = 'Cancelled';
      pendingTransaction.processedAt = new Date();
      await pendingTransaction.save();

      // Refund the balance back
      wallet.totalBalance = (wallet.totalBalance || 0) + withdrawalRequest.amount;
      wallet.totalWithdrawn = Math.max(0, (wallet.totalWithdrawn || 0) - withdrawalRequest.amount);
    } else {
      // If transaction not found, create a refund transaction (fallback)
      await wallet.addTransaction({
        amount: withdrawalRequest.amount,
        type: 'refund',
        status: 'Completed',
        description: `Withdrawal request rejected - Refund for Request ID: ${withdrawalRequest._id}`
      });
      // Refund the balance
      wallet.totalBalance = (wallet.totalBalance || 0) + withdrawalRequest.amount;
      wallet.totalWithdrawn = Math.max(0, (wallet.totalWithdrawn || 0) - withdrawalRequest.amount);
    }

    await wallet.save();

    logger.info(`Withdrawal request rejected: ${id} by admin: ${admin._id}. Balance refunded.`);

    return successResponse(res, 200, 'Withdrawal request rejected successfully', {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        processedAt: withdrawalRequest.processedAt,
        rejectionReason: withdrawalRequest.rejectionReason
      }
    });
  } catch (error) {
    logger.error(`Error rejecting withdrawal request: ${error.message}`);
    return errorResponse(res, 500, 'Failed to reject withdrawal request');
  }
});
