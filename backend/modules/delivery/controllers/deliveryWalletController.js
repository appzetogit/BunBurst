import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import DeliveryTransaction from '../models/DeliveryTransaction.js';
import Order from '../../order/models/Order.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
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

/**
 * Get Wallet Balance
 * GET /api/delivery/wallet
 * Returns simplified wallet information for salaried delivery partners
 */
export const getWallet = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;

    // Find or create wallet for this delivery partner
    let wallet = await DeliveryWallet.findOne({ deliveryId: delivery._id });

    if (!wallet) {
      wallet = await DeliveryWallet.create({
        deliveryId: delivery._id,
        totalBalance: 0,
        cashInHand: 0,
        totalWithdrawn: 0,
        totalEarned: 0
      });
    }

    // Get recent transactions (last 10)
    const recentTransactionsRaw = await DeliveryTransaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const transactions = recentTransactionsRaw.map(t => ({
      id: t._id,
      _id: t._id,
      amount: t.amount,
      type: t.type,
      status: t.status,
      description: t.description,
      date: t.createdAt,
      createdAt: t.createdAt,
      orderId: t.orderId
    }));

    const totalTransactions = await DeliveryTransaction.countDocuments({ walletId: wallet._id });

    // For salaried model, we only display bonus/pocket balance and transaction history
    // Cash limit and withdrawal related fields are set to 0 or removed
    const walletData = {
      totalBalance: wallet.totalBalance || 0,
      pocketBalance: wallet.totalBalance || 0,
      cashInHand: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      totalCashLimit: 0,
      availableCashLimit: 0,
      deliveryWithdrawalLimit: 0,
      pendingWithdrawals: 0,
      transactions: transactions,
      recentTransactions: transactions,
      totalTransactions: totalTransactions,
      salary: delivery.salary || 0,
      salaryCycle: delivery.salaryCycle || 'monthly'
    };

    return successResponse(res, 200, 'Wallet information retrieved successfully', {
      wallet: walletData
    });
  } catch (error) {
    logger.error('Error fetching delivery wallet:', error);
    return errorResponse(res, 500, 'Failed to fetch wallet information');
  }
});

/**
 * Get Transaction History
 * GET /api/delivery/wallet/transactions
 */
export const getTransactions = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { type, status, page = 1, limit = 20 } = req.query;

    let wallet = await DeliveryWallet.findOne({ deliveryId: delivery._id });

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

    const total = await DeliveryTransaction.countDocuments(query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await DeliveryTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return successResponse(res, 200, 'Transactions retrieved successfully', {
      transactions: transactions.map(t => ({
        id: t._id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        date: t.createdAt,
        orderId: t.orderId,
        processedAt: t.processedAt,
        failureReason: t.failureReason
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    return errorResponse(res, 500, 'Failed to fetch transactions');
  }
});

/**
 * Get Wallet Statistics
 * GET /api/delivery/wallet/stats
 */
export const getWalletStats = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { period = 'week' } = req.query;

    const wallet = await DeliveryWallet.findOne({ deliveryId: delivery._id });

    if (!wallet) {
      return successResponse(res, 200, 'No statistics available', {
        earnings: 0,
        withdrawals: 0,
        transactions: 0,
        period
      });
    }

    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
    }

    const periodTransactions = await DeliveryTransaction.find({
      walletId: wallet._id,
      createdAt: { $gte: startDate, $lte: now }
    }).lean();

    // In salaried model, "earnings" in the wallet usually refers to bonuses or other payments
    const bonusAmount = periodTransactions
      .filter(t => t.type === 'bonus' && t.status === 'Completed')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return successResponse(res, 200, 'Statistics retrieved successfully', {
      earnings: bonusAmount,
      withdrawals: 0,
      transactions: periodTransactions.length,
      period,
      startDate,
      endDate: now
    });
  } catch (error) {
    logger.error('Error fetching statistics:', error);
    return errorResponse(res, 500, 'Failed to fetch statistics');
  }
});

/**
 * Add Delivery Earning (Internal)
 * For salaried model, this might still be called but should add 0 to the wallet
 */
export const addEarning = asyncHandler(async (req, res) => {
  // Salaried partners don't get per-order commissions. 
  // We return success but don't add monetary value.
  return successResponse(res, 200, 'Salaried partner, no commission added');
});

/**
 * Claim Joining Bonus
 * Still allowing bonuses as they might be separate from monthly salary
 */
export const claimJoiningBonus = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    let wallet = await DeliveryWallet.findOrCreateByDeliveryId(delivery._id);

    if (wallet.joiningBonusClaimed) {
      return errorResponse(res, 400, 'Bonus already claimed');
    }

    const completedOrders = await Order.countDocuments({
      deliveryPartnerId: delivery._id,
      status: 'delivered'
    });

    if (completedOrders < 1) {
      return errorResponse(res, 400, 'Complete at least 1 order to unlock bonus');
    }

    const bonusAmount = 100;
    const transaction = await wallet.addTransaction({
      amount: bonusAmount,
      type: 'bonus',
      status: 'Completed',
      description: 'Joining bonus reward'
    });

    wallet.joiningBonusClaimed = true;
    wallet.joiningBonusAmount = bonusAmount;
    await wallet.save();

    return successResponse(200, 'Bonus claimed successfully', { bonusAmount });
  } catch (error) {
    logger.error('Error claiming bonus:', error);
    return errorResponse(res, 500, 'Failed to claim bonus');
  }
});
