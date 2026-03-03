import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../models/Delivery.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import Order from '../../order/models/Order.js';
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
 * Get Delivery Boy Dashboard Data
 * Returns wallet balance, stats, joining bonus status, and recent orders
 */
export const getDashboard = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery; // From authenticate middleware

    // Get order statistics
    // Note: deliveryPartnerId in Order model references User, but we'll use delivery._id
    // In future, this should be updated to reference Delivery model
    let totalOrders = 0;
    let completedOrders = 0;
    let pendingOrders = 0;

    try {
      totalOrders = await Order.countDocuments({
        deliveryPartnerId: delivery._id
      });
    } catch (error) {
      logger.warn(`Error counting total orders for delivery ${delivery._id}:`, error);
    }

    try {
      completedOrders = await Order.countDocuments({
        deliveryPartnerId: delivery._id,
        status: 'delivered'
      });
    } catch (error) {
      logger.warn(`Error counting completed orders for delivery ${delivery._id}:`, error);
    }

    try {
      pendingOrders = await Order.countDocuments({
        deliveryPartnerId: delivery._id,
        status: { $in: ['out_for_delivery', 'ready'] }
      });
    } catch (error) {
      logger.warn(`Error counting pending orders for delivery ${delivery._id}:`, error);
    }

    // Prepare dashboard data (Salaried model)
    const dashboardData = {
      profile: {
        id: delivery._id,
        deliveryId: delivery.deliveryId,
        name: delivery.name,
        phone: delivery.phone,
        email: delivery.email,
        profileImage: delivery.profileImage?.url || null,
        status: delivery.status,
        level: delivery.level,
        rating: delivery.metrics?.rating || 0,
        ratingCount: delivery.metrics?.ratingCount || 0,
        salary: delivery.salary || { type: 'fixed', amount: 0 },
        joiningDate: delivery.joiningDate
      },
      wallet: {
        balance: 0,
        totalEarned: 0,
        currentBalance: 0,
        pendingPayout: 0,
        tips: 0,
        todayEarnings: 0,
        weeklyEarnings: 0,
      },
      stats: {
        totalOrders: totalOrders,
        completedOrders: completedOrders,
        pendingOrders: pendingOrders,
        cancelledOrders: delivery.metrics?.cancelledOrders || 0,
        onTimeDeliveryRate: delivery.metrics?.onTimeDeliveryRate || 0,
        averageDeliveryTime: delivery.metrics?.averageDeliveryTime || 0,
      },
      joiningBonus: {
        amount: 0,
        unlocked: false,
        claimed: true, // Mark as claimed to hide UI
        unlockThreshold: 1,
        ordersCompleted: completedOrders,
        ordersRequired: 1,
        message: 'Salaried model - no joining bonus',
      },
      recentOrders: recentOrders.map(order => ({
        orderId: order.orderId,
        status: order.status,
        restaurantName: order.restaurantName,
        deliveryFee: 0, // Force to 0 for display
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
      })),
      availability: {
        isOnline: delivery.availability?.isOnline || false,
        lastLocationUpdate: delivery.availability?.lastLocationUpdate || null,
      }
    };

    logger.info(`Dashboard data retrieved for delivery: ${delivery._id}`, {
      deliveryId: delivery.deliveryId,
      totalOrders,
      completedOrders,
    });

    return successResponse(res, 200, 'Dashboard data retrieved successfully', dashboardData);
  } catch (error) {
    logger.error('Error fetching delivery dashboard:', error);
    return errorResponse(res, 500, 'Failed to fetch dashboard data');
  }
});

/**
 * Get Wallet Balance (DEPRECATED - Use /api/delivery/wallet instead)
 * Returns detailed wallet information
 * This endpoint is kept for backward compatibility
 */
export const getWalletBalance = asyncHandler(async (req, res) => {
  try {
    // For salaried model, wallet/commission balance is always 0
    const walletData = {
      balance: 0,
      totalEarned: 0,
      currentBalance: 0,
      pendingPayout: 0,
      tips: 0,
      transactions: [],
      joiningBonusClaimed: true,
    };

    return successResponse(res, 200, 'Wallet balance retrieved successfully', walletData);
  } catch (error) {
    logger.error('Error fetching wallet balance:', error);
    return errorResponse(res, 500, 'Failed to fetch wallet balance');
  }
});

/**
 * Claim Joining Bonus (DEPRECATED - Use /api/delivery/wallet/claim-joining-bonus instead)
 * Claims the ₹100 joining bonus after completing first order
 * This endpoint is kept for backward compatibility and uses the new DeliveryWallet model
 */
export const claimJoiningBonus = asyncHandler(async (req, res) => {
  return errorResponse(res, 400, 'Joining bonus is not available in the salaried model');
});

/**
 * Get Order Statistics
 * Returns detailed order statistics
 */
export const getOrderStats = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { period = 'all' } = req.query; // 'today', 'week', 'month', 'all'

    // Calculate date range based on period
    let startDate = null;
    const now = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate = null; // All time
    }

    // Build query
    const query = { deliveryPartnerId: delivery._id };
    if (startDate) {
      query.createdAt = { $gte: startDate };
    }

    // Get order counts
    const totalOrders = await Order.countDocuments(query);
    const completedOrders = await Order.countDocuments({ ...query, status: 'delivered' });
    const pendingOrders = await Order.countDocuments({
      ...query,
      status: { $in: ['out_for_delivery', 'ready'] }
    });
    const cancelledOrders = await Order.countDocuments({ ...query, status: 'cancelled' });

    // Calculate earnings
    let orders = [];
    try {
      orders = await Order.find({
        ...query,
        status: 'delivered'
      }).select('pricing.deliveryFee deliveredAt');
    } catch (error) {
      logger.warn(`Error fetching orders for stats:`, error);
    }

    const totalEarnings = orders.reduce((sum, order) => {
      return sum + (order.pricing?.deliveryFee || 0);
    }, 0);

    const stats = {
      period,
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      totalEarnings: 0,
      averageEarningsPerOrder: 0,
      completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
    };

    return successResponse(res, 200, 'Order statistics retrieved successfully', stats);
  } catch (error) {
    logger.error('Error fetching order statistics:', error);
    return errorResponse(res, 500, 'Failed to fetch order statistics');
  }
});

