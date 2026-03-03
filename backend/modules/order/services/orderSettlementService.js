import Order from '../models/Order.js';
import OrderSettlement from '../models/OrderSettlement.js';
import FeeSettings from '../../admin/models/FeeSettings.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import mongoose from 'mongoose';

/**
 * Calculate comprehensive order settlement breakdown
 * This calculates earnings for User, Restaurant, Delivery Partner, and Admin
 */
export const calculateOrderSettlement = async (orderId) => {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new Error('Order not found');
    }

    // Get fee settings
    const feeSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    const platformFee = feeSettings?.platformFee || 5;
    const gstRate = (feeSettings?.gstRate || 5) / 100;

    // Get restaurant details
    let restaurant = null;
    if (mongoose.Types.ObjectId.isValid(order.restaurantId) && order.restaurantId.length === 24) {
      restaurant = await Restaurant.findById(order.restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { restaurantId: order.restaurantId },
          { slug: order.restaurantId }
        ]
      }).lean();
    }

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Calculate user payment breakdown
    const userPayment = {
      subtotal: order.pricing.subtotal || 0,
      discount: order.pricing.discount || 0,
      deliveryFee: order.pricing.deliveryFee || 0,
      platformFee: order.pricing.platformFee || platformFee,
      gst: order.pricing.tax || 0,
      packagingFee: 0, // Can be added later if needed
      total: order.pricing.total || 0
    };

    // Restaurant receives the full food price — no commission deducted
    const foodPrice = userPayment.subtotal - userPayment.discount;

    const restaurantEarning = {
      foodPrice: foodPrice,
      commission: 0,
      commissionPercentage: 0,
      netEarning: Math.round(foodPrice * 100) / 100,
      status: 'pending'
    };

    // Delivery partner earnings (salaried model — no per-order commission)
    let deliveryPartnerEarning = {
      basePayout: 0,
      distance: 0,
      commissionPerKm: 0,
      distanceCommission: 0,
      surgeMultiplier: 1,
      surgeAmount: 0,
      totalEarning: 0,
      status: 'pending'
    };

    if (order.deliveryPartnerId && order.assignmentInfo?.distance) {
      deliveryPartnerEarning.distance = order.assignmentInfo.distance;
      deliveryPartnerEarning.surgeMultiplier = order.assignmentInfo?.surgeMultiplier || 1;
    }

    // Admin/platform earnings: Platform fee + Delivery fee + GST (no commission)
    const adminPlatformFee = Math.round(userPayment.platformFee * 100) / 100;
    const adminDeliveryFee = Math.round(userPayment.deliveryFee * 100) / 100;
    const adminGST = Math.round(userPayment.gst * 100) / 100;

    const adminEarning = {
      commission: 0,
      platformFee: adminPlatformFee,
      deliveryFee: adminDeliveryFee,
      gst: adminGST,
      deliveryMargin: adminDeliveryFee,
      totalEarning: Math.round((adminPlatformFee + adminDeliveryFee + adminGST) * 100) / 100,
      status: 'pending'
    };

    // Create or update settlement
    let settlement = await OrderSettlement.findOne({ orderId });

    const settlementData = {
      orderNumber: order.orderId,
      userId: order.userId,
      restaurantId: restaurant._id,
      restaurantName: restaurant.name || order.restaurantName,
      deliveryPartnerId: order.deliveryPartnerId || null,
      userPayment,
      restaurantEarning,
      deliveryPartnerEarning,
      adminEarning,
      escrowStatus: 'pending',
      escrowAmount: userPayment.total,
      settlementStatus: 'pending',
      calculationSnapshot: {
        feeSettings: {
          platformFee: feeSettings?.platformFee,
          gstRate: feeSettings?.gstRate,
          deliveryFee: feeSettings?.deliveryFee
        },
        calculatedAt: new Date()
      }
    };

    if (settlement) {
      Object.assign(settlement, settlementData);
      await settlement.save();
    } else {
      settlement = await OrderSettlement.create({
        orderId,
        ...settlementData
      });
    }

    return settlement;
  } catch (error) {
    console.error('Error calculating order settlement:', error);
    throw new Error(`Failed to calculate order settlement: ${error.message} `);
  }
};

/**
 * Get settlement details for an order
 */
export const getOrderSettlement = async (orderId) => {
  try {
    let settlement = await OrderSettlement.findOne({ orderId })
      .populate('orderId', 'orderId status')
      .populate('restaurantId', 'name restaurantId')
      .populate('deliveryPartnerId', 'name phone')
      .lean();

    if (!settlement) {
      // Calculate if doesn't exist
      settlement = await calculateOrderSettlement(orderId);
    }

    return settlement;
  } catch (error) {
    console.error('Error getting order settlement:', error);
    throw error;
  }
};

/**
 * Update settlement when order status changes
 */
export const updateSettlementOnStatusChange = async (orderId, newStatus, previousStatus) => {
  try {
    const settlement = await OrderSettlement.findOne({ orderId });
    if (!settlement) {
      return;
    }

    // Update escrow status based on order status
    if (newStatus === 'delivered') {
      settlement.escrowStatus = 'released';
      settlement.escrowReleasedAt = new Date();
      settlement.settlementStatus = 'completed';
    } else if (newStatus === 'cancelled') {
      settlement.escrowStatus = 'refunded';
      settlement.settlementStatus = 'cancelled';
    }

    await settlement.save();
  } catch (error) {
    console.error('Error updating settlement on status change:', error);
    throw error;
  }
};

