import CafeWallet from '../models/CafeWallet.js';
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
 * Get Cafe Wallet
 * GET /api/cafe/wallet
 */
export const getWallet = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;

    if (!cafe || !cafe._id) {
      return errorResponse(res, 401, 'Cafe authentication required');
    }

    // Find or create wallet
    const wallet = await CafeWallet.findOrCreateByCafeId(cafe._id);

    // Get recent transactions (last 50)
    const recentTransactions = await CafeTransaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedTransactions = recentTransactions.map(t => ({
      id: t._id,
      amount: t.amount,
      type: t.type,
      status: t.status,
      description: t.description,
      orderId: t.orderId,
      createdAt: t.createdAt,
      processedAt: t.processedAt
    }));

    return successResponse(res, 200, 'Wallet retrieved successfully', {
      wallet: {
        totalBalance: wallet.totalBalance || 0,
        totalEarned: wallet.totalEarned || 0,
        totalWithdrawn: wallet.totalWithdrawn || 0,
        pendingBalance: (wallet.totalEarned || 0) - (wallet.totalWithdrawn || 0),
        isActive: wallet.isActive,
        lastTransactionAt: wallet.lastTransactionAt
      },
      transactions: formattedTransactions
    });
  } catch (error) {
    logger.error(`Error fetching cafe wallet: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch wallet');
  }
});

/**
 * Get Cafe Wallet Transactions
 * GET /api/cafe/wallet/transactions
 * Query params: page, limit, type, status
 */
export const getWalletTransactions = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { page = 1, limit = 20, type, status } = req.query;

    if (!cafe || !cafe._id) {
      return errorResponse(res, 401, 'Cafe authentication required');
    }

    const wallet = await CafeWallet.findOne({ cafeId: cafe._id });

    if (!wallet) {
      return successResponse(res, 200, 'No transactions found', {
        transactions: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    const query = { walletId: wallet._id };
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await CafeTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await CafeTransaction.countDocuments(query);

    return successResponse(res, 200, 'Transactions retrieved successfully', {
      transactions: transactions.map(t => ({
        id: t._id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        orderId: t.orderId,
        createdAt: t.createdAt,
        processedAt: t.processedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching wallet transactions: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch transactions');
  }
});

/**
 * Get Cafe Wallet Stats
 * GET /api/cafe/wallet/stats
 * Query params: startDate, endDate
 */
export const getWalletStats = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { startDate, endDate } = req.query;

    if (!cafe || !cafe._id) {
      return errorResponse(res, 401, 'Cafe authentication required');
    }

    const wallet = await CafeWallet.findOne({ cafeId: cafe._id });

    if (!wallet) {
      return successResponse(res, 200, 'Wallet stats retrieved successfully', {
        totalEarned: 0,
        totalWithdrawn: 0,
        totalBalance: 0,
        periodEarnings: 0,
        periodWithdrawals: 0,
        periodOrders: 0
      });
    }

    const query = { walletId: wallet._id };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Calculate period stats via aggregation for better performance
    const stats = await CafeTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          periodEarnings: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$type', 'payment'] }, { $eq: ['$status', 'Completed'] }] },
                '$amount',
                0
              ]
            }
          },
          periodWithdrawals: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$type', 'withdrawal'] }, { $eq: ['$status', 'Completed'] }] },
                '$amount',
                0
              ]
            }
          },
          periodOrders: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$type', 'payment'] }, { $eq: ['$status', 'Completed'] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || { periodEarnings: 0, periodWithdrawals: 0, periodOrders: 0 };

    return successResponse(res, 200, 'Wallet stats retrieved successfully', {
      totalEarned: wallet.totalEarned || 0,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      totalBalance: wallet.totalBalance || 0,
      pendingBalance: (wallet.totalEarned || 0) - (wallet.totalWithdrawn || 0),
      periodEarnings: result.periodEarnings,
      periodWithdrawals: result.periodWithdrawals,
      periodOrders: result.periodOrders
    });
  } catch (error) {
    logger.error(`Error fetching wallet stats: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch wallet stats');
  }
});
