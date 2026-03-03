import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../models/Delivery.js';
import Order from '../../order/models/Order.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import EarningAddon from '../../admin/models/EarningAddon.js';
import EarningAddonHistory from '../../admin/models/EarningAddonHistory.js';
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
 * Get Delivery Partner Earnings
 * GET /api/delivery/earnings
 * Query params: period (today, week, month, all), page, limit, date (for specific date/week/month)
 */
export const getEarnings = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { period = 'all', page = 1, limit = 1000, date } = req.query;

    // Calculate date range based on period and optional date parameter
    let startDate = null;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of day

    // If date is provided, use it as base date for period calculation
    const baseDate = date ? new Date(date) : new Date();

    switch (period) {
      case 'today':
        startDate = new Date(baseDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(baseDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Get week range (Monday to Sunday)
        startDate = new Date(baseDate);
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'all':
      default:
        startDate = null;
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    // Get or create wallet for delivery partner
    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(delivery._id);

    // Filter transactions based on period and type
    let transactions = wallet.transactions || [];

    // Filter by transaction type (only 'payment' type for earnings)
    transactions = transactions.filter(t =>
      t.type === 'payment' &&
      t.status === 'Completed'
    );

    // Filter by date range if period is specified
    if (startDate) {
      transactions = transactions.filter(t => {
        const transactionDate = t.createdAt || t.processedAt || new Date();
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => {
      const dateA = a.createdAt || a.processedAt || new Date(0);
      const dateB = b.createdAt || b.processedAt || new Date(0);
      return dateB - dateA;
    });

    // Get order details for each transaction
    const orderIds = transactions
      .filter(t => t.orderId)
      .map(t => t.orderId);

    // Fetch orders in batch
    const orders = await Order.find({
      _id: { $in: orderIds }
    })
      .select('orderId restaurantName deliveredAt createdAt')
      .lean();

    // Create order map for quick lookup
    const orderMap = {};
    orders.forEach(order => {
      orderMap[order._id.toString()] = order;
    });

    // For salaried employees, per-order earnings are always 0
    const earnings = transactions.map(transaction => {
      const order = transaction.orderId ? orderMap[transaction.orderId.toString()] : null;
      return {
        transactionId: transaction._id?.toString(),
        orderId: order?.orderId || transaction.orderId?.toString() || 'Unknown',
        restaurantName: order?.restaurantName || 'Unknown Restaurant',
        amount: 0, // Force to 0 for salaried model
        description: transaction.description || '',
        deliveredAt: order?.deliveredAt || transaction.createdAt || transaction.processedAt,
        createdAt: transaction.createdAt || transaction.processedAt,
        paymentCollected: transaction.paymentCollected || false
      };
    });

    // Calculate pagination
    const totalEarnings = earnings.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedEarnings = earnings.slice(skip, skip + parseInt(limit));

    // Summary statistics for salaried model (always 0)
    return successResponse(res, 200, 'Earnings retrieved successfully', {
      earnings: paginatedEarnings,
      summary: {
        period,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        totalOrders: earnings.length,
        totalEarnings: 0,
        totalHours: 0,
        totalMinutes: 0,
        orderEarning: 0,
        incentive: 0,
        otherEarnings: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalEarnings,
        pages: Math.ceil(totalEarnings / parseInt(limit))
      },
      salary: delivery.salary,
      joiningDate: delivery.joiningDate
    });
  } catch (error) {
    logger.error(`Error fetching delivery earnings: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch earnings');
  }
});

/**
 * Get Active Earning Addon Offers for Delivery Partner
 * GET /api/delivery/earnings/active-offers
 */
export const getActiveEarningAddons = asyncHandler(async (req, res) => {
  try {
    // For salaried employees, earning addons are disabled
    return successResponse(res, 200, 'Active earning addons retrieved successfully', {
      activeOffers: []
    });
  } catch (error) {
    logger.error(`Error fetching active earning addons: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch active earning addons');
  }
});

